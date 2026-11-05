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
    exec: [
      { script: "scripts/llms-txt.ts", phase: "post" },
      {
        script: "scripts/og-images.ts",
        phase: "post",
        watch: ["src/pages/", "src/components/", "src/lib/social-image.ts", "scripts/og-images.ts", "scripts/og-content.ts"],
      },
    ],
  },
});
