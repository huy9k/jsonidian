import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node20",
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    target: "node20",
    sourcemap: true,
    banner: { js: "#!/usr/bin/env node" },
  },
]);
