# Murmur — Quickstart

## Requirements

- Node.js >= 20
- pnpm >= 9
- A browser (Chrome/Edge recommended)

## Install

```bash
pnpm install
```

The demo model (MobileNet v2 int8, 3.5 MB) is committed in `models/` — no download step.

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
4. The coordinator assigns the task to browsers running the matching runtime (ONNX Runtime Web).
5. Each tab runs the real MobileNet v2 model **locally in a Web Worker** (WebGPU when available, WASM fallback; the model is SHA-256 verified and cached).
6. Each tab returns its top-1 classification (`{ label, score }`).
7. The coordinator aggregates by **majority vote**; the demo maps the winning ImageNet class through a small policy (weapon/syringe classes → `unsafe`).
8. Every tab displays the per-worker breakdown, backend + model load time, and the consensus result.

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
import { createOnnxRuntime } from "@murmur/runtime";

const runtime = createOnnxRuntime({
  models: [
    {
      name: "moderation-v1",
      modelUrl: "/models/mobilenetv2-12-int8.onnx",
      sha256: "cc028fe6cae7bc11a4ff53cfc9b79c920e8be65ce33a904ec3e2a8f66d77f95f",
      labels: () => fetch("/models/synset.txt").then((r) => r.text()).then(parseSynset),
      preprocessing: { width: 224, height: 224, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
      backend: "auto",
    },
  ],
});

function App() {
  const { status, workers, requestTask, runtimeStatus } = useMurmur();
  // requestTask({ model: "moderation-v1", input: imageUrl }) -> FinalResult
}

export default function Root() {
  return (
    <MurmurProvider coordinator="ws://localhost:8787" options={{ runtime }}>
      <App />
    </MurmurProvider>
  );
}
```

Models are interchangeable: swap the `models` config (URL, sha256, labels, preprocessing) and the coordinator's model metadata — the protocol and client don't change.

## Verify success

- All tabs appear in the **Workers** panel (runtime: `onnxruntime-web`).
- Each worker independently classifies the same image — e.g. the built-in cat fixture resolves to `cougar, puma, catamount, …` with agreement 100%.
- The UI shows individual results plus an aggregated consensus.

## Tests

```bash
pnpm test        # Vitest: core (aggregation/schemas), runtime (real model inference), protocol integration
pnpm test:e2e    # Playwright: 3 real browsers run the actual model locally and reach consensus
```

## Scripts

| Command                     | Description                              |
| --------------------------- | ---------------------------------------- |
| `pnpm dev`                  | Coordinator + web app                    |
| `pnpm dev:server`           | Coordinator only (`tsx watch`)           |
| `pnpm dev:web`              | Vite only                                |
| `pnpm typecheck`            | Type-check all packages                  |
| `pnpm test`                 | All Vitest suites                        |
| `pnpm test:e2e`             | Playwright e2e (real model)              |
