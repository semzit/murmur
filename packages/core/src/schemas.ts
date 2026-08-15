import { z } from "zod";

export const taskIdSchema = z.uuid().brand("murmur_task");
export const clientIdSchema = z.uuid().brand("murmur_client");
export const requestIdSchema = z.uuid().brand("murmur_request");

export type TaskId = z.infer<typeof taskIdSchema>;
export type ClientId = z.infer<typeof clientIdSchema>;
export type RequestId = z.infer<typeof requestIdSchema>;

export const backendSchema = z.enum(["webgpu", "wasm", "cpu", "mock"]);
export type Backend = z.infer<typeof backendSchema>;

export const aggregationStrategySchema = z.enum(["majority", "mean", "median", "trimmed_mean"]);
export type AggregationStrategy = z.infer<typeof aggregationStrategySchema>;

export const aggregationConfigSchema = z.object({
  strategy: aggregationStrategySchema,
  requiredWorkers: z.number().int().positive().optional(),
  threshold: z.number().min(0).max(1).optional(),
  lowerLabel: z.string().min(1).optional(),
  upperLabel: z.string().min(1).optional(),
  tolerance: z.number().min(0).max(1).optional(),
});
export type AggregationConfig = z.infer<typeof aggregationConfigSchema>;

export const modelMetadataSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  format: z.string().min(1),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i),
  runtime: z.string().min(1),
  aggregation: aggregationConfigSchema,
});
export type ModelMetadata = z.infer<typeof modelMetadataSchema>;

export const clientCapabilitiesSchema = z.object({
  backends: z.array(backendSchema),
  modelVersions: z.record(z.string(), z.string()),
  runtime: z.string().min(1),
});
export type ClientCapabilities = z.infer<typeof clientCapabilitiesSchema>;

export const inferenceTaskSchema = z.object({
  id: taskIdSchema,
  model: z.string().min(1),
  input: z.unknown(),
  deadline: z.number().int().positive().optional(),
  requiredWorkers: z.number().int().positive().optional(),
});
export type InferenceTask = z.infer<typeof inferenceTaskSchema>;

export const inferenceResultSchema = z.object({
  taskId: taskIdSchema,
  clientId: clientIdSchema,
  model: z.string().min(1),
  output: z.unknown(),
  duration: z.number().nonnegative(),
});
export type InferenceResult = z.infer<typeof inferenceResultSchema>;

export const finalResultSchema = z.object({
  taskId: taskIdSchema,
  model: z.string().min(1),
  value: z.number(),
  label: z.string().optional(),
  agreement: z.number().min(0).max(1),
  workers: z.number().int().nonnegative(),
  results: z.array(inferenceResultSchema),
});
export type FinalResult = z.infer<typeof finalResultSchema>;

export const taskStatusSchema = z.enum(["pending", "in_progress", "complete", "failed"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskStateSchema = z.object({
  id: taskIdSchema,
  model: z.string().min(1),
  input: z.unknown(),
  status: taskStatusSchema,
  results: z.array(inferenceResultSchema),
  final: finalResultSchema.optional(),
  createdAt: z.number().int().nonnegative(),
  completedAt: z.number().int().nonnegative().optional(),
});
export type TaskState = z.infer<typeof taskStateSchema>;

export const workerStatusSchema = z.enum(["idle", "busy", "offline"]);
export type WorkerStatus = z.infer<typeof workerStatusSchema>;

export const workerInfoSchema = z.object({
  clientId: clientIdSchema,
  capabilities: clientCapabilitiesSchema,
  status: workerStatusSchema,
});
export type WorkerInfo = z.infer<typeof workerInfoSchema>;

export const validateModel = (value: unknown): ModelMetadata | null => {
  const result = modelMetadataSchema.safeParse(value);
  return result.success ? result.data : null;
};
