import { defineConfig } from "@playwright/test";

const COORDINATOR_PORT = 8787;
const WEB_PORT = 5173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
  },
  webServer: [
    {
      command: "pnpm exec tsx examples/react-demo/server.ts",
      url: `http://localhost:${COORDINATOR_PORT}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "pnpm --filter react-demo exec vite --host",
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
