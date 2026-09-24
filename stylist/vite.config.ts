import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@shared": r("./shared"), "@": r("./src") } },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
  optimizeDeps: { exclude: ["@huggingface/transformers", "@imgly/background-removal"] },
  build: {
    chunkSizeWarningLimit: 2500,
  },
});
