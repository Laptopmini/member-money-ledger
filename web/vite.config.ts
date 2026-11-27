import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
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
