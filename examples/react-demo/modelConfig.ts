import type { ModelMetadata } from "@murmur/core";

export const MODEL_SHA256 = "cc028fe6cae7bc11a4ff53cfc9b79c920e8be65ce33a904ec3e2a8f66d77f95f";
export const MODEL_SIZE = 3_655_033;

export const moderationModel: ModelMetadata = {
  name: "moderation-v1",
  version: "1.0.0",
  format: "onnx",
  size: MODEL_SIZE,
  sha256: MODEL_SHA256,
  runtime: "onnxruntime-web",
  aggregation: {
    strategy: "majority",
    requiredWorkers: 3,
  },
};
