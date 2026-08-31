import { Effect, Stream } from "effect";
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

  async function* listFiles(): AsyncGenerator<SourceFile> {
    let page = 1;
    let collected = 0;
    for (;;) {
      const data = await fetchTreePage(page);
      if (data.tree.length === 0) return;
      for (const entry of data.tree) {
        if (wanted(entry)) yield { path: entry.path, size: entry.size };
      }
      collected += data.tree.length;
      const lastPage =
        data.total_count !== undefined
          ? collected >= data.total_count
          : data.tree.length < PER_PAGE;
      if (lastPage) return;
      page++;
    }
  }

  return {
    name,
    list: () => Stream.fromAsyncIterable(listFiles(), (cause) => fail("list", cause)),
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
