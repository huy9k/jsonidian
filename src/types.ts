import type { Root } from "hast";

/** Table of contents entry derived from headings. */
export type TocEntry = {
  depth: number;
  text: string;
  slug: string;
};

/** Per-page JSON emitted for each published note. */
export type PageJson = {
  slug: string;
  relativePath: string;
  aliases: string[];
  frontmatter: Record<string, unknown>;
  description?: string;
  toc: TocEntry[];
  links: string[];
  htmlAst: Root;
  text: string;
};

/** Folder discovery entry (slug + frontmatter only). */
export type IndexEntry = {
  slug: string;
  frontmatter: Record<string, unknown>;
};

/** One node in the vault-wide link graph. */
export type GraphNode = {
  slug: string;
  title: string;
  tags: string[];
  /** Undirected link count, precomputed so a consumer never recounts. */
  degree: number;
};

/** One undirected link between two notes, by slug. */
export type GraphEdge = { source: string; target: string };

/** The vault-wide link graph, emitted as `_graph.json`. */
export type GraphJson = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

/** A parsed note, before its markdown is rendered to HAST. */
export type ParsedNote = {
  absolutePath: string;
  relativePath: string;
  slug: string;
  frontmatter: Record<string, unknown>;
  aliases: string[];
  body: string;
  published: boolean;
};

/** Predicate for whether a note should be published. */
export type PublishPredicate = (
  frontmatter: Record<string, unknown>,
  relativePath: string,
) => boolean;

/** Options for `build()`. */
export type BuildOptions = {
  /** Absolute or cwd-relative path to the Obsidian vault root. */
  contentDir: string;
  /** Absolute or cwd-relative path for JSON + assets output. */
  outDir: string;
  /**
   * Prefix for asset URLs in HTML and frontmatter cover fields.
   * Examples: `"https://cmsstatic.example.com"` or `""` for root-relative `/assets/...`.
   */
  assetBaseUrl?: string;
  /** Extra ignore globs relative to contentDir (in addition to defaults). */
  ignore?: string[];
  /** Override publish filter. Default skips `draft: true` and `is_published: false`. */
  publish?: PublishPredicate;
  /** Max depth when inlining `![[note]]` embeds. Defaults to 3. */
  embedDepth?: number;
};

/** Result summary from a successful build. */
export type BuildResult = {
  pages: number;
  indexes: number;
  graph: { nodes: number; edges: number };
  assets: number;
  outDir: string;
};
