import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_URL = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 3000,
    strictPort: true,
    // Same-origin in dev: cookies "just work", no CORS.
    proxy: { "/api": { target: API_URL, changeOrigin: false } },
  },
  preview: { port: 3000, proxy: { "/api": { target: API_URL } } },
});
