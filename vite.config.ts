import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    host: "0.0.0.0",
    allowedHosts: [".e2b.app", "localhost"],
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  },
  preview: { host: "0.0.0.0", allowedHosts: [".e2b.app", "localhost"] },
});
