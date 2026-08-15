# Murmur — Protocol

Transport starts with **WebSockets**. Later candidates: WebRTC, WebTransport.

## Message flow

### 1. Client registers

```
CLIENT -> SERVER

HELLO
{
  clientId,
  capabilities,
  runtime,
  modelVersions
}
```

### 2. Server assigns a task

```
SERVER -> CLIENT

TASK
{
  taskId,
  model,
  input,
  deadline
}
```

### 3. Client returns a result

```
CLIENT -> SERVER

RESULT
{
  taskId,
  result,
  runtime,
  duration
}
```

### 4. Server acknowledges

```
SERVER -> CLIENT

ACK
{
  taskId
}
```

## Core types

```ts
interface InferenceTask {
  id: string;
  model: string;
  input: string;
  deadline?: number;
}

interface InferenceResult {
  taskId: string;
  clientId: string;
  output: unknown;
  duration: number;
}
```

Every message carries a `clientId` and/or `taskId` for traceability. Serialization and validation live in `@murmur/core`.

## Model distribution

Clients maintain a **local model cache** — models are not downloaded per task.

```
First task      Download model      Cache locally      Future tasks      Immediate inference
```

Model metadata:

```json
{
  "name": "moderation-v1",
  "version": "1.0.0",
  "format": "onnx",
  "size": 45000000,
  "sha256": "...",
  "runtime": "onnxruntime-web"
}
```

**Model integrity must be verified (SHA-256) before execution** — the runtime computes the digest of downloaded bytes with `crypto.subtle` and rejects mismatches (tested).

## Task assignment

Workers advertise capabilities in `HELLO` (backends, runtime, model versions). The coordinator only assigns a task to workers whose advertised runtime matches the model's `runtime` field — a browser running an incompatible runtime is never asked to evaluate a task.

## Consensus / aggregation

Strategies (pluggable):

- Majority vote (categorical outputs: `{ label, score }` per worker)
- Mean
- Median
- Trimmed mean

Winner selection for majority: most votes; ties broken by highest mean confidence.

```
Client A: tabby, tabby cat   Client B: tabby, tabby cat   Client C: golden retriever

Result: tabby, tabby cat
Agreement: 67%
```

```ts
interface Aggregator<T> {
  add(result: T): void;
  complete(): boolean;
  finalize(): T;
}
```

## Moderation result shape

```ts
{
  label: "unsafe",
  score: 0.97,
  consensus: {
    workers: 7,
    agreement: 0.86
  }
}
```

The moderation package must not be tightly coupled to one model. Supported categories: NSFW, violence, graphic content, hate/harassment, spam, custom application policies.
