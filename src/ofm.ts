import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import { remarkOfm, rehypeOfm } from "mdian";
import { toText } from "hast-util-to-text";
import { visit } from "unist-util-visit";
import type {
  Root as HastRoot,
  Element,
  ElementContent,
  Properties,
} from "hast";
import type { TocEntry } from "./types.js";
import type { ParsedNote } from "./types.js";
import {
  isImageTarget,
  resolveAssetPath,
  toAssetUrl,
} from "./resolve.js";

/** A raw HTML fragment; remark-rehype emits these when `allowDangerousHtml` is on. */
type RawFragment = { type: "raw"; value: string };

/** A `src="…"` / `src='…'` attribute in a raw HTML fragment. Capture 3 is the URL. */
const RAW_SRC_ATTR_RE = /(\bsrc\s*=\s*)(["'])(.*?)\2/gi;

type OfmContext = {
  resolveTarget: (raw: string) => ParsedNote | undefined;
  assetIndex: Map<string, string>;
  assetBaseUrl: string;
};

/** Normalize hast className property into a string array. */
function classList(props: Properties | undefined): string[] {
  const className = props?.className;
  if (Array.isArray(className)) return className.map(String);
  if (className == null) return [];
  return String(className).split(/\s+/).filter(Boolean);
}

/**
 * Transform markdown body to HAST with Obsidian Flavored Markdown support.
 */
export async function markdownToHast(
  markdown: string,
  ctx: OfmContext,
): Promise<HastRoot> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkOfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeOfm, {
      resolvePathCandidates: (rawPath: string) => {
        if (isImageTarget(rawPath)) {
          const asset = resolveAssetPath(rawPath, ctx.assetIndex);
          return asset ? [asset] : [];
        }
        const note = ctx.resolveTarget(rawPath);
        return note ? [note.slug] : [];
      },
      resolveHref: (href: string) => {
        if (href.startsWith("#") || href.startsWith("http")) return href;
        // mdian may pass path or already-slugged path
        const [pathPart, hash] = href.split("#");
        const note = ctx.resolveTarget(pathPart ?? href);
        if (!note) return href;
        const base = `/${note.slug}`;
        return hash ? `${base}#${hash}` : base;
      },
      resolveResourceUrl: (url: string) => {
        if (url.startsWith("http://") || url.startsWith("https://")) return url;
        const asset = resolveAssetPath(url, ctx.assetIndex);
        if (!asset) return url;
        return toAssetUrl(ctx.assetBaseUrl, asset);
      },
      externalEmbeds: { youtube: false, twitter: false },
    });

  const mdast = processor.parse(markdown);
  const tree = (await processor.run(mdast)) as HastRoot;
  normalizeInternalLinks(tree);
  return tree;
}

/**
 * Add Quartz-compatible `internal` class on OFM wikilinks for existing renderers.
 */
function normalizeInternalLinks(tree: HastRoot): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "a") return;
    const props = node.properties ?? {};
    const classes = classList(props);

    const kind = props["dataOfmKind"] ?? props["data-ofm-kind"];
    const isOfm =
      kind === "wikilink" ||
      classes.includes("ofm-wikilink") ||
      classes.some((c: string) => c.includes("ofm-wikilink"));

    if (isOfm && !classes.includes("internal")) {
      classes.push("internal");
      props.className = classes;
      node.properties = props;
    }
  });
}

/** Extract TOC from heading elements with ids. */
export function extractToc(tree: HastRoot): TocEntry[] {
  const toc: TocEntry[] = [];
  visit(tree, "element", (node: Element) => {
    if (!/^h[1-6]$/.test(node.tagName)) return;
    const depth = Number(node.tagName[1]) - 1;
    const slug = String(node.properties?.id ?? "");
    const text = headingText(node);
    if (!text) return;
    toc.push({ depth, text, slug });
  });
  return toc;
}

function headingText(node: Element): string {
  const withoutAnchors: ElementContent[] = (node.children ?? []).filter(
    (child) => {
      if (child.type !== "element" || child.tagName !== "a") return true;
      const role = child.properties?.role;
      const ariaHidden =
        child.properties?.ariaHidden ?? child.properties?.["aria-hidden"];
      return role !== "anchor" && ariaHidden !== true && ariaHidden !== "true";
    },
  );
  return toText({
    type: "element",
    tagName: "span",
    properties: {},
    children: withoutAnchors,
  });
}

/** Collect resolved internal link slugs from the HAST tree. */
export function extractInternalLinks(tree: HastRoot): string[] {
  const links = new Set<string>();
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "a") return;
    const props = node.properties ?? {};
    const classes = classList(props);
    const href = String(props.href ?? "");
    if (
      !href ||
      href.startsWith("http") ||
      href.startsWith("#") ||
      href.startsWith("mailto:")
    ) {
      return;
    }
    const isInternal =
      classes.includes("internal") ||
      classes.includes("ofm-wikilink") ||
      props["data-ofm-kind"] === "wikilink" ||
      props["dataOfmKind"] === "wikilink";
    if (!isInternal) return;
    const slug = href.replace(/^\//, "").split("#")[0];
    if (slug) links.add(slug);
  });
  return [...links];
}

/**
 * Absolute-ize every relative image `src` — both parsed `<img>` elements and
 * hand-written `<img>` tags that survive inside raw HTML fragments, which
 * element traversal never sees (e.g. an image wrapped in an inline link).
 */
export function absolutizeImages(
  tree: HastRoot,
  assetIndex: Map<string, string>,
  assetBaseUrl: string,
): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "img") return;
    const props = node.properties ?? {};
    const src = String(props.src ?? "");
    if (!src || src.startsWith("http") || src.startsWith("data:")) return;
    const asset = resolveAssetPath(src, assetIndex);
    if (asset) {
      props.src = toAssetUrl(assetBaseUrl, asset);
      node.properties = props;
    }
  });

  visit(tree, "raw", (node) => {
    const raw = node as RawFragment;
    raw.value = absolutizeRawAssets(raw.value, assetIndex, assetBaseUrl);
  });
}

/** Rewrite known relative asset `src` attributes inside a raw HTML fragment. */
function absolutizeRawAssets(
  value: string,
  assetIndex: Map<string, string>,
  assetBaseUrl: string,
): string {
  return value.replace(RAW_SRC_ATTR_RE, (match, prefix, quote, url) => {
    const asset = resolveAssetPath(url, assetIndex);
    if (!asset) return match;
    return `${prefix}${quote}${toAssetUrl(assetBaseUrl, asset)}${quote}`;
  });
}

/** Rewrite known image frontmatter keys to absolute asset URLs. */
export function rewriteFrontmatterAssets(
  frontmatter: Record<string, unknown>,
  assetIndex: Map<string, string>,
  assetBaseUrl: string,
): Record<string, unknown> {
  const keys = ["cover_img_url", "socialImage", "image", "cover"];
  const next = { ...frontmatter };
  for (const key of keys) {
    const value = next[key];
    if (typeof value !== "string" || !value) continue;
    if (value.startsWith("http")) continue;
    const asset = resolveAssetPath(value, assetIndex);
    if (asset) next[key] = toAssetUrl(assetBaseUrl, asset);
  }
  return next;
}

/** Plain text extraction from HAST. */
export function hastToPlainText(tree: HastRoot): string {
  return toText(tree);
}
