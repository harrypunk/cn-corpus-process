# chinese-peotry-process

ETL pipeline that normalizes classical Chinese poetry data from a local
checkout of [chinese-poetry/chinese-poetry](https://github.com/chinese-poetry/chinese-poetry)
into a single SQLite database for use in an indie game.

## Why SQLite

The upstream repo ships ~160MB of JSON. For a game you want: one file to
bundle, indexed queries (by author, by title, random pick), and zero parsing
at runtime. SQLite gives all of that; `bun:sqlite` is built into Bun, so the
pipeline needs no dependencies. Paragraphs are stored as one `TEXT` column
joined with `\n` — split on display.

## Architecture

```
upstream JSON (read-only)
        │
        ▼
┌─────────────────┐   RawRecord    ┌──────────────────┐   PoemRecord   ┌───────────────┐
│  PoemSource     │ ─────────────▶ │  normalize/      │ ─────────────▶ │  db/          │
│  (per corpus,   │                │  pure functions: │                │  PoetryRepo-  │
│  sharded read)  │                │  text, author,   │                │  sitory       │
└─────────────────┘                │  dedup, record   │                │  (bun:sqlite) │
                                   └──────────────────┘                └──────┬────────┘
                                                                              │
                                                                              ▼
                                                                     dist/poetry.db
                                     StatsCollector counts every read / write /
                                     drop-reason and writes dist/report.json
```

Layers, each with one responsibility:

- `src/types.ts` — `RawRecord`, `PoemRecord`, `AuthorRecord`, `PoemSource` /
  `AuthorSource` interfaces, `DropReason`.
- `src/sources/` — corpus adapters. `JsonCorpusSource` streams records from
  sharded JSON arrays one shard at a time; `JsonAuthorSource` reads author
  biographies. `corpora.ts` is the data-driven registry: **adding a new
  corpus = adding one config entry**, no new code unless the shape is truly
  new.
- `src/normalize/` — pure, individually unit-tested functions:
  `text.ts` (line cleaning), `author.ts` (佚名 canonicalization),
  `dedup.ts` (content-hash dedup), `record.ts` (RawRecord → PoemRecord via
  a `FieldMapping`).
- `src/db/` — `schema.ts` (Drizzle table definitions + one-shot DDL) and
  `repository.ts` (typed queries via [Drizzle ORM](https://orm.drizzle.team)
  over bun:sqlite: author upsert, batched multi-row poem inserts). The
  repository is the only file that touches SQL, so swapping SQLite for
  Postgres/MySQL later means swapping the Drizzle driver, not the pipeline.
- `src/pipeline.ts` — orchestrator; composes an [Effect](https://effect.website)
  `Stream` (pure `map`/`filterMap` transforms, side effects confined to
  `tap`s and the final batched-transaction sink via `grouped` +
  `runForEach`). Dedup is global (corpora overlap, e.g. 水墨唐诗 ⊂ 全唐诗).
- `src/stats.ts` — per-source read/written/dropped-by-reason counters.
- `src/config.ts` — environment-variable configuration.
- `src/index.ts` — entry point.

## Usage

```sh
bun install
bun test

cp .env.example .env   # then set POETRY_ROOT in .env
bun run etl
```

Configuration is via environment variables (Bun auto-loads `.env`), no CLI
flags:

| variable       | required | default            | meaning |
|----------------|----------|--------------------|---------|
| `POETRY_ROOT`  | yes      | —                  | root of your chinese-poetry checkout |
| `ETL_DB`       | no       | `dist/poetry.db`   | output SQLite path |
| `ETL_REPORT`   | no       | `dist/report.json` | stats report path |
| `ETL_SOURCE`   | no       | (all corpora)      | run a single corpus, e.g. `shijing` |

Every run rebuilds the database from scratch (idempotent output). A full run
over ~355k records takes a few seconds.

## Schema

```sql
CREATE TABLE authors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  dynasty TEXT,
  description TEXT,
  UNIQUE(name, dynasty)
);

CREATE TABLE poems (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES authors(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,   -- paragraphs joined with \n
  source TEXT NOT NULL     -- corpus id, e.g. 'quantangshi'
);
CREATE INDEX idx_poems_author ON poems(author_id);
CREATE INDEX idx_poems_title ON poems(title);
```

## Corpora

| source id      | upstream files                              | notes |
|----------------|---------------------------------------------|-------|
| `quantangshi`  | `全唐诗/poet.tang.*.json`                    | dynasty `tang` |
| `quansongshi`  | `全唐诗/poet.song.*.json`                    | dynasty `song` |
| `songci`       | `宋词/ci.song.*.json`                        | records have no `title`; `rhythmic` (词牌) becomes the title |
| `yuanqu`       | `元曲/yuanqu.json`                           | |
| `shijing`      | `诗经/shijing.json`                          | uses `content` field; author fixed to 佚名; `chapter`/`section` not kept |
| `chuci`        | `楚辞/chuci.json`                            | uses `content` field |
| `caocao`       | `曹操诗集/caocao.json`                       | author fixed to 曹操 |
| `shuimo`       | `水墨唐诗/shuimotangshi.json`                | `prologue` field ignored; overlaps 全唐诗, removed by dedup |
| `nalanxingde`  | `纳兰性德/纳兰性德诗集.json`                  | uses `para` field |
| `huajianji`    | `五代诗词/huajianji/huajianji-*-juan.json`   | preface shards skipped by glob |
| `nantang`      | `五代诗词/nantang/poetrys.json`              | `rhythmic` as title fallback |

Author biographies come from `authors.tang.json`, `authors.song.json`
(`desc` field), `宋词/author.song.json` (`description` field) and
`五代诗词/nantang/authors.json`. They are upserted into `authors` before
poems are loaded.

Not loaded (on purpose): `全唐诗/error/`, `宋词/ci.db`, `rank/`,
`strains/`, `loader/`.

## Cleaning rules

Implemented as pure functions in `src/normalize/`:

- **Field normalization** — `paragraphs` / `content` / `para` all map to one
  internal shape; `rhythmic` is used as title where `title` is absent.
- **Author canonicalization** — `""`, `佚名`, `无名氏`, `不详`, `阙名`,
  `unknown` (any case) → one canonical `佚名` author row per dynasty.
- **Text cleaning** (per line) — strip `\r`, trim, collapse full-width
  spaces, remove explicit annotation markers `（注：…）` / `〖注：…〗`.
  Ordinary parentheses in titles/content are kept.
- **Corruption guard** — records containing the Unicode replacement char
  `U+FFFD` are dropped (`invalid_chars`).
- **Empty guards** — records with no paragraphs or no title after cleaning
  are dropped (`empty_content` / `empty_title`).
- **Dedup** — global on `(author, title, content)`; first occurrence wins,
  later ones are counted as `duplicate`.

## Reading the report

`dist/report.json` and the stdout table show, per source:

```
songci         read=21053 written=21036 dropped: invalid_chars=13, duplicate=4
```

- `read` — raw records parsed
- `written` — rows inserted into `poems`
- `dropped` — count per `DropReason`; investigate before tweaking rules

## Development

- `bun run check` — lint (oxlint) + format check (oxfmt) + typecheck (tsc)
  + unit tests in one go. Fix formatting with `bun run format`.
- `bun test` — unit tests for the normalization layer (fixtures only, never
  the real corpus).
- Follow the existing module boundaries: new corpus → registry entry in
  `src/sources/corpora.ts`; new record shape → extend `FieldMapping` or add
  a small `PoemSource` implementation; new cleaning rule → pure function in
  `src/normalize/` plus a test.
