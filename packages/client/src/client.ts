import type {
  ClientCapabilities,
  ClientId,
  FinalResult,
  InferenceResult,
  InferenceTask,
  RequestId,
  WorkerInfo,
} from "@murmur/core";
import { newClientId, newRequestId, parseServerMessage, type ClientToServerMessage } from "@murmur/core";
import type { InferenceRuntime } from "./runtime.ts";
import { MockRuntime } from "./runtime.ts";
import { canRunTask, type ResourcePolicies } from "./policies.ts";

export type MurmurStatus = "idle" | "connecting" | "registered" | "disconnected";

export interface MurmurClientOptions {
  coordinator: string;
  policies?: ResourcePolicies;
  runtime?: InferenceRuntime;
  capabilities?: Partial<ClientCapabilities>;
  reconnectDelayMs?: number;
}

export interface MurmurClient {
  readonly clientId: ClientId | null;
  readonly status: MurmurStatus;
  readonly workers: WorkerInfo[];
  connect(): Promise<void>;
  disconnect(): void;
  destroy(): void;
  requestTask(input: { model: string; input: unknown; timeoutMs?: number }): Promise<FinalResult>;
  subscribe(listener: (event: ClientEvent) => void): () => void;
}

export type ClientEvent =
  | { type: "status"; status: MurmurStatus }
  | { type: "workers"; workers: WorkerInfo[] }
  | { type: "task"; task: InferenceTask }
  | { type: "result"; result: InferenceResult }
  | { type: "complete"; final: FinalResult }
  | { type: "task_failed"; taskId: string; reason: string }
  | { type: "disconnect"; reason?: string };

interface PendingRequest {
  resolve: (final: FinalResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export function createClient(options: MurmurClientOptions): MurmurClient {
  const clientId = newClientId();
  const policies = options.policies ?? {};
  const runtime = options.runtime ?? new MockRuntime();
  const reconnectDelayMs = options.reconnectDelayMs ?? 2000;

  const capabilities: ClientCapabilities = {
    backends: options.capabilities?.backends ?? ["mock"],
    modelVersions: options.capabilities?.modelVersions ?? {},
    runtime: runtime.id,
  };

  let socket: WebSocket | null = null;
  let status: MurmurStatus = "idle";
  let workers: WorkerInfo[] = [];
  let activeTasks = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let manuallyClosed = false;

  const listeners = new Set<(event: ClientEvent) => void>();
  const pending = new Map<RequestId, PendingRequest>();

  const emit = (event: ClientEvent) => {
    for (const listener of listeners) listener(event);
  };

  const setStatus = (next: MurmurStatus) => {
    status = next;
    emit({ type: "status", status: next });
  };

  const send = (message: ClientToServerMessage) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  const handleMessage = (data: string) => {
    const parsed = parseServerMessage(data);
    if (!parsed.ok) return;

    switch (parsed.message.type) {
      case "registered":
        setStatus("registered");
        break;
      case "workers":
        workers = parsed.message.workers;
        emit({ type: "workers", workers: parsed.message.workers });
        break;
      case "task": {
        void handleTask(parsed.message.task);
        break;
      }
      case "ack":
        break;
      case "task_complete": {
        if (parsed.message.requestId) {
          const request = pending.get(parsed.message.requestId);
          if (request) {
            clearTimeout(request.timeout);
            pending.delete(parsed.message.requestId);
            request.resolve(parsed.message.final);
          }
        }
        emit({ type: "complete", final: parsed.message.final });
        break;
      }
      case "task_failed":
        emit({ type: "task_failed", taskId: parsed.message.taskId, reason: parsed.message.reason });
        break;
      case "error":
        break;
      case "pong":
        break;
    }
  };

  const handleTask = async (task: InferenceTask) => {
    emit({ type: "task", task });
    const gate = canRunTask(policies, activeTasks);
    if (!gate.ok) {
      send({ type: "result", taskId: task.id, clientId, result: null, duration: 0 });
      emit({ type: "task_failed", taskId: task.id, reason: gate.reason ?? "resource-policy" });
      return;
    }

    activeTasks++;
    try {
      await runtime.load(task.model);
      const started = performance.now();
      const { output, duration } = await runtime.infer(task.input);
      const measured = duration > 0 ? duration : performance.now() - started;
      const result: InferenceResult = { taskId: task.id, clientId, model: task.model, output, duration: measured };
      send({ type: "result", taskId: task.id, clientId, result: output, duration: measured });
      emit({ type: "result", result });
    } catch (error) {
      send({ type: "result", taskId: task.id, clientId, result: null, duration: 0 });
      emit({
        type: "task_failed",
        taskId: task.id,
        reason: error instanceof Error ? error.message : "inference-error",
      });
    } finally {
      activeTasks--;
    }
  };

  const openSocket = () => {
    if (disposed) return;
    setStatus("connecting");

    socket = new WebSocket(options.coordinator);
    socket.addEventListener("open", () => {
      send({ type: "hello", clientId, capabilities });
    });
    socket.addEventListener("message", (event) => {
      if (typeof event.data === "string") handleMessage(event.data);
    });
    socket.addEventListener("close", () => {
      socket = null;
      for (const request of pending.values()) {
        clearTimeout(request.timeout);
        request.reject(new Error("connection closed"));
      }
      pending.clear();
      if (manuallyClosed) return;
      setStatus("disconnected");
      emit({ type: "disconnect", reason: "connection-closed" });
      if (!disposed) {
        reconnectTimer = setTimeout(openSocket, reconnectDelayMs);
      }
    });
    socket.addEventListener("error", () => {
      socket?.close();
    });
  };

  return {
    get clientId() {
      return clientId;
    },
    get status() {
      return status;
    },
    get workers() {
      return workers;
    },
    connect() {
      if (status === "connecting" || status === "registered") return Promise.resolve();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      manuallyClosed = false;
      openSocket();
      return Promise.resolve();
    },
    disconnect() {
      manuallyClosed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      socket?.close();
      socket = null;
      setStatus("idle");
    },
    destroy() {
      disposed = true;
      this.disconnect();
    },
    requestTask({ model, input, timeoutMs = 30_000 }) {
      const requestId = newRequestId();
      return new Promise<FinalResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error(`task request timed out (${timeoutMs}ms)`));
        }, timeoutMs);
        pending.set(requestId, { resolve, reject, timeout });
        send({ type: "create_task", requestId, model, input });
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
