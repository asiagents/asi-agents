import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const themeRoot = path.resolve(root, "../shared/theme/Default/src");

export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(root, "../shared/theme/Default/public"),
  resolve: {
    alias: {
      "@theme": themeRoot,
      "@asi-api": path.resolve(root, "src/api.ts"),
      "@app-integrations": path.resolve(root, "src/components"),
      "@virtual-computer": path.resolve(root, "../../modules/virtual-computer"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
    fs: {
      allow: [root, themeRoot, path.resolve(root, "../../modules/virtual-computer")],
    },
    proxy: {
      "/health": "http://127.0.0.1:3445",
      "/registry": "http://127.0.0.1:3445",
      "/api": "http://127.0.0.1:3445",
      "/ctl": "http://127.0.0.1:3445",
      "/companion": "http://127.0.0.1:3445",
    },
  },
});
