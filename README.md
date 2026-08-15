# Murmur

Browser-native distributed inference network.

> Applications can delegate machine-learning inference to the clients that are already using them.

## Packages

| Package          | Purpose                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `@murmur/core`   | Zod-validated protocol primitives: schemas, tasks, results, aggregation  |
| `@murmur/client` | Browser client: registration, task handling, policies, pluggable runtime |
| `@murmur/react`  | React integration — wrap an application with `<MurmurProvider>`          |
| `@murmur/server` | Coordinator: registration, task distribution, consensus                  |

## Quick start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173` in three tabs, pick an image, click **Run task**.

Docs: [`docs/`](./docs) — start with [`docs/quickstart.md`](./docs/quickstart.md) and [`docs/vision.md`](./docs/vision.md).

## Development

```bash
pnpm test        # Vitest: unit + protocol integration tests
pnpm lint        # ESLint (type-aware)
pnpm typecheck   # tsc --noEmit
pnpm build       # tsup → dist/
```

See [`docs/development.md`](./docs/development.md) and [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Wrap an application

```tsx
<MurmurProvider coordinator="ws://localhost:8787">
  <App />
</MurmurProvider>
```

```ts
const { requestTask } = useMurmur();
const result = await requestTask({ model: "moderation-v1", input: imageUrl });
// { value, label: "safe" | "unsafe", agreement, workers }
```
