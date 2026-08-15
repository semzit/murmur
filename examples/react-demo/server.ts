import { createMurmurServer } from "@murmur/server";
import { moderationModel } from "./modelConfig.ts";

const port = Number(process.env.MURMUR_PORT ?? 8787);

const server = createMurmurServer({
  port,
  models: [moderationModel],
});

await server.start();
console.log(`Murmur coordinator listening on ws://localhost:${port}`);
console.log(
  `Model: ${moderationModel.name} v${moderationModel.version} (${moderationModel.format}, ${(moderationModel.size / 1_000_000).toFixed(1)} MB, majority aggregation)`,
);
