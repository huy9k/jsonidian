import path from "node:path";
import fs from "node:fs/promises";
import type { IndexEntry, PageJson } from "./types.js";

/**
 * Write a page JSON file at outDir/{slug}.json
 */
export async function writePageJson(
  outDir: string,
  page: PageJson,
): Promise<void> {
  const filePath = path.join(outDir, `${page.slug}.json`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(page), "utf8");
}

/**
 * Write folder discovery indexes using each page's vault-relative path.
 * Nested folders → `{folder}/index.json` (e.g. blog/index.json).
 * Vault root → `_index.json` so it never overwrites the home page `index.json`.
 */
export async function writeFolderIndexes(
  outDir: string,
  pages: PageJson[],
): Promise<number> {
  const folderMap = new Map<string, IndexEntry[]>();

  for (const page of pages) {
    const dir = path.posix.dirname(page.relativePath);
    const base = path.posix.basename(page.relativePath, ".md");
    if (base === "index") continue;

    const folderKey =
      dir === "." ? "_index" : path.posix.join(dir, "index");

    const entry: IndexEntry = {
      slug: page.slug,
      frontmatter: page.frontmatter,
    };
    const list = folderMap.get(folderKey) ?? [];
    list.push(entry);
    folderMap.set(folderKey, list);
  }

  let count = 0;
  for (const [slug, entries] of folderMap) {
    const filePath = path.join(outDir, `${slug}.json`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(entries), "utf8");
    count += 1;
  }
  return count;
}

/**
 * Copy all asset files from contentDir into outDir, preserving relative paths.
 */
export async function copyAssets(
  contentDir: string,
  outDir: string,
  assetRelativePaths: string[],
): Promise<number> {
  let count = 0;
  for (const rel of assetRelativePaths) {
    const src = path.join(contentDir, rel);
    const dest = path.join(outDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
    count += 1;
  }
  return count;
}

/**
 * Empty and recreate the output directory.
 */
export async function prepareOutDir(outDir: string): Promise<void> {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
}
