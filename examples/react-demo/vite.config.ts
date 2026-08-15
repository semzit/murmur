import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@murmur/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@murmur/client": fileURLToPath(new URL("../../packages/client/src/index.ts", import.meta.url)),
      "@murmur/react": fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url)),
      "@murmur/server": fileURLToPath(new URL("../../packages/server/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
