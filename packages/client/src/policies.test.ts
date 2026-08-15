// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { canRunTask, DEFAULT_POLICIES } from "./policies.ts";

describe("canRunTask", () => {
  it("allows a task within the concurrency limit", () => {
    expect(canRunTask({}, 0)).toEqual({ ok: true });
  });

  it("blocks a task at the concurrency limit", () => {
    expect(canRunTask({}, 1)).toEqual({ ok: false, reason: "max-concurrent-tasks" });
  });

  it("honors a custom maxConcurrentTasks", () => {
    expect(canRunTask({ maxConcurrentTasks: 3 }, 3)).toEqual({ ok: false, reason: "max-concurrent-tasks" });
    expect(canRunTask({ maxConcurrentTasks: 3 }, 2)).toEqual({ ok: true });
  });

  it("blocks when the page is hidden and onlyWhenVisible is set", () => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    expect(canRunTask({ onlyWhenVisible: true }, 0)).toEqual({ ok: false, reason: "page-hidden" });
  });

  it("allows hidden-page tasks when onlyWhenVisible is disabled", () => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    expect(canRunTask({ onlyWhenVisible: false }, 0)).toEqual({ ok: true });
  });

  it("defaults onlyWhenVisible to true", () => {
    expect(DEFAULT_POLICIES.onlyWhenVisible).toBe(true);
    expect(DEFAULT_POLICIES.maxConcurrentTasks).toBe(1);
  });
});
