# chinese-peotry-process

[chinese-poetry](https://github.com/chinese-poetry/chinese-poetry) 语料的 ETL 管道。
开发计划与各阶段设计见 [PLAN.md](PLAN.md)，协作约定见 [AGENTS.md](AGENTS.md)。

## 架构

```
source(字节→文本) → parse(JSON→原始记录) → normalize(清洗/编码归一) → derive(sentences/search) → store(DB)
```

每层职责单一、可独立测试、可替换实现：source 只把字节变成无 BOM 的 UTF-8 文本，
解析、归一化、派生、存储各自独立成层。

## 使用

```sh
cp .env.example .env   # 按需修改
bun install
bun run etl            # 运行管道（当前实现到 source 层：列出文件做冒烟验证）
bun run check          # lint + format + typecheck + test
```

## 数据源

pipeline 通过 `DataSource` 接口取原始文本（`src/source/types.ts`），由 `ETL_SOURCE_KIND` 选择实现：

- **fs**（默认）— 本地 checkout，需要 `POETRY_ROOT`
- **gitea** — 远程仓库走 Gitea HTTP API，需要 `GITEA_BASE_URL` / `GITEA_OWNER` / `GITEA_REPO`；
  可选 `GITEA_REF`（默认 `master`）/ `GITEA_TOKEN` / `GITEA_PATH_PREFIX`

gitea 实现只用到两个 REST 端点（`src/source/gitea.ts`；
参考 [Gitea API 官方文档 — repository](https://docs.gitea.com/api/operations/tags/repository/)）：

- `GET /api/v1/repos/{owner}/{repo}/git/trees/{ref}?recursive=true&per_page=1000&page=N` —
  递归列出文件树，分页拉取（`total_count` 优先，短页兜底）
- `GET /api/v1/repos/{owner}/{repo}/raw/{path}?ref={ref}` — 读取文件原始内容
