# Murmur — Architecture

## Phase 1 topology

```
                    +----------------+
                    |   Application  |
                    +-------+--------+
                            |
                            |
                    +-------v--------+
                    | Murmur Server  |
                    |  Coordinator   |
                    +-------+--------+
                            |
                   WebSocket / HTTP
                            |
        +-------------------+-------------------+
        |                   |                   |
+-------v-------+   +-------v-------+   +-------v-------+
|   Browser A   |   |   Browser B   |   |   Browser C   |
|               |   |               |   |               |
| React         |   | React         |   | React         |
| Web Worker    |   | Web Worker    |   | Web Worker    |
| WebGPU/WASM   |   | WebGPU/WASM   |   | WebGPU/WASM   |
| ML Model      |   | ML Model      |   | ML Model      |
+---------------+   +---------------+   +---------------+
```

## Components

### Murmur Client (browser)

- Register with the coordinator
- Advertise available capabilities
- Receive tasks
- Download/cache models
- Preprocess inputs
- Run inference
- Return results
- Manage Web Workers
- Select WebGPU/WASM/CPU backend
- Respect resource limits
- Stop computation when requested

### Murmur Coordinator (server)

- Register clients
- Maintain active workers
- Create tasks
- Assign tasks
- Track task state
- Request redundant inference
- Aggregate results
- Detect unreliable workers
- Return final results

### Murmur Model Runtime

Executes models. Initial targets: WebGPU, WASM, CPU fallback.

Potential technologies: ONNX Runtime Web, Transformers.js, Web Workers.

**Design constraint:** the runtime is abstracted so the rest of Murmur never depends on a specific ML framework.

## Package design (monorepo)

```
murmur/
├── packages/
│   ├── core/        # Protocol-independent primitives (tasks, results, IDs, messages, validation)
│   ├── client/      # Browser client (createClient({ coordinator }))
│   ├── react/       # React integration (MurmurProvider, useMurmur)
│   ├── server/      # Coordinator implementation
│   ├── runtime/     # Model execution layer (createRuntime({ model, preferredBackend }))
│   └── moderation/  # First high-level application (createModerator)
│
├── apps/
│   ├── demo/
│   ├── moderation/
│   └── dashboard/
│
├── models/
├── docs/
├── tests/
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Key interfaces

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

interface Aggregator<T> {
  add(result: T): void;
  complete(): boolean;
  finalize(): T;
}
```

## Resource management

Users' devices must not be unexpectedly consumed by inference:

```ts
createClient({
  maxConcurrentTasks: 1,
  maxGpuUtilization: 0.25,
  onlyWhenVisible: true,
  onlyWhenCharging: false,
  allowCellular: false,
});
```

Policies: run only while app is active, max inference frequency, max memory, pause on low-power or backgrounded browser, user opt-in.

## Technology stack

- **Client:** TypeScript, React, Web Workers, WebGPU, WebAssembly, ONNX Runtime Web
- **Server:** TypeScript, Node.js, WebSocket, Redis (queue/state), PostgreSQL (persistent metadata if needed)
- **Build:** pnpm, Turborepo, Vite, Vitest, Playwright
- **Deploy:** Vercel / Cloudflare initially — do not optimize infrastructure prematurely
