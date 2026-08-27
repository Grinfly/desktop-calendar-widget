import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const dir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dir, "../..");

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(dir, "index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    outDir: path.resolve(rootDir, "dist-extensions/lunar"),
    emptyOutDir: true,
    minify: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
