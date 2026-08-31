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

/**
 * HTTP access to the two Gitea endpoints this source needs. Owns URL building,
 * auth headers and status checking; failures come back as SourceError.
 */
interface GiteaClient {
  readonly treePage: (page: number) => Effect.Effect<TreeResponse, SourceError>;
  readonly rawText: (path: string) => Effect.Effect<string, SourceError>;
}

function createGiteaClient(options: GiteaOptions, sourceName: string): GiteaClient {
  const { baseUrl, owner, repo, ref } = options;
  const repoApi = `${baseUrl}/api/v1/repos/${owner}/${repo}`;
  const headers: Record<string, string> = options.token
    ? { authorization: `token ${options.token}` }
    : {};

  const fail = (operation: "list" | "read", cause: unknown, path?: string) =>
    new SourceError({ source: sourceName, operation, message: String(cause), cause, path });

  /** GET `url`; network failures and non-2xx responses land in the error channel. */
  const get = (
    url: string,
    operation: "list" | "read",
    path?: string,
  ): Effect.Effect<Response, SourceError> =>
    Effect.tryPromise({
      try: () => fetch(url, { headers }),
      catch: (cause) => fail(operation, cause, path),
    }).pipe(
      Effect.filterOrFail(
        (res) => res.ok,
        (res) => fail(operation, new Error(`HTTP ${res.status} for ${url}`), path),
      ),
    );

  /** Parse a response body; parse failures land in the error channel. */
  const body = <A>(
    res: Response,
    parse: (res: Response) => Promise<A>,
    operation: "list" | "read",
    path?: string,
  ): Effect.Effect<A, SourceError> =>
    Effect.tryPromise({ try: () => parse(res), catch: (cause) => fail(operation, cause, path) });

  return {
    treePage: (page) =>
      get(
        `${repoApi}/git/trees/${encodeURIComponent(ref)}` +
          `?recursive=true&per_page=${PER_PAGE}&page=${page}`,
        "list",
      ).pipe(Effect.flatMap((res) => body(res, (r) => r.json() as Promise<TreeResponse>, "list"))),
    rawText: (path) =>
      get(`${repoApi}/raw/${encodePath(path)}?ref=${encodeURIComponent(ref)}`, "read", path).pipe(
        Effect.flatMap((res) => body(res, (r) => r.text(), "read", path)),
        Effect.map(stripBom),
      ),
  };
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
    (data.total_count !== undefined ? collected >= data.total_count : data.tree.length < PER_PAGE);
  return lastPage ? Option.none() : Option.some({ page: state.page + 1, collected });
};

/** All tree pages, pulled lazily until `nextState` says stop. */
const listTreePages = (
  treePage: GiteaClient["treePage"],
): Stream.Stream<TreeResponse, SourceError> =>
  Stream.paginateEffect({ page: 1, collected: 0 }, (state) =>
    treePage(state.page).pipe(Effect.map((data) => [data, nextState(state, data)] as const)),
  );

/** Keep only *.json blobs under the prefix. */
const jsonBlobsUnder =
  (prefix: string) =>
  (entry: TreeEntry): boolean =>
    entry.type === "blob" &&
    entry.path.endsWith(".json") &&
    (prefix === "" || entry.path.startsWith(`${prefix}/`));

/** DataSource over a Gitea repository via its HTTP API. */
export function createGiteaSource(options: GiteaOptions): DataSource {
  const name = `gitea:${options.baseUrl}/${options.owner}/${options.repo}#${options.ref}`;
  const client = createGiteaClient(options, name);

  const files: Stream.Stream<SourceFile, SourceError> = listTreePages(client.treePage).pipe(
    Stream.mapConcat((data) => data.tree),
    Stream.filter(jsonBlobsUnder(options.pathPrefix ?? "")),
    Stream.map((entry): SourceFile => ({ path: entry.path, size: entry.size })),
  );

  return {
    name,
    list: () => files,
    read: (file) => client.rawText(file.path),
  };
}
