import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

export default defineConfig({
  ...config,
  testDir: "./tests/hydration",
  use: {
    ...config.use,
    baseURL: "http://localhost:3000",
    serviceWorkers: "block",
  },
  webServer: {
    command: "pnpm dev --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
