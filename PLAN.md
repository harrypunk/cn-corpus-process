# 重构计划（v2）

## 为什么重做

v1 在实践中暴露了两类前期估计不足的问题，重写时正面解决：

1. **字符编码**：源文件为 UTF-8（个别带 BOM）；简体/繁体混杂；全角/半角标点需要 NFKC 归一。这些处理必须落在明确的层级，而不是散落各处。
2. **管道组织**：v1 是纯函数与副作用交织的命令式循环，越到后期越难加 stage。v2 全程用 Effect Stream 组织，每层职责单一、可独立测试、可替换实现。

## 分层与阶段

```
source(字节→文本) → parse(JSON→原始记录) → sink(raw 落库) → normalize(清洗/编码归一) → derive(sentences/search) → store(结构化表)
```

- [x] **Phase 1 — 数据源抽象**（fs / gitea）
- [x] **Phase 2 — 原始记录落库**（parse + raw sinks：PGlite / TiDB；每个语料目录一个 ingest job）
- [x] **Phase 3 — ingest job 重构**（提取 ingest-* 公共部分，job 只留语料专属声明）
- [ ] **Phase 4 — 横切关注**（ingest 日志/指标/报告：事件流 + 独立订阅 stream）
- [ ] Phase 5 — 归一化（从 raw_records 读取；BOM/NFKC/繁简统一入口；写入结构化表）
- [ ] Phase 6 — 派生数据（sentences 表、简体检索列）
- [ ] Phase 7 — 检索与向量（关键词 + 语义混合召回）

## Phase 1 设计

**目标**：pipeline 完全不感知数据来自本地 checkout 还是远程 Gitea 仓库。

接口（`src/source/types.ts`）：

- `list(): Stream<SourceFile, SourceError>` — 列出候选文件（过滤 `*.json`，顺序确定）
- `read(file): Effect<string, SourceError>` — 读出 UTF-8 文本（去 BOM）

**职责边界**：loader 只负责 字节→文本。JSON 解析是 parse 层的事，繁简/NFKC 是归一化阶段的事。这是编码问题的第一道闸门：所有文本进入系统时保证是无 BOM 的 UTF-8。

实现：

- `LocalFsSource`（`src/source/local-fs.ts`）— 递归遍历本地目录，文件名排序保证顺序确定
- `GiteaSource`（`src/source/gitea.ts`）— `git/trees` API 分页列举（`total_count` 优先，短页兜底），`raw` API 取文件内容；可选 `token` 访问私有仓库

列举过滤：两个实现都支持 `ETL_PATH_PREFIXES`（逗号分隔的目录前缀，空 = 整个 source）——pipeline 按语料目录圈定范围。

配置（env，见 `.env.example`）：

- `ETL_SOURCE_KIND=fs|gitea`（默认 `fs`）
- fs：`POETRY_ROOT`
- gitea：`GITEA_BASE_URL` / `GITEA_OWNER` / `GITEA_REPO` / `GITEA_REF`（默认 master）/ `GITEA_TOKEN`（可选）

验证：

- `bun test` — fs loader 用临时 fixture；gitea loader 用 `Bun.serve` 起本地桩，覆盖分页、过滤、鉴权头、BOM
- `bun run ingest:wudai` — 冒烟：按当前 env 配置列出文件数与样例

## Phase 2 设计

**目标**：`source → 路径过滤 → parse → sink`。原始记录原样落库（ELT），之后的清洗/转换全部从 raw 表读，不回打数据源。

**job 组织**：每个语料目录一个 job 文件（`pipeline/ingest-<corpus>.ts`，`bun run <job>`）。路径过滤不在 parser 里，由 job 组合四样东西：

1. **prefix** — source 列举范围（job 内锁定，如 `五代诗词`，不依赖 `ETL_PATH_PREFIXES`）
2. **路径谓词** — 列举后过滤具体文件（如 `huajianji-*-juan.json`、`nantang/poetrys.json`；rank/、strains/、loader/ 等元数据由此排除）
3. **parser** — 该语料的 JSON 结构
4. **sink** — env 选择的落库实现

现有 job：`ingest-wudai`（五代诗词：花间集 juan 文件 + 南唐 poetrys.json → `ciParser`）、`ingest-quantangshi`（全唐诗：poet.tang/poet.song + 三百首/补录 → `poemsParser`）、`ingest-songci`（宋词：ci.song.* + 宋词三百首 → `ciParser`）、`ingest-shuimotangshi`（水墨唐诗：shuimotangshi.json → `poemsParser`）、`ingest-caocao` / `ingest-chuci` / `ingest-nalan` / `ingest-shijing`（单文件语料 → `mappedParser` 字段映射）。

**Parser 接口**（`src/parse/types.ts`）——parser 只负责 JSON→原始记录，纯函数：

- `parse(text): RawRecord[]`；malformed 输入返回 `[]`
- 现有实现：`poemsParser`（`{author, title, paragraphs[]}`，如 `全唐诗/`、`元曲/`）、`ciParser`（`rhythmic→title`，notes 丢弃，如 `五代诗词/`）、`mappedParser(name, FieldMapping)`（字段映射工厂：`paragraphs` 指定行数组字段，`defaultAuthor` 补缺失作者，`titlePrefix` 拼章节前缀，覆盖 楚辞/纳兰性德/诗经/曹操诗集 等无统一 schema 的语料）

