import type { InferenceRuntime, RuntimeStatus } from "./types.ts";
import type { OnnxModelConfig, OnnxRuntimeOptions } from "./preprocessing.ts";
import { resolveLabels, type ResolvedModelConfig } from "./onnxSession.ts";

type WorkerRequest =
  | { type: "load"; model: string; config: ResolvedModelConfig; cache: boolean }
  | { type: "infer"; imageData: ImageData }
  | { type: "dispose" };

type WorkerResponse =
  | { type: "loaded"; backend: "webgpu" | "wasm"; loadMs: number }
  | { type: "result"; output: unknown; duration: number }
  | { type: "error"; message: string };

const decodeToImageData = async (input: unknown): Promise<ImageData> => {
  let bitmap: ImageBitmap;
  if (typeof input === "string") {
    const response = await fetch(input);
    if (!response.ok) throw new Error(`failed to fetch image: ${response.status}`);
    bitmap = await createImageBitmap(await response.blob());
  } else if (input instanceof ImageBitmap) {
    bitmap = input;
  } else if (input instanceof ImageData) {
    return input;
  } else {
    throw new Error("unsupported input: expected image URL, ImageBitmap, or ImageData");
  }

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas 2d context unavailable");
  context.drawImage(bitmap, 0, 0);
  const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  return imageData;
};

/**
 * Model-agnostic ONNX Runtime execution via a Web Worker. Models are
 * interchangeable: swap `models` configs (URL, sha256, labels, preprocessing)
 * without touching anything else.
 */
export function createOnnxRuntime(options: OnnxRuntimeOptions): InferenceRuntime {
  const byName = new Map<string, OnnxModelConfig>(options.models.map((model) => [model.name, model]));
  const cache = options.cache ?? true;

  let worker: Worker | null = null;
  let currentModel: string | null = null;
  let status: RuntimeStatus | null = null;
  let pendingLoad: { resolve: () => void; reject: (error: Error) => void } | null = null;
  let pendingResult: {
    resolve: (result: { output: unknown; duration: number }) => void;
    reject: (error: Error) => void;
  } | null = null;

  const failPending = (error: Error) => {
    pendingLoad?.reject(error);
    pendingLoad = null;
    pendingResult?.reject(error);
    pendingResult = null;
  };

  const ensureWorker = (): Worker => {
    if (worker) return worker;
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      switch (event.data.type) {
        case "loaded":
          status = { model: currentModel ?? "", backend: event.data.backend, loadMs: event.data.loadMs };
          pendingLoad?.resolve();
          pendingLoad = null;
          break;
        case "result":
          pendingResult?.resolve({ output: event.data.output, duration: event.data.duration });
          pendingResult = null;
          break;
        case "error":
          failPending(new Error(event.data.message));
          break;
      }
    };
    worker.onerror = (event) => {
      failPending(new Error(event.message));
    };
    return worker;
  };

  return {
    get id() {
      return "onnxruntime-web";
    },
    get status() {
      return status;
    },
    async load(model: string): Promise<void> {
      const config = byName.get(model);
      if (!config) throw new Error(`unknown model: ${model}`);
      const labels = await resolveLabels(config.labels);
      const resolved: ResolvedModelConfig = {
        name: config.name,
        modelUrl: config.modelUrl,
        sha256: config.sha256,
        labels,
        preprocessing: config.preprocessing,
        backend: config.backend ?? "auto",
      };
      currentModel = model;
      const target = ensureWorker();
      const promise = new Promise<void>((resolve, reject) => {
        pendingLoad = { resolve, reject };
      });
      const request: WorkerRequest = { type: "load", model, config: resolved, cache };
      target.postMessage(request);
      await promise;
    },
    async infer(input: unknown): Promise<{ output: unknown; duration: number }> {
      if (!worker || currentModel === null) throw new Error("model not loaded — call load() first");
      const imageData = await decodeToImageData(input);
      const promise = new Promise<{ output: unknown; duration: number }>((resolve, reject) => {
        pendingResult = { resolve, reject };
      });
      const request: WorkerRequest = { type: "infer", imageData };
      worker.postMessage(request, [imageData.data.buffer]);
      return promise;
    },
    dispose(): Promise<void> {
      const request: WorkerRequest = { type: "dispose" };
      worker?.postMessage(request);
      worker?.terminate();
      worker = null;
      currentModel = null;
      status = null;
      return Promise.resolve();
    },
  };
}
