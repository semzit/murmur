import { createMurmurServer } from "@murmur/server";
import type { ModelMetadata } from "@murmur/core";

const moderationModel: ModelMetadata = {
  name: "moderation-v1",
  version: "1.0.0",
  format: "mock",
  size: 0,
  sha256: "0000000000000000000000000000000000000000000000000000000000000000",
  runtime: "mock",
  aggregation: {
    strategy: "mean",
    requiredWorkers: 3,
    threshold: 0.5,
    lowerLabel: "safe",
    upperLabel: "unsafe",
    tolerance: 0.1,
  },
};

const port = Number(process.env.MURMUR_PORT ?? 8787);

const server = createMurmurServer({
  port,
  models: [moderationModel],
});

await server.start();
console.log(`Murmur coordinator listening on ws://localhost:${port}`);
console.log(
  `Model: ${moderationModel.name} v${moderationModel.version} (mean aggregation, threshold ${moderationModel.aggregation.threshold})`,
);
