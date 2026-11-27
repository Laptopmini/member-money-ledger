import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: { usePolling: true }, // file events don't reach the container from Windows drives
    proxy: { "/api": process.env.API_URL ?? "http://api:8000" },
  },
});
