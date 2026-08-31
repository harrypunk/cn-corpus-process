import type { SourceConfig } from "../config.ts";
import { createGiteaSource } from "./gitea.ts";
import { createLocalFsSource } from "./local-fs.ts";
import type { DataSource } from "./types.ts";

export * from "./types.ts";
export { createGiteaSource, createLocalFsSource };

/** Build the DataSource selected by config. */
export function createSource(config: SourceConfig): DataSource {
  switch (config.kind) {
    case "fs":
      return createLocalFsSource(config.root, config.prefixes);
    case "gitea":
      return createGiteaSource(config);
  }
}
