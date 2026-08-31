# 重构计划（v2）

## 为什么重做

v1 在实践中暴露了两类前期估计不足的问题，重写时正面解决：

1. **字符编码**：源文件为 UTF-8（个别带 BOM）；简体/繁体混杂；全角/半角标点需要 NFKC 归一。这些处理必须落在明确的层级，而不是散落各处。
2. **管道组织**：v1 是纯函数与副作用交织的命令式循环，越到后期越难加 stage。v2 全程用 Effect Stream 组织，每层职责单一、可独立测试、可替换实现。

## 分层与阶段

```
source(字节→文本) → parse(JSON→原始记录) → normalize(清洗/编码归一) → derive(sentences/search) → store(DB)
```

- [x] **Phase 1 — 数据源抽象**
- [ ] Phase 2 — 解析与归一化（含 BOM/NFKC/繁简策略的统一入口）
- [ ] Phase 3 — 存储层（Drizzle，sqlite/postgres/mysql）
- [ ] Phase 4 — 派生数据（sentences 表、简体检索列）
- [ ] Phase 5 — 检索与向量（关键词 + 语义混合召回）

## Phase 1 设计

**目标**：pipeline 完全不感知数据来自本地 checkout 还是远程 Gitea 仓库。

接口（`src/source/types.ts`）：

- `list(): Stream<SourceFile, SourceError>` — 列出候选文件（过滤 `*.json`，顺序确定）
- `read(file): Effect<string, SourceError>` — 读出 UTF-8 文本（去 BOM）

**职责边界**：loader 只负责 字节→文本。不做 JSON 解析，不做繁简/NFKC——那是 Phase 2 的事。这是编码问题的第一道闸门：所有文本进入系统时保证是无 BOM 的 UTF-8。

实现：

- `LocalFsSource`（`src/source/local-fs.ts`）— 递归遍历本地目录，文件名排序保证顺序确定
- `GiteaSource`（`src/source/gitea.ts`）— `git/trees` API 分页列举（`total_count` 优先，短页兜底），`raw` API 取文件内容；可选 `token` 访问私有仓库；`pathPrefix` 限定子目录

配置（env，见 `.env.example`）：

- `ETL_SOURCE_KIND=fs|gitea`（默认 `fs`）
- fs：`POETRY_ROOT`
- gitea：`GITEA_BASE_URL` / `GITEA_OWNER` / `GITEA_REPO` / `GITEA_REF`（默认 master）/ `GITEA_TOKEN`（可选）/ `GITEA_PATH_PREFIX`（可选）

验证：

- `bun test` — fs loader 用临时 fixture；gitea loader 用 `Bun.serve` 起本地桩，覆盖分页、过滤、鉴权头、BOM
- `bun run etl` — 冒烟：按当前 env 配置列出文件数与样例

## 已定原则（后续阶段遵守）

- 配置全部走 env（Bun 自动加载 `.env`），代码内零硬编码路径
- 纯函数与副作用分离：normalize 层纯函数，source/store 层持有全部 IO
- 小接口 + 可替换实现，拒绝全能类/全能函数
- `bun run check`（oxlint + oxfmt + tsc + bun test）保持全绿才合并
