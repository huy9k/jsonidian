import path from "node:path";
import fs from "node:fs/promises";
import matter from "gray-matter";
import type { ParsedNote, PublishPredicate } from "./types.js";

/** Default: publish unless draft or explicitly unpublished. */
export const defaultPublish: PublishPredicate = (frontmatter) => {
  if (frontmatter.draft === true) return false;
  if (frontmatter.is_published === false) return false;
  return true;
};

/** Convert a vault-relative markdown path to a URL slug (no .md, no trailing /index collapse). */
export function pathToSlug(relativePath: string): string {
  const posix = relativePath.split(path.sep).join("/");
  const withoutExt = posix.replace(/\.md$/i, "");
  if (withoutExt === "index") return "index";
  if (withoutExt.endsWith("/index")) {
    return withoutExt.slice(0, -"/index".length);
  }
  return withoutExt;
}

/** Normalize aliases from frontmatter into a string array. */
export function normalizeAliases(frontmatter: Record<string, unknown>): string[] {
  const raw = frontmatter.aliases;
  if (Array.isArray(raw)) {
    return raw.filter((a): a is string => typeof a === "string" && a.trim() !== "");
  }
  if (typeof raw === "string" && raw.trim() !== "") return [raw];
  return [];
}

/**
 * Read and parse a single markdown file into a ParsedNote.
 */
export async function parseNoteFile(
  contentDir: string,
  relativePath: string,
  publish: PublishPredicate,
): Promise<ParsedNote> {
  const absolutePath = path.join(contentDir, relativePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const { data, content } = matter(raw);
  const frontmatter = (data ?? {}) as Record<string, unknown>;
  const slug = pathToSlug(relativePath);
  const aliases = normalizeAliases(frontmatter);

  return {
    absolutePath,
    relativePath: relativePath.split(path.sep).join("/"),
    slug,
    frontmatter,
    aliases,
    body: content,
    published: publish(frontmatter, relativePath),
  };
}
