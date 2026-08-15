export interface InferenceRuntime {
  readonly id: string;
  load(model: string): Promise<void>;
  infer(input: unknown): Promise<{ output: unknown; duration: number }>;
  dispose(): Promise<void>;
}

const hashString = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

export class MockRuntime implements InferenceRuntime {
  readonly id = "mock";

  constructor(private readonly salt = Math.random().toString(36).slice(2, 10)) {}

  async load(): Promise<void> {
    await new Promise((r) => setTimeout(r, 50));
  }

  async infer(input: unknown): Promise<{ output: unknown; duration: number }> {
    await Promise.resolve();
    const started = performance.now();
    const serialized = this.salt + ":" + JSON.stringify(input);
    const h = hashString(serialized);
    const noise = ((h >> 16) & 0xff) / 255;
    const score = Math.max(0.02, Math.min(0.98, noise));
    const duration = 40 + (h % 180);
    const elapsed = Math.max(duration, performance.now() - started);
    return { output: score, duration: elapsed };
  }

  async dispose(): Promise<void> {}
}
