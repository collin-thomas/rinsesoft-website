import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:8081",
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  webServer: {
    command: "bascik --server --host 127.0.0.1 --port 8081",
    url: "http://127.0.0.1:8081",
  },
});
