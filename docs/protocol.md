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

**Model integrity must be verified (SHA-256) before execution.**

## Consensus / aggregation

Simple first version:

```
Client A: safe     Client B: safe     Client C: unsafe
Client D: safe     Client E: safe

Result: SAFE
Confidence: 80%
```

Strategies (pluggable):

- Mean
- Median
- Trimmed mean
- Majority vote
- Weighted vote

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
