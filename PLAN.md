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
- [x] **Phase 2 — 原始记录落库**（parse + raw sinks：PGlite / TiDB）
- [ ] Phase 3 — 归一化（从 raw_records 读取；BOM/NFKC/繁简统一入口；写入结构化表）
- [ ] Phase 4 — 派生数据（sentences 表、简体检索列）
- [ ] Phase 5 — 检索与向量（关键词 + 语义混合召回）

## Phase 1 设计

**目标**：pipeline 完全不感知数据来自本地 checkout 还是远程 Gitea 仓库。

接口（`src/source/types.ts`）：

- `list(): Stream<SourceFile, SourceError>` — 列出候选文件（过滤 `*.json`，顺序确定）
- `read(file): Effect<string, SourceError>` — 读出 UTF-8 文本（去 BOM）

**职责边界**：loader 只负责 字节→文本。JSON 解析是 Phase 2 parse 层的事，繁简/NFKC 是 Phase 3 的事。这是编码问题的第一道闸门：所有文本进入系统时保证是无 BOM 的 UTF-8。

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
- `bun run ingest` — 冒烟：按当前 env 配置列出文件数与样例

## Phase 2 设计

**目标**：pipeline 1 = `source → 按目录列举 → parse → sink`。原始记录原样落库（ELT），之后的清洗/转换全部从 raw 表读，不回打数据源。

**Parser 接口**（`src/parse/types.ts`）——语料按目录分结构，每个 parser 声明自己认领的路径：

- `match(path): boolean` + `parse(text): RawRecord[]`；纯函数，malformed 输入返回 `[]`
- `parseFile(path, text)` 路由：第一个 match 的 parser 处理；无人认领的文件（rank/、strains/、loader/ 等元数据）跳过
- 现有实现：`poemsParser`（`全唐诗/`、`元曲/`，`{author, title, paragraphs[]}`）、`ciParser`（`五代诗词/`，`rhythmic→title`，notes 丢弃）

**Sink 接口**（`src/store/types.ts`）：

- `writeRaw(records): Effect<void, SinkError>` — 批量插入
- `close(): Effect<void, SinkError>` — 释放连接

表：`raw_records(id, author, title, content)`。**insert-only staging**：此阶段没有天然主键，重跑会重复——dedup 归 Phase 3。

实现：

- `PgliteSink`（`src/store/pglite.ts`）— 嵌入式 Postgres（[PGlite](https://pglite.dev)，WASM），零服务依赖，默认数据目录 `./dist/pglite`
- `TidbSink`（`src/store/tidb.ts`）— MySQL 协议（mysql2 + drizzle），`DATABASE_URL` 连接；`content longtext` 留足余量

job 入口（`pipeline/ingest.ts`，`bun run ingest`）：list → 并发读（8）→ parseFile → 每 500 条一批插入；`acquireRelease` 保证连接关闭。job 入口一个文件一个 job，`src/` 只放内部分层逻辑。

配置（env）：

- `ETL_PATH_PREFIXES` — 逗号分隔的语料目录（空 = 整个 source），fs/gitea 通用
- `ETL_SINK_KIND=pglite|tidb`（默认 `pglite`）
- pglite：`PGLITE_DATA_DIR`（默认 `./dist/pglite`）
- tidb：`DATABASE_URL`（如 `mysql://user:pass@host:4000/dbname`）

验证：

- `bun test` — parser 路由与各结构 fixture；ingest 用 fake source/sink；pglite sink 临时目录验证 insert-only 语义
- `bun run ingest` — 冒烟：gitea → pglite / tidb，`五代诗词,元曲` 落 345,464 条，两库一致

## 已定原则（后续阶段遵守）

- 配置全部走 env（Bun 自动加载 `.env`），代码内零硬编码路径
- 纯函数与副作用分离：parse/normalize 层纯函数，source/store 层持有全部 IO
- 小接口 + 可替换实现，拒绝全能类/全能函数
- `bun run check`（oxlint + oxfmt + tsc + bun test）保持全绿才合并
