# jsonidian

Compile an [Obsidian](https://obsidian.md) vault into **static JSON + assets** for SSG consumers (Next.js static export, etc.).

Author in Obsidian. Build once. Consume the JSON at your app's build time.

## Install

```bash
npm install jsonidian
```

## CLI

```bash
npx jsonidian build --content ./content --out ./public --asset-base-url ""
```

| Flag | Default | Description |
|------|---------|-------------|
| `--content` | `content` | Vault root |
| `--out` | `public` | Output directory |
| `--asset-base-url` | `""` | Prefix for asset URLs (`""` → `/assets/...`, or a CDN origin) |
| `--embed-depth` | `3` | Max recursion for `![[note]]` embeds |

## Library

```ts
import { build } from "jsonidian";

const result = await build({
  contentDir: "./content",
  outDir: "./public",
  assetBaseUrl: "https://cmsstatic.example.com",
});
```

## Output contract

**Page** — `{slug}.json`

```ts
type PageJson = {
  slug: string;
  relativePath: string;
  aliases: string[];
  frontmatter: Record<string, unknown>;
  description?: string;
  toc: { depth: number; text: string; slug: string }[];
  links: string[];
  htmlAst: import("hast").Root; // render with hast-util-to-jsx-runtime
  text: string;
};
```

**Folder index** — `{folder}/index.json` (e.g. `blog/index.json`). Root-level listing is `_index.json` so it does not overwrite the home page `index.json`.

```ts
type IndexEntry = { slug: string; frontmatter: Record<string, unknown> };
```

`blog/index.md` collapses to slug `blog` → `blog.json` (page body). Sibling posts are listed in `blog/index.json`.

**Assets** — `content/assets/**` copied to `{out}/assets/**`. Image `src` and common cover frontmatter fields are rewritten with `assetBaseUrl`.

**Publish filter** — skips `draft: true` and `is_published: false`.

## Obsidian features (v1)

- Wikilinks `[[note]]` / `[[note|alias]]` (shortest-path resolution)
- Image embeds `![[image.webp|400]]`
- Note embeds `![[other-note]]` (inlined at build)
- GFM (tables, strikethrough, task lists, …)
- Callouts / highlights / comments via [mdian](https://github.com/ngtrio/mdian)

## Thin content repo

```json
{
  "scripts": {
    "build": "jsonidian build --content content --out public"
  },
  "dependencies": {
    "jsonidian": "^0.1.0"
  }
}
```

Keep only `content/` in the vault repo. Point your Next.js (or other) site at the emitted JSON.

## License

MIT
