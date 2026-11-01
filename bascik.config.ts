import { defineConfig } from "@bascik/bascik/config";

export default defineConfig({
  assets: { inlineStyles: ["src/pages/css/styles.css"] },
  http: {
    cacheControl: {
      ".woff2": "public, max-age=2592000",
      ".webp": "public, max-age=2592000",
      ".svg": "public, max-age=2592000",
    },
  },
  pipeline: {
    watchPaths: ["src/lib/"],
    exec: [{ script: "scripts/llms-txt.ts", phase: "post" }],
  },
});
