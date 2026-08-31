import { Effect, Option, Stream } from "effect";
import { stripBom } from "./text.ts";
import { SourceError, type DataSource, type SourceFile } from "./types.ts";

export interface GiteaOptions {
  /** e.g. "https://gitea.example.com" (no trailing slash). */
  readonly baseUrl: string;
  readonly owner: string;
  readonly repo: string;
  /** Branch, tag or commit sha. */
  readonly ref: string;
  /** Access token for private repos. */
  readonly token?: string;
  /** Limit listing to this subdirectory; "" means the whole repo. */
  readonly pathPrefix?: string;
}

const PER_PAGE = 1000;

interface TreeEntry {
  readonly path: string;
  readonly type: string;
  readonly size?: number;
}

interface TreeResponse {
  readonly tree: TreeEntry[];
  readonly total_count?: number;
}

/** Encode each segment so slashes survive but unicode/space get escaped. */
const encodePath = (path: string): string => path.split("/").map(encodeURIComponent).join("/");

/** DataSource over a Gitea repository via its HTTP API. */
export function createGiteaSource(options: GiteaOptions): DataSource {
  const { baseUrl, owner, repo, ref } = options;
  const prefix = options.pathPrefix ?? "";
  const name = `gitea:${baseUrl}/${owner}/${repo}#${ref}`;
  const headers: Record<string, string> = options.token
    ? { authorization: `token ${options.token}` }
    : {};

  const fail = (operation: "list" | "read", cause: unknown, path?: string) =>
    new SourceError({ source: name, operation, message: String(cause), cause, path });

  const wanted = (entry: TreeEntry): boolean =>
    entry.type === "blob" &&
    entry.path.endsWith(".json") &&
    (prefix === "" || entry.path.startsWith(`${prefix}/`));

  async function fetchTreePage(page: number): Promise<TreeResponse> {
    const url =
      `${baseUrl}/api/v1/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}` +
      `?recursive=true&per_page=${PER_PAGE}&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return (await res.json()) as TreeResponse;
  }

  /** Pagination cursor: which page to fetch next and how many entries seen so far. */
  interface PageState {
    readonly page: number;
    readonly collected: number;
  }

  const nextState = (state: PageState, data: TreeResponse): Option.Option<PageState> => {
    const collected = state.collected + data.tree.length;
    const lastPage =
      data.tree.length === 0 ||
      (data.total_count !== undefined
        ? collected >= data.total_count
        : data.tree.length < PER_PAGE);
    return lastPage ? Option.none() : Option.some({ page: state.page + 1, collected });
  };

  /** All tree pages, pulled lazily until `nextState` says stop. */
  const pages: Stream.Stream<TreeResponse, SourceError> = Stream.paginateEffect(
    { page: 1, collected: 0 },
    (state) =>
      Effect.map(
        Effect.tryPromise({
          try: () => fetchTreePage(state.page),
          catch: (cause) => fail("list", cause),
        }),
        (data) => [data, nextState(state, data)],
      ),
  );

  const files: Stream.Stream<SourceFile, SourceError> = pages.pipe(
    Stream.mapConcat((data) => data.tree),
    Stream.filter(wanted),
    Stream.map((entry) => ({ path: entry.path, size: entry.size })),
  );

  return {
    name,
    list: () => files,
    read: (file) =>
      Effect.tryPromise({
        try: async () => {
          const url =
            `${baseUrl}/api/v1/repos/${owner}/${repo}/raw/${encodePath(file.path)}` +
            `?ref=${encodeURIComponent(ref)}`;
          const res = await fetch(url, { headers });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
          return stripBom(await res.text());
        },
        catch: (cause) => fail("read", cause, file.path),
      }),
  };
}
