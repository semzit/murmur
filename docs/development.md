# Murmur — Development

Tooling and conventions for working on the Murmur monorepo.

## Tooling

| Tool                     | Purpose                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **pnpm** (workspaces)    | Package management; `workspace:*` deps link packages during development                                                                      |
| **TypeScript**           | Strict mode everywhere; types derived from zod schemas where possible                                                                        |
| **zod**                  | Single source of truth for protocol messages and domain models (`@murmur/core/src/schemas.ts`) — every wire message is validated, never cast |
| **ESLint** (flat config) | Type-aware linting (`typescript-eslint` strict config)                                                                                       |
| **Prettier**             | Formatting (120 cols, trailing commas)                                                                                                       |
| **Vitest**               | Unit tests per package + protocol integration tests in `tests/`                                                                              |
| **tsup**                 | Package builds → `dist/` (ESM + `.d.ts`)                                                                                                     |
| **Turborepo**            | Task orchestration + caching                                                                                                                 |

## Scripts

Run from the repo root:

| Command                                   | Description                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm dev`                                | Coordinator (`ws://localhost:8787`) + React demo (`http://localhost:5173`) |
| `pnpm dev:server` / `pnpm dev:web`        | Run one side only                                                          |
| `pnpm build`                              | Build all packages with tsup                                               |
| `pnpm typecheck`                          | `tsc --noEmit` across packages                                             |
| `pnpm lint`                               | ESLint                                                                     |
| `pnpm format` / `pnpm format:check`       | Prettier write / verify                                                    |
| `pnpm test`                               | All Vitest suites (core, client, server integration)                       |
| `pnpm --filter @murmur/core test`         | Single package                                                             |
| `pnpm --filter tests test -t "consensus"` | Single integration test                                                    |

## Source vs. published resolution

During development, packages resolve to their `src/` (exports field + Vite aliases). At publish time, `publishConfig` redirects consumers to `dist/`. This means:

- No build step is required before `pnpm dev`.
- `pnpm build` must pass before publishing.
- Never import from another package's `dist/` — use the package name.

## Adding a protocol field

1. Update the schema in `packages/core/src/schemas.ts` (or `messages.ts`).
2. Run `pnpm --filter @murmur/core typecheck` — inferred types propagate automatically.
3. Add a validation test in `packages/core/src/messages.test.ts`.
4. Update the protocol doc in `docs/protocol.md`.

## Testing a protocol change

The coordinator is exercised end-to-end in `tests/smoke.test.ts` (real WebSocket connections against an ephemeral-port server):

```bash
pnpm --filter tests test
```

## CI

`.github/workflows/ci.yml` runs install → typecheck → lint → format check → test → build on every push and PR.
