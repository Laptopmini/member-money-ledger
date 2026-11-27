import { defineConfig, devices } from "@playwright/test";

// E2E targets the prod profile (Caddy on :8081) by default. Tests mutate shared vendor
// state, so they run serially. Override with E2E_BASE_URL (e.g. http://localhost:5173).
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8081",
    storageState: "e2e/.auth/state.json",
    trace: "retain-on-failure",
    timezoneId: "UTC",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
