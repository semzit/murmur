import { z } from "zod";
import {
  clientCapabilitiesSchema,
  clientIdSchema,
  finalResultSchema,
  inferenceTaskSchema,
  requestIdSchema,
  taskIdSchema,
  workerInfoSchema,
} from "./schemas.ts";

export const helloMessageSchema = z.object({
  type: z.literal("hello"),
  clientId: clientIdSchema,
  capabilities: clientCapabilitiesSchema,
});

export const resultMessageSchema = z.object({
  type: z.literal("result"),
  taskId: taskIdSchema,
  clientId: clientIdSchema,
  result: z.unknown(),
  duration: z.number().nonnegative(),
});

export const createTaskMessageSchema = z.object({
  type: z.literal("create_task"),
  requestId: requestIdSchema,
  model: z.string().min(1),
  input: z.unknown(),
});

export const pingMessageSchema = z.object({
  type: z.literal("ping"),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  helloMessageSchema,
  resultMessageSchema,
  createTaskMessageSchema,
  pingMessageSchema,
]);
export type ClientToServerMessage = z.infer<typeof clientMessageSchema>;

export const registeredMessageSchema = z.object({
  type: z.literal("registered"),
  clientId: clientIdSchema,
});

export const taskMessageSchema = z.object({
  type: z.literal("task"),
  task: inferenceTaskSchema,
});

export const ackMessageSchema = z.object({
  type: z.literal("ack"),
  taskId: taskIdSchema,
});

export const taskCompleteMessageSchema = z.object({
  type: z.literal("task_complete"),
  requestId: requestIdSchema.optional(),
  final: finalResultSchema,
});

export const taskFailedMessageSchema = z.object({
  type: z.literal("task_failed"),
  taskId: taskIdSchema,
  reason: z.string().min(1),
});

export const workersMessageSchema = z.object({
  type: z.literal("workers"),
  workers: z.array(workerInfoSchema),
});

export const errorMessageSchema = z.object({
  type: z.literal("error"),
  message: z.string().min(1),
});

export const pongMessageSchema = z.object({
  type: z.literal("pong"),
});

export const serverMessageSchema = z.discriminatedUnion("type", [
  registeredMessageSchema,
  taskMessageSchema,
  ackMessageSchema,
  taskCompleteMessageSchema,
  taskFailedMessageSchema,
  workersMessageSchema,
  errorMessageSchema,
  pongMessageSchema,
]);
export type ServerToClientMessage = z.infer<typeof serverMessageSchema>;

export type ParseResult<T> = { ok: true; message: T } | { ok: false; error: string };

const parse = <T>(schema: z.ZodType<T>, data: string): ParseResult<T> => {
  let raw: unknown;
  try {
    raw = JSON.parse(data) as unknown;
  } catch {
    return { ok: false, error: "invalid json" };
  }
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, message: result.data };
  return {
    ok: false,
    error: result.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message).join("; "),
  };
};

export const parseClientMessage = (data: string): ParseResult<ClientToServerMessage> =>
  parse(clientMessageSchema, data);
export const parseServerMessage = (data: string): ParseResult<ServerToClientMessage> =>
  parse(serverMessageSchema, data);
