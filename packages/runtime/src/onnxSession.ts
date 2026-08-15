import * as ort from "onnxruntime-web";
import type { ModelPreprocessingConfig, OnnxModelConfig } from "./preprocessing.ts";
import { preprocessToTensor, softmax, topk } from "./preprocessing.ts";
import type { ClassificationOutput } from "./types.ts";

declare global {
  interface Navigator {
    gpu?: {
      requestAdapter?: () => Promise<unknown>;
    };
  }
}

export interface ResolvedModelConfig {
  name: string;
  modelUrl: string;
  sha256?: string;
  labels: string[];
  preprocessing: ModelPreprocessingConfig;
  backend: "webgpu" | "wasm" | "auto";
  /** Preloaded model bytes; skips fetching (used in tests and embedders). */
  modelBytes?: ArrayBuffer;
}

export interface OnnxInference {
  output: ClassificationOutput;
  duration: number;
}

export interface OnnxSessionHandle {
  backend: "webgpu" | "wasm";
  loadMs: number;
  infer(input: ImageData): Promise<OnnxInference>;
  dispose(): Promise<void>;
}

const hexDigest = async (bytes: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const fetchWithCache = async (url: string, cache: boolean): Promise<ArrayBuffer> => {
  if (cache && typeof caches !== "undefined") {
    const store = await caches.open("murmur-models");
    const cached = await store.match(url);
    if (cached) return cached.arrayBuffer();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`failed to fetch model: ${response.status}`);
    const buffer = await response.arrayBuffer();
    await store.put(url, new Response(buffer));
    return buffer;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`failed to fetch model: ${response.status}`);
  return response.arrayBuffer();
};

export const resolveLabels = async (labels: OnnxModelConfig["labels"]): Promise<string[]> => {
  if (typeof labels === "function") return labels();
  return labels;
};

export async function verifySha256(bytes: ArrayBuffer, expected: string): Promise<void> {
  const actual = await hexDigest(bytes);
  if (actual !== expected.toLowerCase()) {
    throw new Error(`model integrity check failed: expected ${expected}, got ${actual}`);
  }
}

const prefersWebgpu = (backend: ResolvedModelConfig["backend"]): boolean =>
  backend === "webgpu" ||
  (backend === "auto" &&
    typeof navigator !== "undefined" &&
    navigator.gpu !== undefined &&
    "requestAdapter" in navigator.gpu);

/**
 * Loads an ONNX session and runs inference. Runs inside the Web Worker in
 * browsers; used directly in Node tests.
 */
export async function createOnnxSession(
  config: ResolvedModelConfig,
  cache: boolean,
  onProgress?: (message: string) => void,
): Promise<OnnxSessionHandle> {
  const started = performance.now();
  onProgress?.("fetching model");
  const bytes = config.modelBytes ?? (await fetchWithCache(config.modelUrl, cache));
  onProgress?.("verifying sha256");
  if (config.sha256) await verifySha256(bytes, config.sha256);

  const useWebgpu = prefersWebgpu(config.backend);
  onProgress?.("creating session (" + (useWebgpu ? "webgpu+wasm" : "wasm") + ")");
  const session = await ort.InferenceSession.create(bytes, {
    executionProviders: useWebgpu ? ["webgpu", "wasm"] : ["wasm"],
  });
  onProgress?.("session ready");

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  if (!inputName || !outputName) throw new Error("model has no input/output tensors");

  return {
    backend: useWebgpu ? ("webgpu" as const) : ("wasm" as const),
    loadMs: Math.round(performance.now() - started),
    async infer(input: ImageData): Promise<OnnxInference> {
      const startedRun = performance.now();
      const tensor = preprocessToTensor(input.data, input.width, input.height, config.preprocessing);
      const feeds: Record<string, ort.Tensor> = {
        [inputName]: new ort.Tensor("float32", tensor, [1, 3, config.preprocessing.width, config.preprocessing.height]),
      };
      const results = await session.run(feeds);
      const output = results[outputName];
      if (!output) throw new Error(`model produced no output named ${outputName}`);
      const logits = output.data as Float32Array;
      const probabilities = softmax(logits);
      const top = topk(probabilities, config.labels, 1);
      const winner = top[0];
      if (!winner) throw new Error("model produced no output");
      return {
        output: { label: winner.label, score: winner.score },
        duration: Math.round(performance.now() - startedRun),
      };
    },
    async dispose(): Promise<void> {
      await session.release();
    },
  };
}
