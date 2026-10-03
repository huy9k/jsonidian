import path from "node:path";
import { globby } from "globby";
import type { BuildOptions, BuildResult, PageJson } from "./types.js";
import { scanMarkdownFiles, resolveIgnore } from "./scan.js";
import { defaultPublish, parseNoteFile } from "./parse.js";
import { buildSlugIndex, buildAssetIndex } from "./resolve.js";
import { expandNoteEmbeds } from "./embeds.js";
import {
  markdownToHast,
  extractToc,
  extractInternalLinks,
  absolutizeImages,
  rewriteFrontmatterAssets,
  hastToPlainText,
} from "./ofm.js";
import {
  prepareOutDir,
  writePageJson,
  writeFolderIndexes,
  copyAssets,
} from "./emit.js";

export type {
  BuildOptions,
  BuildResult,
  PageJson,
  IndexEntry,
  TocEntry,
  PublishPredicate,
} from "./types.js";

/**
 * Compile an Obsidian vault into static JSON pages, folder indexes, and assets.
 */
export async function build(opts: BuildOptions): Promise<BuildResult> {
  const contentDir = path.resolve(opts.contentDir);
  const outDir = path.resolve(opts.outDir);
  const assetBaseUrl = opts.assetBaseUrl ?? "";
  const embedDepth = opts.embedDepth ?? 3;
  const publish = opts.publish ?? defaultPublish;
  const ignore = resolveIgnore(opts);

  const relativeMarkdown = await scanMarkdownFiles(contentDir, ignore);
  const notes = await Promise.all(
    relativeMarkdown.map((rel) => parseNoteFile(contentDir, rel, publish)),
  );

  const { resolveTarget } = buildSlugIndex(notes);
  const published = notes.filter((n) => n.published);

  const assetRelativePaths = await globby(["assets/**/*"], {
    cwd: contentDir,
    onlyFiles: true,
    followSymbolicLinks: false,
  });
  const assetPosix = assetRelativePaths.map((f) => f.split(path.sep).join("/"));
  const assetIndex = buildAssetIndex(assetPosix);

  await prepareOutDir(outDir);

  const pages: PageJson[] = [];

  for (const note of published) {
    const expandedBody = expandNoteEmbeds(
      note.body,
      resolveTarget,
      embedDepth,
    );

    const htmlAst = await markdownToHast(expandedBody, {
      resolveTarget,
      assetIndex,
      assetBaseUrl,
    });

    absolutizeImages(htmlAst, assetIndex, assetBaseUrl);

    const frontmatter = rewriteFrontmatterAssets(
      note.frontmatter,
      assetIndex,
      assetBaseUrl,
    );

    const description =
      typeof frontmatter.description === "string"
        ? frontmatter.description
        : typeof frontmatter.socialDescription === "string"
          ? frontmatter.socialDescription
          : undefined;

    const page: PageJson = {
      slug: note.slug,
      relativePath: note.relativePath,
      aliases: note.aliases,
      frontmatter,
      description,
      toc: extractToc(htmlAst),
      links: extractInternalLinks(htmlAst),
      htmlAst,
      text: hastToPlainText(htmlAst),
    };

    await writePageJson(outDir, page);
    pages.push(page);
  }

  const indexes = await writeFolderIndexes(outDir, pages);
  const assets = await copyAssets(contentDir, outDir, assetPosix);

  return {
    pages: pages.length,
    indexes,
    assets,
    outDir,
  };
}
