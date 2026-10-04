import { describe, expect, it } from "vitest";
import type { PageJson } from "./types.js";
import { buildGraph } from "./graph.js";

/** A published page carrying just the fields the graph reads. */
function page(
  slug: string,
  links: string[] = [],
  frontmatter: Record<string, unknown> = {},
): PageJson {
  return {
    slug,
    relativePath: `${slug}.md`,
    aliases: [],
    frontmatter,
    toc: [],
    links,
    htmlAst: { type: "root", children: [] },
    text: "",
  };
}

describe("buildGraph", () => {
  it("dedupes reciprocal links into one mutual edge", () => {
    const graph = buildGraph([page("a", ["b"]), page("b", ["a"])]);
    expect(graph.edges).toEqual([{ source: "a", target: "b", mutual: true }]);
  });

  it("keeps a one-way link's direction", () => {
    const graph = buildGraph([page("b", ["a"]), page("a", [])]);
    expect(graph.edges).toEqual([{ source: "b", target: "a", mutual: false }]);
  });

  it("drops self-links and links to unpublished notes", () => {
    const graph = buildGraph([page("a", ["a", "ghost", "b"]), page("b", [])]);
    expect(graph.edges).toEqual([{ source: "a", target: "b", mutual: false }]);
  });

  it("counts each node's degree over the undirected edges", () => {
    const graph = buildGraph([
      page("a", ["b", "c"]),
      page("b", ["c"]),
      page("c", []),
    ]);
    const degree = Object.fromEntries(
      graph.nodes.map((node) => [node.slug, node.degree]),
    );
    expect(degree).toEqual({ a: 2, b: 2, c: 2 });
  });

  it("labels by title (slug fallback) and keeps only real string tags", () => {
    const graph = buildGraph([
      page("a", [], { title: "Alpha", tags: ["x", null, "", "y"] }),
      page("b", []),
    ]);
    expect(graph.nodes).toEqual([
      { slug: "a", title: "Alpha", tags: ["x", "y"], degree: 0 },
      { slug: "b", title: "b", tags: [], degree: 0 },
    ]);
  });
});
