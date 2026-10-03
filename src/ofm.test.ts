import { describe, expect, it } from "vitest";
import { visit } from "unist-util-visit";
import type { Root } from "hast";
import { absolutizeImages, markdownToHast } from "./ofm.js";

const ASSET_BASE = "https://cdn.example.com";
const ASSET_INDEX = new Map([
  ["assets/images/pic.webp", "assets/images/pic.webp"],
]);

/** Render markdown, then apply asset absolutization, as `build()` does. */
async function render(markdown: string): Promise<Root> {
  const tree = await markdownToHast(markdown, {
    resolveTarget: () => undefined,
    assetIndex: ASSET_INDEX,
    assetBaseUrl: ASSET_BASE,
  });
  absolutizeImages(tree, ASSET_INDEX, ASSET_BASE);
  return tree;
}

/** Concatenate every raw HTML fragment in the tree. */
function rawHtml(tree: Root): string {
  let html = "";
  visit(tree, "raw", (node) => {
    html += node.value;
  });
  return html;
}

describe("absolutizeImages", () => {
  it("rewrites the src of an img inside a raw HTML link", async () => {
    const tree = await render(
      '<a href="https://instagram.com/p/x"><img src="assets/images/pic.webp" alt="x" /></a>',
    );
    expect(rawHtml(tree)).toContain(
      `src="${ASSET_BASE}/assets/images/pic.webp"`,
    );
  });

  it("rewrites a markdown image src", async () => {
    const tree = await render("![alt](assets/images/pic.webp)");
    let src = "";
    visit(tree, "element", (node) => {
      if (node.tagName === "img") src = String(node.properties?.src ?? "");
    });
    expect(src).toBe(`${ASSET_BASE}/assets/images/pic.webp`);
  });

  it("leaves an unknown relative src untouched", async () => {
    const tree = await render('<img src="assets/images/missing.webp" />');
    expect(rawHtml(tree)).toContain('src="assets/images/missing.webp"');
  });
});
