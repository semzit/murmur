import type { AggregationConfig, FinalResult, InferenceResult } from "./schemas.ts";

export interface Aggregator<T> {
  add(result: T): void;
  complete(): boolean;
  finalize(): T;
}

export interface NumericAggregator {
  add(result: InferenceResult): void;
  complete(): boolean;
  finalize(): FinalResult;
}

const sorted = (values: number[]) => [...values].sort((a, b) => a - b);

export function aggregateNumbers(values: number[], config: AggregationConfig): number {
  if (values.length === 0) throw new Error("cannot aggregate empty result set");
  switch (config.strategy) {
    case "median": {
      const s = sorted(values);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
    }
    case "trimmed_mean": {
      const s = sorted(values);
      const trim = Math.max(1, Math.floor(s.length * 0.1));
      const inner = s.slice(trim, s.length - trim);
      return inner.reduce((a, b) => a + b, 0) / inner.length;
    }
    case "mean":
    default:
      return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

export function agreement(values: number[], aggregate: number, config: AggregationConfig): number {
  const tolerance = config.tolerance ?? 0.1;
  const consistent = values.filter((v) => Math.abs(v - aggregate) <= tolerance).length;
  return values.length === 0 ? 0 : consistent / values.length;
}

export interface CategoricalOutput {
  label: string;
  score: number;
}

export function majorityResult(config: AggregationConfig, results: InferenceResult[]): FinalResult {
  if (results.length === 0) throw new Error("cannot finalize empty result set");
  const first = results[0];
  if (!first) throw new Error("cannot finalize empty result set");
  const votes = new Map<string, number[]>();

  for (const result of results) {
    const output = result.output;
    if (typeof output !== "object" || output === null) continue;
    const candidate = output as Partial<CategoricalOutput>;
    if (typeof candidate.label !== "string") continue;
    const scores = votes.get(candidate.label) ?? [];
    scores.push(candidate.score ?? 0);
    votes.set(candidate.label, scores);
  }

  if (votes.size === 0) throw new Error("no categorical results to aggregate");

  let winner: string | null = null;
  let winnerCount = 0;
  let winnerScore = -1;
  for (const [label, scores] of votes) {
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (scores.length > winnerCount || (scores.length === winnerCount && mean > winnerScore)) {
      winner = label;
      winnerCount = scores.length;
      winnerScore = mean;
    }
  }
  if (winner === null) throw new Error("no categorical results to aggregate");

  return {
    taskId: first.taskId,
    model: first.model,
    value: winnerScore,
    label: winner,
    agreement: winnerCount / results.length,
    workers: results.length,
    results,
  };
}

export function finalizeResult(config: AggregationConfig, results: InferenceResult[]): FinalResult {
  if (results.length === 0) throw new Error("cannot finalize empty result set");
  if (config.strategy === "majority") return majorityResult(config, results);
  const first = results[0];
  if (!first) throw new Error("cannot finalize empty result set");
  const outputs = results.map((r) => Number(r.output));
  const value = aggregateNumbers(outputs, config);
  const label =
    config.threshold !== undefined
      ? value >= config.threshold
        ? (config.upperLabel ?? "unsafe")
        : (config.lowerLabel ?? "safe")
      : undefined;
  return {
    taskId: first.taskId,
    model: first.model,
    value,
    label,
    agreement: agreement(outputs, value, config),
    workers: results.length,
    results,
  };
}

export function createNumericAggregator(config: AggregationConfig): NumericAggregator {
  const collected: InferenceResult[] = [];
  return {
    add(result: InferenceResult) {
      collected.push(result);
    },
    complete() {
      return collected.length >= (config.requiredWorkers ?? 1);
    },
    finalize() {
      return finalizeResult(config, collected);
    },
  };
}

export const createAggregator = createNumericAggregator;
