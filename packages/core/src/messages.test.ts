import { describe, expect, it } from "vitest";
import { clientMessageSchema, parseClientMessage, parseServerMessage, serverMessageSchema } from "./messages.ts";
import { newClientId, newRequestId, newTaskId } from "./ids.ts";
import { inferenceResultSchema, inferenceTaskSchema, modelMetadataSchema } from "./schemas.ts";

const validModel = {
  name: "moderation-v1",
  version: "1.0.0",
  format: "onnx",
  size: 45_000_000,
  sha256: "a".repeat(64),
  runtime: "onnxruntime-web",
  aggregation: { strategy: "mean", requiredWorkers: 3, threshold: 0.5 },
};

describe("schemas", () => {
  it("accepts a valid model metadata object", () => {
    expect(modelMetadataSchema.safeParse(validModel).success).toBe(true);
  });

  it("rejects an invalid sha256", () => {
    expect(modelMetadataSchema.safeParse({ ...validModel, sha256: "not-a-hash" }).success).toBe(false);
  });

  it("rejects a model without aggregation", () => {
    const { aggregation: _aggregation, ...rest } = validModel;
    expect(modelMetadataSchema.safeParse(rest).success).toBe(false);
  });

  it("accepts a valid task", () => {
    const task = {
      id: newTaskId(),
      model: "moderation-v1",
      input: "https://example.com/image.png",
      deadline: Date.now() + 30_000,
    };
    expect(inferenceTaskSchema.safeParse(task).success).toBe(true);
  });

  it("rejects a non-uuid task id", () => {
    expect(inferenceTaskSchema.safeParse({ id: "abc", model: "m", input: null }).success).toBe(false);
  });

  it("accepts a valid result", () => {
    const result = {
      taskId: newTaskId(),
      clientId: newClientId(),
      model: "moderation-v1",
      output: 0.87,
      duration: 123,
    };
    expect(inferenceResultSchema.safeParse(result).success).toBe(true);
  });
});

describe("parseClientMessage", () => {
  it("parses a valid hello", () => {
    const parsed = parseClientMessage(
      JSON.stringify({
        type: "hello",
        clientId: newClientId(),
        capabilities: { backends: ["webgpu"], modelVersions: {}, runtime: "onnxruntime-web" },
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.message.type).toBe("hello");
  });

  it("parses a valid create_task", () => {
    const parsed = parseClientMessage(
      JSON.stringify({ type: "create_task", requestId: newRequestId(), model: "moderation-v1", input: { url: "x" } }),
    );
    expect(parsed.ok).toBe(true);
  });

  it("rejects invalid json", () => {
    const parsed = parseClientMessage("not json{{{");
    expect(parsed.ok).toBe(false);
  });

  it("rejects an unknown message type", () => {
    const parsed = parseClientMessage(JSON.stringify({ type: "exploit", data: 1 }));
    expect(parsed.ok).toBe(false);
  });

  it("rejects a hello with missing capabilities", () => {
    const parsed = parseClientMessage(JSON.stringify({ type: "hello", clientId: newClientId() }));
    expect(parsed.ok).toBe(false);
  });

  it("rejects a create_task with an empty model name", () => {
    const parsed = parseClientMessage(
      JSON.stringify({ type: "create_task", requestId: newRequestId(), model: "", input: null }),
    );
    expect(parsed.ok).toBe(false);
  });
});

describe("parseServerMessage", () => {
  it("parses a valid task message", () => {
    const task = { id: newTaskId(), model: "moderation-v1", input: "img" };
    const parsed = parseServerMessage(JSON.stringify({ type: "task", task }));
    expect(parsed.ok).toBe(true);
  });

  it("parses a valid task_complete", () => {
    const final = {
      taskId: newTaskId(),
      model: "moderation-v1",
      value: 0.8,
      label: "unsafe",
      agreement: 1,
      workers: 3,
      results: [],
    };
    const parsed = parseServerMessage(JSON.stringify({ type: "task_complete", requestId: newRequestId(), final }));
    expect(parsed.ok).toBe(true);
  });

  it("rejects a task_complete with an invalid final result", () => {
    const parsed = parseServerMessage(JSON.stringify({ type: "task_complete", final: { taskId: "x" } }));
    expect(parsed.ok).toBe(false);
  });
});

describe("schema round-trip", () => {
  it("server messages validate against their schema", () => {
    const msg = {
      type: "workers" as const,
      workers: [
        {
          clientId: newClientId(),
          capabilities: { backends: ["cpu"], modelVersions: {}, runtime: "mock" },
          status: "idle",
        },
      ],
    };
    expect(serverMessageSchema.safeParse(msg).success).toBe(true);
    expect(clientMessageSchema.safeParse(msg).success).toBe(false);
  });
});
