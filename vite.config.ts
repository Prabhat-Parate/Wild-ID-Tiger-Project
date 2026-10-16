import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const port = env.PORT || env.BACKEND_PORT || "8000";
  return {
  plugins: [react(), tailwind()],
  server: {
    host: "0.0.0.0",
    allowedHosts: [".e2b.app", "localhost"],
    proxy: { "/api": { target: `http://127.0.0.1:${port}`, changeOrigin: true } },
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  },
  preview: { host: "0.0.0.0", allowedHosts: [".e2b.app", "localhost"] },
};
});
