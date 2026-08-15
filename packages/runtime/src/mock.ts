import type { InferenceRuntime } from "./types.ts";

const hashString = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

export class MockRuntime implements InferenceRuntime {
  readonly id = "mock";
  readonly status = null;
  private readonly salt: string;

  constructor(salt = Math.random().toString(36).slice(2, 10)) {
    this.salt = salt;
  }

  async load(_model: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  async infer(input: unknown): Promise<{ output: unknown; duration: number }> {
    await Promise.resolve();
    const started = performance.now();
    const serialized = this.salt + ":" + JSON.stringify(input);
    const h = hashString(serialized);
    const score = Math.max(0.02, Math.min(0.98, ((h >> 16) & 0xff) / 255));
    const duration = 40 + (h % 180);
    const elapsed = Math.max(duration, performance.now() - started);
    return {
      output: {
        label: score >= 0.5 ? "unsafe" : "safe",
        score,
      },
      duration: elapsed,
    };
  }

  async dispose(): Promise<void> {}
}
