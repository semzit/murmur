import { WebSocketServer, type WebSocket } from "ws";
import type {
  ClientCapabilities,
  ClientId,
  FinalResult,
  ModelMetadata,
  RequestId,
  TaskId,
  TaskState,
  WorkerInfo,
} from "@murmur/core";
import { finalizeResult, newTaskId, parseClientMessage, type ServerToClientMessage } from "@murmur/core";

export interface MurmurServerOptions {
  port: number;
  models: ModelMetadata[];
  defaultRequiredWorkers?: number;
  defaultDeadlineMs?: number;
}

export interface MurmurServer {
  port: number;
  start(): Promise<number>;
  stop(): Promise<void>;
  readonly workers: WorkerInfo[];
  readonly tasks: ReadonlyMap<TaskId, TaskState>;
}

interface WorkerRecord {
  clientId: ClientId;
  capabilities: ClientCapabilities;
  socket: WebSocket;
  busy: boolean;
  healthy: boolean;
}

interface TaskRecord extends TaskState {
  metadata: ModelMetadata;
  assigned: Set<ClientId>;
  requesters: Map<RequestId, WebSocket>;
  deadlineTimer: ReturnType<typeof setTimeout>;
}

const send = (socket: WebSocket, message: ServerToClientMessage) => {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
};

const broadcast = (sockets: Iterable<WebSocket>, message: ServerToClientMessage) => {
  for (const socket of sockets) send(socket, message);
};

export function createMurmurServer(options: MurmurServerOptions): MurmurServer {
  const workers = new Map<ClientId, WorkerRecord>();
  const tasks = new Map<TaskId, TaskRecord>();
  let wss: WebSocketServer | null = null;

  const model = (name: string): ModelMetadata | null => options.models.find((m) => m.name === name) ?? null;

  const workerList = (): WorkerInfo[] =>
    [...workers.values()].map((w) => ({
      clientId: w.clientId,
      capabilities: w.capabilities,
      status: w.busy ? ("busy" as const) : ("idle" as const),
    }));

  const broadcastWorkers = () =>
    broadcast(
      [...workers.values()].map((w) => w.socket),
      { type: "workers", workers: workerList() },
    );

  const requiredFor = (record: TaskRecord) =>
    record.metadata.aggregation.requiredWorkers ?? options.defaultRequiredWorkers ?? 3;

  const finalizeTask = (record: TaskRecord) => {
    if (record.status !== "in_progress") return;
    clearTimeout(record.deadlineTimer);

    const valid = record.results.filter((r) => r.output !== null);
    if (valid.length === 0) {
      record.status = "failed";
      record.completedAt = Date.now();
      return;
    }

    const final: FinalResult = finalizeResult(record.metadata.aggregation, valid);
    record.final = final;
    record.status = "complete";
    record.completedAt = Date.now();

    for (const [requestId, requester] of record.requesters) {
      send(requester, { type: "task_complete", requestId, final });
    }
    broadcast(
      [...workers.values()].map((w) => w.socket),
      { type: "task_complete", final },
    );
  };

  const createTask = (
    modelName: string,
    input: unknown,
    requesterId: RequestId,
    requesterSocket: WebSocket,
  ): TaskRecord | null => {
    const metadata = model(modelName);
    if (!metadata) return null;

    const id = newTaskId();
    const record: TaskRecord = {
      id,
      model: metadata.name,
      metadata,
      input,
      status: "pending",
      results: [],
      createdAt: Date.now(),
      assigned: new Set(),
      requesters: new Map([[requesterId, requesterSocket]]),
      deadlineTimer: setTimeout(() => finalizeTask(record), options.defaultDeadlineMs ?? 30_000),
    };
    tasks.set(id, record);

    const recipients = [...workers.values()]
      .filter((w) => w.healthy && !w.busy)
      .slice(0, Math.max(1, requiredFor(record)));

    if (recipients.length > 0) {
      record.status = "in_progress";
      for (const worker of recipients) {
        worker.busy = true;
        record.assigned.add(worker.clientId);
        send(worker.socket, {
          type: "task",
          task: {
            id,
            model: metadata.name,
            input,
            deadline: Date.now() + (options.defaultDeadlineMs ?? 30_000),
            requiredWorkers: requiredFor(record),
          },
        });
      }
      broadcastWorkers();
    } else {
      record.status = "failed";
      record.completedAt = Date.now();
      send(requesterSocket, { type: "task_failed", taskId: id, reason: "no workers available" });
    }
    return record;
  };

  return {
    port: options.port,
    get workers() {
      return workerList();
    },
    get tasks() {
      return tasks as unknown as ReadonlyMap<TaskId, TaskState>;
    },
    start() {
      return new Promise<number>((resolve) => {
        wss = new WebSocketServer({ port: options.port }, () => {
          const address = wss?.address();
          const boundPort = typeof address === "object" && address ? address.port : options.port;
          resolve(boundPort);
        });
        wss.on("connection", (socket) => {
          let clientId: ClientId | null = null;

          socket.on("message", (data) => {
            const payload = typeof data === "string" ? data : Buffer.from(data as ArrayBuffer).toString("utf8");
            const parsed = parseClientMessage(payload);
            if (!parsed.ok) {
              send(socket, { type: "error", message: `invalid message: ${parsed.error}` });
              return;
            }

            const message = parsed.message;
            switch (message.type) {
              case "hello": {
                clientId = message.clientId;
                workers.set(clientId, {
                  clientId,
                  capabilities: message.capabilities,
                  socket,
                  busy: false,
                  healthy: true,
                });
                send(socket, { type: "registered", clientId });
                broadcastWorkers();
                break;
              }
              case "result": {
                const record = tasks.get(message.taskId);
                if (!record || record.status !== "in_progress") break;
                record.results.push({
                  taskId: message.taskId,
                  clientId: message.clientId,
                  model: record.metadata.name,
                  output: message.result,
                  duration: message.duration,
                });
                send(socket, { type: "ack", taskId: message.taskId });
                const worker = workers.get(message.clientId);
                if (worker) worker.busy = false;

                const allResponded = [...record.assigned].every((id) => record.results.some((r) => r.clientId === id));
                if (record.results.length >= requiredFor(record) || allResponded) {
                  finalizeTask(record);
                }
                broadcastWorkers();
                break;
              }
              case "create_task": {
                const record = createTask(message.model, message.input, message.requestId, socket);
                if (!record) {
                  send(socket, { type: "error", message: `unknown model: ${message.model}` });
                }
                break;
              }
              case "ping":
                send(socket, { type: "pong" });
                break;
            }
          });

          socket.on("close", () => {
            if (clientId) {
              workers.delete(clientId);
              broadcastWorkers();
            }
          });

          socket.on("error", () => socket.close());
        });
      });
    },
    stop() {
      return new Promise<void>((resolve) => {
        for (const record of tasks.values()) clearTimeout(record.deadlineTimer);
        wss?.close(() => resolve());
        wss = null;
      });
    },
  };
}
