import { afterEach, describe, expect, it } from "vitest";
import { WebSocket, type RawData } from "ws";
import { createMurmurServer, type MurmurServer } from "@murmur/server";
import {
  newClientId,
  newRequestId,
  parseServerMessage,
  type ClientId,
  type ModelMetadata,
  type ServerToClientMessage,
} from "@murmur/core";

const moderationModel: ModelMetadata = {
  name: "moderation-v1",
  version: "1.0.0",
  format: "mock",
  size: 0,
  sha256: "a".repeat(64),
  runtime: "mock",
  aggregation: {
    strategy: "mean",
    requiredWorkers: 3,
    threshold: 0.5,
    lowerLabel: "safe",
    upperLabel: "unsafe",
    tolerance: 0.1,
  },
};

interface TestClient {
  ws: WebSocket;
  id: ClientId | null;
  send(message: unknown): void;
  register(): Promise<ClientId>;
  waitFor(predicate: (msg: ServerToClientMessage) => boolean, timeoutMs?: number): Promise<ServerToClientMessage>;
  respondToTasks(score: number, delayMs?: number): void;
}

const text = (raw: RawData): string =>
  typeof raw === "string" ? raw : Buffer.from(raw as ArrayBuffer).toString("utf8");

const makeClient = (url: string): TestClient => {
  const ws = new WebSocket(url);
  let id: ClientId | null = null;

  const ready = new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  const waitFor = (
    predicate: (msg: ServerToClientMessage) => boolean,
    timeoutMs = 3_000,
  ): Promise<ServerToClientMessage> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("timed out waiting for message"));
      }, timeoutMs);
      const handler = (raw: RawData) => {
        const parsed = parseServerMessage(text(raw));
        if (parsed.ok && predicate(parsed.message)) {
          cleanup();
          resolve(parsed.message);
        }
      };
      const cleanup = () => {
        clearTimeout(timer);
        ws.off("message", handler);
      };
      ws.on("message", handler);
    });

  const send = (message: unknown) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  };

  const register = async (): Promise<ClientId> => {
    id = newClientId();
    await ready;
    send({
      type: "hello",
      clientId: id,
      capabilities: { backends: ["mock"], modelVersions: { "moderation-v1": "1.0.0" }, runtime: "mock" },
    });
    await waitFor((msg) => msg.type === "registered");
    return id;
  };

  const respondToTasks = (score: number, delayMs = 0) => {
    ws.on("message", (raw: RawData) => {
      const parsed = parseServerMessage(text(raw));
      if (!parsed.ok || parsed.message.type !== "task") return;
      const clientId = id;
      const taskId = parsed.message.task.id;
      if (!clientId) return;
      setTimeout(() => send({ type: "result", taskId, clientId, result: score, duration: 100 }), delayMs);
    });
  };

  return {
    ws,
    get id() {
      return id;
    },
    send,
    register,
    waitFor,
    respondToTasks,
  };
};

describe("Murmur coordinator protocol", () => {
  const servers: MurmurServer[] = [];
  const clients: TestClient[] = [];
  const rawSockets: WebSocket[] = [];

  const startServer = (overrides: Partial<Parameters<typeof createMurmurServer>[0]> = {}) => {
    const server = createMurmurServer({ port: 0, models: [moderationModel], ...overrides });
    servers.push(server);
    return server.start().then((port) => `ws://localhost:${port}`);
  };

  const openRawSocket = async (url: string): Promise<WebSocket> => {
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    return ws;
  };

  afterEach(async () => {
    for (const client of clients) client.ws.close();
    clients.length = 0;
    for (const socket of rawSockets) socket.close();
    rawSockets.length = 0;
    for (const server of servers) await server.stop();
    servers.length = 0;
  });

  it("aggregates independent results into a consensus", async () => {
    const url = await startServer();

    const requester = makeClient(url);
    clients.push(requester);
    await requester.register();
    requester.respondToTasks(0.48);

    const worker1 = makeClient(url);
    const worker2 = makeClient(url);
    clients.push(worker1, worker2);
    await worker1.register();
    await worker2.register();
    worker1.respondToTasks(0.46);
    worker2.respondToTasks(0.52);

    const completion = requester.waitFor((msg) => msg.type === "task_complete" && msg.requestId !== undefined);
    requester.send({ type: "create_task", requestId: newRequestId(), model: "moderation-v1", input: "image:test" });

    const message = await completion;
    if (message.type !== "task_complete") throw new Error("unexpected message");
    expect(message.final.workers).toBe(3);
    expect(message.final.model).toBe("moderation-v1");
    expect(message.final.value).toBeGreaterThanOrEqual(0);
    expect(message.final.value).toBeLessThanOrEqual(1);
    expect(["safe", "unsafe"]).toContain(message.final.label);
    expect(message.final.agreement).toBeGreaterThanOrEqual(0);
    expect(message.final.agreement).toBeLessThanOrEqual(1);
    expect(message.final.results).toHaveLength(3);
  });

  it("rejects tasks for unknown models", async () => {
    const url = await startServer();
    const requester = makeClient(url);
    clients.push(requester);
    await requester.register();

    const response = requester.waitFor((msg) => msg.type === "error");
    requester.send({ type: "create_task", requestId: newRequestId(), model: "does-not-exist", input: "x" });

    const error = await response;
    if (error.type !== "error") throw new Error("unexpected message");
    expect(error.message).toContain("unknown model");
  });

  it("rejects malformed messages", async () => {
    const url = await startServer();
    const ws = await openRawSocket(url);
    rawSockets.push(ws);

    const response = new Promise<ServerToClientMessage>((resolve) => {
      ws.on("message", (raw: RawData) => {
        const parsed = parseServerMessage(text(raw));
        if (parsed.ok && parsed.message.type === "error") resolve(parsed.message);
      });
    });
    ws.send("this is not json");

    const error = await response;
    expect(error.message).toContain("invalid message");
  });

  it("finalizes with partial results once the deadline passes", async () => {
    const url = await startServer({ defaultDeadlineMs: 250, defaultRequiredWorkers: 2 });

    const requester = makeClient(url);
    clients.push(requester);
    await requester.register();

    const worker1 = makeClient(url);
    const worker2 = makeClient(url);
    clients.push(worker1, worker2);
    await worker1.register();
    await worker2.register();
    worker1.respondToTasks(0.9);
    // worker2 never responds

    const completion = requester.waitFor((msg) => msg.type === "task_complete" && msg.requestId !== undefined, 5_000);
    requester.send({ type: "create_task", requestId: newRequestId(), model: "moderation-v1", input: "image:slow" });

    const message = await completion;
    if (message.type !== "task_complete") throw new Error("unexpected message");
    expect(message.final.workers).toBe(1);
    expect(message.final.value).toBeCloseTo(0.9);
  });

  it("fails a task when no workers are available", async () => {
    const url = await startServer();
    const ws = await openRawSocket(url);
    rawSockets.push(ws);

    const failed = new Promise<ServerToClientMessage>((resolve) => {
      ws.on("message", (raw: RawData) => {
        const parsed = parseServerMessage(text(raw));
        if (parsed.ok && parsed.message.type === "task_failed") resolve(parsed.message);
      });
    });
    ws.send(JSON.stringify({ type: "create_task", requestId: newRequestId(), model: "moderation-v1", input: "img" }));

    const message = await failed;
    if (message.type !== "task_failed") throw new Error("unexpected message");
    expect(message.reason).toContain("no workers");
  });
});
