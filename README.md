# chinese-peotry-process

[chinese-poetry](https://github.com/chinese-poetry/chinese-poetry) 语料的 ETL 管道。
开发计划与各阶段设计见 [PLAN.md](PLAN.md)，协作约定见 [AGENTS.md](AGENTS.md)。

## 架构

```
source(字节→文本) → parse(JSON→原始记录) → sink(raw 落库) → normalize(清洗/编码归一) → derive(sentences/search) → store(结构化表)
```

每层职责单一、可独立测试、可替换实现：source 只把字节变成无 BOM 的 UTF-8 文本；
parse 按目录结构解析出原始记录；sink 原样落库（ELT），后续清洗/转换从 raw 表读取，不回打数据源。

## 使用

```sh
cp .env.example .env   # 按需修改
bun install
bun run ingest:wudai   # job：列举 → 过滤 → 解析 → raw 记录落库（其它语料：ingest:<corpus>）
bun run check          # lint + format + typecheck + test
```

job 入口在 `pipeline/` 下，一个语料目录一个文件（如 `pipeline/ingest-wudai.ts`），共享流水线在
`pipeline/ingest.ts`；`src/` 只放内部分层逻辑。

## 数据源

pipeline 通过 `DataSource` 接口取原始文本（`src/source/types.ts`），由 `ETL_SOURCE_KIND` 选择实现：

- **fs**（默认）— 本地 checkout，需要 `POETRY_ROOT`
- **gitea** — 远程仓库走 Gitea HTTP API，需要 `GITEA_BASE_URL` / `GITEA_OWNER` / `GITEA_REPO`；
  可选 `GITEA_REF`（默认 `master`）/ `GITEA_TOKEN`

两个实现都支持 `ETL_PATH_PREFIXES`（逗号分隔的目录前缀，空 = 整个 source），按语料目录圈定列举范围，
如 `ETL_PATH_PREFIXES=全唐诗,元曲,五代诗词`。

gitea 实现只用到两个 REST 端点（`src/source/gitea.ts`；
参考 [Gitea API 官方文档 — repository](https://docs.gitea.com/api/operations/tags/repository/)）：

- `GET /api/v1/repos/{owner}/{repo}/git/trees/{ref}?recursive=true&per_page=1000&page=N` —
  递归列出文件树，分页拉取（`total_count` 优先，短页兜底）
- `GET /api/v1/repos/{owner}/{repo}/raw/{path}?ref={ref}` — 读取文件原始内容

## 解析与落库（Phase 2）

`src/parse/` 按 JSON 结构解析（`Parser` 接口，现有 `poemsParser` / `ciParser`）；
路径过滤在 job 里声明，rank/、strains/、loader/ 等元数据文件由此排除。

原始记录写入 `raw_records(id, author, title, content)`——insert-only staging，重跑会重复，
dedup 归 Phase 3。`ETL_SINK_KIND` 选择 sink（`src/store/`）：

- **pglite**（默认）— 嵌入式 Postgres（[PGlite](https://pglite.dev)，WASM），零服务依赖；
  可选 `PGLITE_DATA_DIR`（默认 `./dist/pglite`）
- **tidb** — MySQL 协议（mysql2 + drizzle），需要 `DATABASE_URL`（如 `mysql://user:pass@host:4000/dbname`）
