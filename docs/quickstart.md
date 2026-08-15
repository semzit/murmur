# Murmur — Quickstart

## Requirements

- Node.js >= 20
- pnpm >= 9
- A browser (Chrome/Edge recommended)

## Install

```bash
pnpm install
```

## Run the demo

```bash
pnpm dev
```

This starts two processes:

- **Coordinator** — `ws://localhost:8787` (Murmur server)
- **Web app** — `http://localhost:5173` (Vite + React)

Open `http://localhost:5173` in **three browser tabs**.

## Prototype behavior

1. Open the demo in three browser tabs.
2. Each tab registers as a worker with the coordinator.
3. Pick a sample image (or paste any image URL) and click **Run task**.
4. The coordinator broadcasts the task to all connected tabs.
5. Each tab runs the model locally (currently a mock runtime; the real WebGPU/ONNX runtime plugs in behind the same `InferenceRuntime` interface).
6. Each tab returns its classification.
7. The coordinator aggregates the results (mean + threshold → `safe`/`unsafe`).
8. Every tab displays the per-worker breakdown and the consensus result.

```
Browser A
    |
    |    |     |  \
    |   Browser B  Browser C
    |       |
    +---+---+
        |
     WebSocket
        |
      Server
        |
    consensus
```

## Wrap it around your own application

```tsx
import { MurmurProvider, useMurmur } from "@murmur/react";

function App() {
  const { status, workers, requestTask } = useMurmur();
  // requestTask({ model: "moderation-v1", input: imageUrl }) -> FinalResult
}

export default function Root() {
  return (
    <MurmurProvider coordinator="ws://localhost:8787">
      <App />
    </MurmurProvider>
  );
}
```

## Verify success

- All tabs appear in the **Workers** panel.
- Each worker independently returns a score for the same image.
- The UI shows individual results plus an aggregated consensus.

## Protocol smoke test

With the coordinator running (`pnpm dev:server`), run:

```bash
pnpm --filter tests smoke
```

Expect output like:

```
TASK COMPLETE: {"value":0.48,"label":"safe","agreement":1,"workers":3}
```

## Scripts

| Command                     | Description                    |
| --------------------------- | ------------------------------ |
| `pnpm dev`                  | Coordinator + web app          |
| `pnpm dev:server`           | Coordinator only (`tsx watch`) |
| `pnpm dev:web`              | Vite only                      |
| `pnpm typecheck`            | Type-check all packages        |
| `pnpm --filter tests smoke` | Protocol end-to-end smoke test |
