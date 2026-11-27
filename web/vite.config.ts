import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Date handling must not depend on the machine's zone (trap 4): run tests in a UTC-negative zone.
process.env.TZ = "America/Los_Angeles";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    env: { TZ: "America/Los_Angeles" },
    css: false,
  },
  server: {
    port: 5173,
    watch: { usePolling: true }, // file events don't reach the container from Windows drives
    proxy: {
      "/api": process.env.API_URL ?? "http://api:8000",
      // OFREP feature flags from flagd; the prefix is stripped, matching the prod Caddyfile.
      "/flags": {
        target: process.env.FLAGD_URL ?? "http://flagd:8016",
        rewrite: (path) => path.replace(/^\/flags/, ""),
      },
    },
  },
});
