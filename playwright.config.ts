import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-fast",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
      },
    },
    {
      name: "mobile-slow",
      use: {
        ...devices["Pixel 5"],
        launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
      },
    },
  ],
});
