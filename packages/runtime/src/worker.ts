import type { ResolvedModelConfig } from "./onnxSession.ts";
import { createOnnxSession } from "./onnxSession.ts";

let session: Awaited<ReturnType<typeof createOnnxSession>> | null = null;

type WorkerRequest =
  | { type: "load"; model: string; config: ResolvedModelConfig; cache: boolean }
  | { type: "infer"; imageData: ImageData }
  | { type: "dispose" };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    switch (request.type) {
      case "load": {
        session = await createOnnxSession(request.config, request.cache);
        postMessage({ type: "loaded", model: request.model, backend: session.backend, loadMs: session.loadMs });
        break;
      }
      case "infer": {
        if (!session) throw new Error("model not loaded");
        const result = await session.infer(request.imageData);
        postMessage({ type: "result", output: result.output, duration: result.duration });
        break;
      }
      case "dispose": {
        await session?.dispose();
        session = null;
        break;
      }
    }
  } catch (error) {
    postMessage({ type: "error", message: error instanceof Error ? error.message : "worker error" });
  }
};
