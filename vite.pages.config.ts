import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-course-data-to-pages-root",
      async closeBundle() {
        await Promise.all([
          copyFile("public/data/electives.json.gz", "pages-dist/electives.json.gz"),
          copyFile("public/data/electives.json", "pages-dist/electives.json"),
        ]);
      },
    },
  ],
  base: "./",
  publicDir: "public",
  build: {
    outDir: "pages-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve("index.html"),
        about: resolve("about.html"),
      },
      output: { entryFileNames: "[name]-[hash].js", assetFileNames: "[name]-[hash][extname]" },
    },
  },
});
