# AGENTS.md

Guidance for agents working in this repository.

## Project

ETL pipeline for the [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry) corpus.
Phases and layer boundaries are defined in [PLAN.md](PLAN.md); read it before adding a stage.

Pipeline layers, each with a single responsibility:

```
source(字节→文本) → parse(JSON→原始记录) → sink(raw 落库) → normalize(清洗/编码归一) → derive(sentences/search) → store(结构化表)
```

## Stack & commands

- Runtime: **Bun** (TypeScript, ESM, `.ts` import extensions)
- Core libs: **Effect** (Stream/Effect/Data.TaggedError), drizzle-orm, opencc-js
- `bun install` — install deps
- `bun run ingest:<corpus>` — run one ingest job (entries `pipeline/ingest-*.ts`)
- `bun run check` — **must stay green**: oxlint + oxfmt + tsc --noEmit + bun test

## Layout

- `pipeline/` — job entries (`bun run <job>`), one file per job; thin wiring only
  (corpus dir + path filter + parser). The shared ingest core lives in
  `pipeline/ingest.ts` (event producer + entry wiring), `pipeline/events.ts`
  (event types) and `pipeline/observers.ts` (sink/metrics/log subscribers);
  jobs themselves have no tests.
- `src/source/` — DataSource layer: bytes→text (fs, gitea)
- `src/parse/` — Parser layer: text→RawRecord, pure
- `src/store/` — Sink layer: raw_records (pglite, tidb)
- `src/config.ts` — env config, the only module that reads `process.env`

Imports: cross-directory via the `@src/*` alias (tsconfig `paths`), same-directory stays
relative (`./foo.ts`).

## Rules

### Separation of concerns

- Respect the layer boundaries: `source` turns bytes into UTF-8 text and nothing more;
  parsing, normalization (BOM/NFKC/繁简), derivation, and storage each live in their own layer.
  Never let a concern leak into a neighboring layer.
- Pure functions vs side effects: `parse`/`normalize`/`derive` are pure and synchronous;
  all IO lives in `source` and `store`. No `fetch`, `fs`, or `process.env` access outside
  config/source/store modules.
- All configuration comes from env via `src/config.ts` (Bun loads `.env` automatically).
  Zero hardcoded paths, URLs, or credentials in code.

### SOLID

- **Single responsibility** — one module, one job. If a function needs "and" to describe
  what it does, split it. No god classes, no god functions.
- **Open/closed** — add behavior by adding a new implementation (e.g. a new `DataSource`),
  not by editing existing ones or adding `if` branches to call sites.
- **Liskov substitution** — implementations of an interface must honor its full contract
  (error types, ordering guarantees, encoding guarantees). See `DataSource` in
  `src/source/types.ts`: deterministic ordering and BOM-stripped UTF-8 are part of the
  contract, not implementation details.
- **Interface segregation** — keep interfaces small and consumer-shaped (`DataSource` is
  two methods). Do not add speculative members "for later".
- **Dependency inversion** — pipeline code depends on abstractions (`DataSource`), selected
  by config in a factory (`createSource`), never on concrete sources directly.

### Clean code

- Minimal diffs: change only what the task requires; no drive-by refactors, renames, or
  reformatting.
- Match the surrounding style: naming, comment density, `readonly` fields, explicit return
  types where the file already has them. Comments are English; user docs (README/PLAN) are Chinese.
- Use Effect idioms already established here: `Effect.gen`, `Stream`, `Data.TaggedError`
  for typed errors — no thrown exceptions in library code (config validation may throw,
  as `src/config.ts` does).
- No dead code, no commented-out blocks, no TODOs without an owner/issue.
- Tests mirror the module (`foo.ts` → `foo.test.ts`), use temp fixtures / local stubs,
  never hit the network or the real corpus.

## Definition of done

- `bun run check` passes.
- New behavior is covered by tests.
- PLAN.md / README.md updated when layer boundaries, phases, or env vars change.
