import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const onnxRuntimeWebDist = dirname(
  require.resolve("onnxruntime-web", {
    paths: [fileURLToPath(new URL("../../packages/runtime", import.meta.url))],
  }),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@murmur/core",
        replacement: fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      },
      {
        find: "@murmur/client",
        replacement: fileURLToPath(new URL("../../packages/client/src/index.ts", import.meta.url)),
      },
      {
        find: "@murmur/react",
        replacement: fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url)),
      },
      {
        find: "@murmur/server",
        replacement: fileURLToPath(new URL("../../packages/server/src/index.ts", import.meta.url)),
      },
      {
        find: "@murmur/runtime",
        replacement: fileURLToPath(new URL("../../packages/runtime/src/index.ts", import.meta.url)),
      },
      {
        // Bypass the dep optimizer for ort (worker imports + wasm loading are
        // finicky with pre-bundling) and point straight at its ESM build.
        find: "onnxruntime-web",
        replacement: join(onnxRuntimeWebDist, "ort.min.mjs"),
      },
    ],
  },
  publicDir: "public",
  optimizeDeps: {
    // onnxruntime-web's pre-bundled (CJS-interop) output breaks inside the
    // inference worker; exclude it so the raw ESM build is used everywhere.
    exclude: ["onnxruntime-web"],
  },
  server: {
    port: 5173,
  },
});
