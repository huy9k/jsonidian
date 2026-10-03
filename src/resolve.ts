import path from "node:path";
import type { ParsedNote } from "./types.js";

const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".avif",
  ".bmp",
  ".ico",
]);

/** Whether a wikilink/embed target looks like an image file. */
export function isImageTarget(target: string): boolean {
  const clean = target.split("#")[0]?.split("|")[0]?.trim() ?? "";
  return IMAGE_EXT.has(path.posix.extname(clean).toLowerCase());
}

/**
 * Build lookup maps for Obsidian shortest-path resolution.
 */
export function buildSlugIndex(notes: ParsedNote[]): {
  bySlug: Map<string, ParsedNote>;
  resolveTarget: (raw: string) => ParsedNote | undefined;
} {
  const bySlug = new Map<string, ParsedNote>();
  const byAlias = new Map<string, ParsedNote>();
  const byBasename = new Map<string, ParsedNote[]>();

  for (const note of notes) {
    bySlug.set(note.slug, note);
    bySlug.set(note.slug.toLowerCase(), note);

    const base = path.posix.basename(note.slug);
    const list = byBasename.get(base) ?? [];
    list.push(note);
    byBasename.set(base, list);
    byBasename.set(base.toLowerCase(), list);

    for (const alias of note.aliases) {
      byAlias.set(alias, note);
      byAlias.set(alias.toLowerCase(), note);
    }

    // Also index filename without folder for [[file]] style
    const fileBase = path.posix.basename(note.relativePath, ".md");
    if (fileBase !== base) {
      const fl = byBasename.get(fileBase) ?? [];
      fl.push(note);
      byBasename.set(fileBase, fl);
      byBasename.set(fileBase.toLowerCase(), fl);
    }
  }

  /** Resolve a raw OFM path (no alias/fragment) to a note. */
  const resolveTarget = (raw: string): ParsedNote | undefined => {
    const target = raw.trim();
    if (!target) return undefined;

    // Exact slug
    const exact = bySlug.get(target) ?? bySlug.get(target.toLowerCase());
    if (exact) return exact;

    // Alias
    const aliased = byAlias.get(target) ?? byAlias.get(target.toLowerCase());
    if (aliased) return aliased;

    // Strip .md if present
    const withoutMd = target.replace(/\.md$/i, "");
    const asSlug = bySlug.get(withoutMd) ?? bySlug.get(withoutMd.toLowerCase());
    if (asSlug) return asSlug;

    // Shortest-path: match by basename, prefer shortest slug
    const base = path.posix.basename(withoutMd);
    const candidates =
      byBasename.get(base) ?? byBasename.get(base.toLowerCase()) ?? [];
    if (candidates.length === 0) return undefined;
    return [...candidates].sort((a, b) => a.slug.length - b.slug.length)[0];
  };

  return { bySlug, resolveTarget };
}

/**
 * Build an asset path index: basename → vault-relative asset path (posix).
 */
export function buildAssetIndex(assetPaths: string[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const rel of assetPaths) {
    const posix = rel.split(path.sep).join("/");
    const base = path.posix.basename(posix);
    // First wins; later duplicates ignored (Obsidian ambiguity)
    if (!index.has(base)) index.set(base, posix);
    if (!index.has(base.toLowerCase())) index.set(base.toLowerCase(), posix);
    // Also index without folder prefix for assets/images/foo.webp lookups
    if (!index.has(posix)) index.set(posix, posix);
  }
  return index;
}

/** Resolve an image embed target to a vault-relative asset path. */
export function resolveAssetPath(
  target: string,
  assetIndex: Map<string, string>,
): string | undefined {
  const clean = target.split("#")[0]?.split("|")[0]?.trim() ?? "";
  if (!clean) return undefined;
  if (clean.startsWith("http://") || clean.startsWith("https://")) return clean;

  const normalized = clean.replace(/^\.\.\//, "").replace(/^\.\//, "");
  return (
    assetIndex.get(normalized) ??
    assetIndex.get(normalized.toLowerCase()) ??
    assetIndex.get(path.posix.basename(normalized)) ??
    assetIndex.get(path.posix.basename(normalized).toLowerCase())
  );
}

/** Join assetBaseUrl with a vault-relative asset path into a public URL. */
export function toAssetUrl(assetBaseUrl: string, assetPath: string): string {
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
    return assetPath;
  }
  const clean = assetPath.replace(/^\//, "");
  const base = assetBaseUrl.replace(/\/$/, "");
  if (!base) return `/${clean}`;
  return `${base}/${clean}`;
}
