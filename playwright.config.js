import { defineConfig } from "@playwright/test";

delete process.env.NO_COLOR;

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 15_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm.cmd run serve",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
