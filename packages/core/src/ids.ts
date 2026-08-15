import type { ClientId, RequestId, TaskId } from "./schemas.ts";

export const newTaskId = (): TaskId => crypto.randomUUID() as unknown as TaskId;

export const newClientId = (): ClientId => crypto.randomUUID() as unknown as ClientId;

export const newRequestId = (): RequestId => crypto.randomUUID() as unknown as RequestId;
