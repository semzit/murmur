import { describe, expect, it } from "vitest";
import { aggregateNumbers, agreement, createAggregator, finalizeResult } from "./aggregators.ts";
import { newClientId, newTaskId } from "./ids.ts";
import type { AggregationConfig, InferenceResult } from "./schemas.ts";

const makeResults = (taskId: string, values: number[]): InferenceResult[] =>
  values.map((value, i) => ({
    taskId: taskId as unknown as InferenceResult["taskId"],
    clientId: newClientId(),
    model: "moderation-v1",
    output: value,
    duration: 100 + i,
  }));

describe("aggregateNumbers", () => {
  it("computes the mean", () => {
    expect(aggregateNumbers([1, 2, 3, 4], { strategy: "mean" })).toBe(2.5);
  });

  it("computes the median for odd and even lengths", () => {
    expect(aggregateNumbers([3, 1, 2], { strategy: "median" })).toBe(2);
    expect(aggregateNumbers([4, 1, 2, 3], { strategy: "median" })).toBe(2.5);
  });

  it("computes the trimmed mean", () => {
    expect(aggregateNumbers([0, 10, 10, 10, 100], { strategy: "trimmed_mean" })).toBe(10);
  });

  it("throws on empty input", () => {
    expect(() => aggregateNumbers([], { strategy: "mean" })).toThrow();
  });
});

describe("agreement", () => {
  it("returns the fraction of results within tolerance", () => {
    expect(agreement([0.42, 0.43, 0.9], 0.43, { strategy: "mean", tolerance: 0.1 })).toBeCloseTo(2 / 3);
  });

  it("returns 0 for empty input", () => {
    expect(agreement([], 0, { strategy: "mean" })).toBe(0);
  });
});

describe("finalizeResult", () => {
  const config: AggregationConfig = {
    strategy: "mean",
    threshold: 0.5,
    lowerLabel: "safe",
    upperLabel: "unsafe",
    tolerance: 0.1,
    requiredWorkers: 3,
  };

  it("aggregates outputs and derives a label", () => {
    const results = makeResults("task-1", [0.7, 0.8, 0.75]);
    const final = finalizeResult(config, results);
    expect(final.value).toBeCloseTo(0.75);
    expect(final.label).toBe("unsafe");
    expect(final.workers).toBe(3);
    expect(final.agreement).toBe(1);
  });

  it("labels below threshold as safe", () => {
    const final = finalizeResult(config, makeResults("task-2", [0.2, 0.3, 0.25]));
    expect(final.label).toBe("safe");
  });

  it("omits the label when no threshold is configured", () => {
    const final = finalizeResult({ strategy: "median" }, makeResults("task-3", [0.2, 0.3]));
    expect(final.label).toBeUndefined();
    expect(final.value).toBe(0.25);
  });

  it("throws on empty results", () => {
    expect(() => finalizeResult(config, [])).toThrow();
  });
});

describe("createAggregator", () => {
  it("reports completion once requiredWorkers is reached", () => {
    const aggregator = createAggregator({ strategy: "mean", requiredWorkers: 2 });
    const results = makeResults("task-4", [1]);
    const result = results[0];
    if (!result) throw new Error("expected a result");
    aggregator.add(result);
    expect(aggregator.complete()).toBe(false);
    aggregator.add(result);
    expect(aggregator.complete()).toBe(true);
  });
});

describe("finalizeResult with majority strategy", () => {
  const config: AggregationConfig = { strategy: "majority", requiredWorkers: 3 };

  const votes = (entries: Array<{ label: string; score: number }>) =>
    entries.map(({ label, score }, i) => ({
      taskId: "t" as unknown as InferenceResult["taskId"],
      clientId: newClientId(),
      model: "moderation-v1",
      output: { label, score },
      duration: 100 + i,
    }));

  it("picks the label with the most votes", () => {
    const final = finalizeResult(
      config,
      votes([
        { label: "tabby, tabby cat", score: 0.9 },
        { label: "tabby, tabby cat", score: 0.7 },
        { label: "golden retriever", score: 0.95 },
      ]),
    );
    expect(final.label).toBe("tabby, tabby cat");
    expect(final.value).toBeCloseTo(0.8);
    expect(final.agreement).toBeCloseTo(2 / 3);
    expect(final.workers).toBe(3);
  });

  it("breaks ties by mean confidence", () => {
    const final = finalizeResult(
      config,
      votes([
        { label: "cat", score: 0.5 },
        { label: "cat", score: 0.5 },
        { label: "dog", score: 0.6 },
        { label: "dog", score: 0.6 },
        { label: "dog", score: 0.99 },
        { label: "dog", score: 0.6 },
      ]),
    );
    expect(final.label).toBe("dog");
  });

  it("handles unanimous results with full agreement", () => {
    const final = finalizeResult(
      config,
      votes([
        { label: "tabby, tabby cat", score: 0.8 },
        { label: "tabby, tabby cat", score: 0.85 },
        { label: "tabby, tabby cat", score: 0.9 },
      ]),
    );
    expect(final.label).toBe("tabby, tabby cat");
    expect(final.agreement).toBe(1);
  });

  it("throws when no results carry a label", () => {
    const results = makeResults("task-5", [1, 2, 3]);
    expect(() => finalizeResult(config, results)).toThrow();
  });
});

describe("ids", () => {
  it("generates unique ids", () => {
    expect(newTaskId()).not.toBe(newTaskId());
    expect(newClientId()).not.toBe(newClientId());
  });

  it("generates valid uuids", () => {
    expect(newTaskId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(newClientId()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
