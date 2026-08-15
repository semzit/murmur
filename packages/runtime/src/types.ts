export type RuntimeBackend = "webgpu" | "wasm" | "mock";

export interface RuntimeStatus {
  model: string;
  backend: RuntimeBackend;
  loadMs: number;
}

export interface InferenceResult {
  output: unknown;
  duration: number;
}

export interface InferenceRuntime {
  readonly id: string;
  load(model: string): Promise<void>;
  infer(input: unknown): Promise<InferenceResult>;
  dispose(): Promise<void>;
  readonly status?: RuntimeStatus | null;
}

export interface ClassificationOutput {
  label: string;
  score: number;
}
