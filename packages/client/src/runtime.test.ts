import { describe, expect, it } from "vitest";
import { MockRuntime } from "./runtime.ts";

describe("MockRuntime", () => {
  it("is deterministic for the same input and salt", async () => {
    const a = new MockRuntime("fixed-salt");
    const b = new MockRuntime("fixed-salt");
    const first = await a.infer({ url: "image://1" });
    const second = await b.infer({ url: "image://1" });
    expect(first.output).toBe(second.output);
    expect(first.duration).toBe(second.duration);
  });

  it("produces scores within [0.02, 0.98]", async () => {
    const runtime = new MockRuntime();
    for (let i = 0; i < 50; i++) {
      const { output } = await runtime.infer({ url: `image://${i}` });
      const score = Number(output);
      expect(score).toBeGreaterThanOrEqual(0.02);
      expect(score).toBeLessThanOrEqual(0.98);
    }
  });

  it("produces non-negative durations", async () => {
    const runtime = new MockRuntime();
    const { duration } = await runtime.infer({ url: "image://x" });
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it("returns its id", () => {
    expect(new MockRuntime().id).toBe("mock");
  });
});