**Sink 接口**（`src/store/types.ts`）：

- `writeRaw(records): Effect<void, SinkError>` — 批量插入
- `close(): Effect<void, SinkError>` — 释放连接

表：`raw_records(id, author, title, content)`。**insert-only staging**：此阶段没有天然主键，重跑会重复——dedup 归归一化阶段。

实现：

- `PgliteSink`（`src/store/pglite.ts`）— 嵌入式 Postgres（[PGlite](https://pglite.dev)，WASM），零服务依赖，默认数据目录 `./dist/pglite`
- `TidbSink`（`src/store/tidb.ts`）— MySQL 协议（mysql2 + drizzle），`DATABASE_URL` 连接；`content longtext` 留足余量

job 入口（`pipeline/ingest-wudai.ts`，`bun run ingest:wudai`）：list → 路径过滤 → 并发读（8）→ parse → 每 500 条一批插入；`acquireRelease` 保证连接关闭。job 入口一个文件一个 job，`src/` 只放内部分层逻辑。
配置（env）：

- `ETL_PATH_PREFIXES` — 逗号分隔的语料目录（空 = 整个 source），fs/gitea 通用
- `ETL_READ_CONCURRENCY`（默认 8）— 并发读文件数
- `ETL_BATCH_SIZE`（默认 500）— 每批写入 raw_records 的记录数
- `ETL_SINK_KIND=pglite|tidb`（默认 `pglite`）
- pglite：`PGLITE_DATA_DIR`（默认 `./dist/pglite`）
- tidb：`DATABASE_URL`（如 `mysql://user:pass@host:4000/dbname`）

验证：

- `bun test` — parser 各结构 fixture；ingest 用 fake source/sink 覆盖路径过滤与组合；pglite sink 临时目录验证 insert-only 语义
- `bun run ingest:wudai` — 冒烟：按当前 env 配置跑通 ingest-wudai（五代诗词：花间集 + 南唐词）

## Phase 3 设计

**目标**：ingest-* 的公共部分提取到共享模块，job 文件只保留语料专属声明。

结果：公共核心在 `pipeline/ingest.ts`——`ingest()` 主流水线（list → filter → 并发读 8 → parse → 每 500 条一批写入）、`runIngestJob()` 入口骨架（loadConfig → source/sink 组合 → `acquireRelease` 清理 → 计数日志）。job 文件只声明三条：corpus dir、路径谓词、parser，加 `if (import.meta.main)` 一行调用。

测试：核心用 fake source/sink 覆盖（过滤、parse、分批、计数）；job 是无逻辑的薄入口，不配测试。

## Phase 4 设计

**目标**：横切关注（日志 / 指标 / 完成报告）从主流水线剥离。`ingest()` 只做数据流；可观测性由独立 stream 订阅同一事件流完成——pipeline 代码不出现 Console、计数器、Metric。

**现状问题**：

- 完成报告只是 `runIngestJob` 末尾一行 Console.log 总数；列出多少文件、过滤掉多少、哪些文件解析为空、哪些失败——都不可见
- 单文件 read 失败即整流失败，大语料重跑成本高，且报告里没有失败清单
- 没有指标，排障靠猜

**设计**：事件流 + 广播订阅

1. **事件类型**：`IngestEvent = FileListed | FileSkipped | RecordsParsed(records) | FileFailed(path, message)`——数据事件携带记录，其余只带事实
2. **核心改造**：`ingest()` 产出 `Stream<IngestEvent, SourceError>`，各 stage 只负责发事件，不再直接调用 sink，也不感知"谁在听"（DIP）
3. **订阅者**（各自一条独立 stream，`Stream.broadcast` 扇出、并发消费）：
   - `sinkWriter` — 收集 `RecordsParsed` 的记录，`grouped(batchSize)` → `writeRaw`
   - `metricsCollector` — `runFold` 聚合：files listed/skipped/read/failed、records、批次数、耗时
   - `progressLogger` — 低频进度日志；失败事件即记
4. **完成报告** = metrics 的最终 fold，由 `runIngestJob` 统一输出一行汇总（含失败文件清单），不再散点打日志
5. **失败策略**：单文件 read/parse 失败降级为 `FileFailed` 事件继续跑，报告里可见；不再因为一条坏数据整流失败

**取舍**：替代方案是 Effect `Metric` 计数器在各 tap 点直接打点——更简单，但观测逻辑渗回 pipeline，且"过滤掉的文件"这类事件没有记录载体。事件流让新增订阅者（如 JSONL 审计日志）不改 pipeline 一行。

**验证**：fake source 断言事件序列；各订阅者独立单测；真实 job 冒烟看汇总输出。

## 已定原则（后续阶段遵守）

- 配置全部走 env（Bun 自动加载 `.env`），代码内零硬编码路径
- 纯函数与副作用分离：parse/normalize 层纯函数，source/store 层持有全部 IO
- 小接口 + 可替换实现，拒绝全能类/全能函数
- `bun run check`（oxlint + oxfmt + tsc + bun test）保持全绿才合并
