import type { GraphEdge, GraphJson, GraphNode, PageJson } from "./types.js";

/** A note's display label: its `title`, falling back to the slug. */
function titleOf(page: PageJson): string {
  const title = page.frontmatter.title;
  return typeof title === "string" && title.length > 0 ? title : page.slug;
}

/** A note's tags, dropping non-strings and empty entries. */
function tagsOf(page: PageJson): string[] {
  const tags = page.frontmatter.tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter(
    (tag): tag is string => typeof tag === "string" && tag.length > 0,
  );
}

/** Order-independent key, so A→B and B→A collapse to one edge. */
function edgeKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/**
 * Derive the vault-wide link graph from every published page's outgoing links.
 * Edges are undirected and deduped; a self-link or a link to an unpublished
 * note (no node to land on) is dropped. Backlinks need no pass — a consumer
 * inverts `edges` once for both directions of a local-graph walk.
 */
export function buildGraph(pages: PageJson[]): GraphJson {
  const slugs = new Set(pages.map((page) => page.slug));
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    for (const target of page.links) {
      if (target === page.slug || !slugs.has(target)) continue;
      const key = edgeKey(page.slug, target);
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: page.slug, target });
    }
  }

  const degree = new Map<string, number>();
  for (const { source, target } of edges) {
    degree.set(source, (degree.get(source) ?? 0) + 1);
    degree.set(target, (degree.get(target) ?? 0) + 1);
  }

  const nodes: GraphNode[] = pages
    .map((page) => ({
      slug: page.slug,
      title: titleOf(page),
      tags: tagsOf(page),
      degree: degree.get(page.slug) ?? 0,
    }))
    .sort((a, b) => (a.slug < b.slug ? -1 : 1));

  edges.sort((a, b) => (edgeKey(a.source, a.target) < edgeKey(b.source, b.target) ? -1 : 1));

  return { nodes, edges };
}
