# chinese-peotry-process

[chinese-poetry](https://github.com/chinese-poetry/chinese-poetry) 语料的 ETL 管道（v2 重构中，路线图见 [PLAN.md](PLAN.md)）。

## 使用

```sh
cp .env.example .env   # 按需修改
bun install
bun run etl            # 当前阶段：列出数据源文件，做冒烟验证
bun run check          # lint + format + typecheck + test
```

## 数据源（Phase 1）

pipeline 通过 `DataSource` 接口取原始文本（`src/source/types.ts`），两个实现：

- **fs** — 本地 checkout，`ETL_SOURCE_KIND=fs` + `POETRY_ROOT`
- **gitea** — Gitea HTTP API，`ETL_SOURCE_KIND=gitea` + `GITEA_BASE_URL` / `GITEA_OWNER` / `GITEA_REPO`（可选 `GITEA_REF` / `GITEA_TOKEN` / `GITEA_PATH_PREFIX`）

loader 只负责 字节→UTF-8 文本（去 BOM）；解析与归一化在后续阶段加入。
