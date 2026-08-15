import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
    server: {
      deps: {
        inline: [/@murmur\//],
      },
    },
  },
});
