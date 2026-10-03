import { cac } from "cac";
import pkg from "../package.json";
import { build } from "./index.js";

const cli = cac("jsonidian");

cli
  .command("build", "Compile an Obsidian vault to static JSON + assets")
  .option("--content <dir>", "Vault / content directory", {
    default: "content",
  })
  .option("--out <dir>", "Output directory", { default: "public" })
  .option("--asset-base-url <url>", "Prefix for asset URLs", { default: "" })
  .option("--embed-depth <n>", "Max note-embed recursion depth", {
    default: "3",
  })
  .action(
    async (options: {
      content: string;
      out: string;
      assetBaseUrl: string;
      embedDepth: string;
    }) => {
      const result = await build({
        contentDir: options.content,
        outDir: options.out,
        assetBaseUrl: options.assetBaseUrl,
        embedDepth: Number(options.embedDepth) || 3,
      });
      console.log(
        `jsonidian: wrote ${result.pages} pages, ${result.indexes} indexes, ${result.assets} assets → ${result.outDir}`,
      );
    },
  );

cli.help();
cli.version(pkg.version);

cli.parse();
