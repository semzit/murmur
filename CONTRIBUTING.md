# Contributing to Murmur

Thanks for considering contributing. This document covers how to set up the project, run checks, and get changes merged.

## Development setup

Requirements:

- Node.js >= 20
- pnpm >= 9 (pinned in `packageManager`; `corepack enable` will install the right version)

```bash
pnpm install
```

## Scripts

| Command                           | Description                                                               |
| --------------------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`                        | Run the coordinator + React demo (open `http://localhost:5173` in 3 tabs) |
| `pnpm dev:server`                 | Coordinator only                                                          |
| `pnpm dev:web`                    | Vite web app only                                                         |
| `pnpm build`                      | Build all packages with tsup (outputs to `dist/`)                         |
| `pnpm typecheck`                  | Type-check every package                                                  |
| `pnpm lint`                       | ESLint (flat config, type-aware)                                          |
| `pnpm format`                     | Prettier --write                                                          |
| `pnpm format:check`               | Prettier --check                                                          |
| `pnpm test`                       | Vitest (unit + protocol integration tests)                                |
| `pnpm --filter @murmur/core test` | Test a single package                                                     |

## Conventions

- All code is TypeScript, strict mode, `verbatimModuleSyntax` (use `import type` for types).
- Imports use explicit `.ts` extensions (dev-mode source resolution).
- Protocol messages are validated with zod in `@murmur/core` — never cast raw wire data.
- Format with Prettier, lint with ESLint, and make sure all checks pass before opening a PR:

```bash
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test
```

## Package layout

```
packages/
├── core/        # zod schemas, types, protocol messages, aggregation
├── client/      # browser client
├── react/       # React integration (MurmurProvider / useMurmur)
└── server/      # coordinator
```

Packages resolve to `src/` during development and to `dist/` when published (see `publishConfig` in each `package.json`).

## Pull request process

1. Branch from `main` (e.g. `feat/...`, `fix/...`).
2. Make changes with tests where practical.
3. Run the checks above.
4. Open a PR; CI runs install → typecheck → lint → test → build.
