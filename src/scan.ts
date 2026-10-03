import path from "node:path";
import { globby } from "globby";
import type { BuildOptions } from "./types.js";

const DEFAULT_IGNORE: string[] = [
  "**/.obsidian/**",
  "**/templates/**",
  "**/.trash/**",
  "**/node_modules/**",
];

/**
 * Scan the vault for markdown notes, returning posix-relative paths from contentDir.
 */
export async function scanMarkdownFiles(
  contentDir: string,
  ignore: string[] = [],
): Promise<string[]> {
  const absolute = path.resolve(contentDir);
  const patterns = ["**/*.md"];
  const files = await globby(patterns, {
    cwd: absolute,
    ignore: [...DEFAULT_IGNORE, ...ignore],
    onlyFiles: true,
    followSymbolicLinks: false,
  });
  return files.map((f) => f.split(path.sep).join("/")).sort();
}

/** Resolve ignore list from build options. */
export function resolveIgnore(opts: BuildOptions): string[] {
  return opts.ignore ?? [];
}
