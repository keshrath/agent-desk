# Testing

agent-desk has three layers of automated tests, each with a different scope
and runtime cost.

## Layer 1 — Unit (vitest)

**Location**: `tests/unit/*.test.ts`
**Runtime**: ~3 seconds
**Run**: `npm test`

One file per public module in `@agent-desk/core`. Each suite tests the
module in isolation, with no real filesystem state outside per-test
`mkdtempSync` directories that get cleaned up in `afterEach`.

| Test file                  | Module under test                              |
| -------------------------- | ---------------------------------------------- |
| `terminal-manager.test.ts` | `packages/core/src/terminal-manager.ts`        |
| `config-store.test.ts`     | `packages/core/src/config-store.ts`            |
| `keybindings-store.test.ts`| `packages/core/src/keybindings-store.ts`       |
| `history-store.test.ts`    | `packages/core/src/history-store.ts`           |
| `file-ops.test.ts`         | `packages/core/src/file-ops.ts`                |
| `session-store.test.ts`    | `packages/core/src/session-store.ts`           |
| `plugin-system.test.ts`    | `packages/core/src/plugin-system.ts`           |
| `crash-reporter.test.ts`   | `packages/core/src/crash-reporter.ts`          |
| `paths.test.ts`            | `packages/core/src/platform/paths.ts`          |
| `router.test.ts`           | `packages/core/src/transport/router.ts`        |
| `api-shape.test.ts`        | `packages/core/src/transport/api-shape.ts`     |

### Conventions

- **Per-test tmpdir**: any test that touches the filesystem creates a fresh
  `mkdtempSync` directory and sets `AGENT_DESK_USER_DATA` so `paths.ts`
  picks it up. The dir is deleted in `afterEach`.
- **`vi.resetModules()`**: stores cache `CONFIG_FILE`-style constants at
  module-load time, so each test re-imports the module via dynamic
  `import()` after setting the env var.
- **No real ptys**: `terminal-manager.test.ts` mocks `node-pty` because
  spawning real ptys is flaky on Windows. Other tests that need a stub
  `TerminalManager` build a plain object that implements just the methods
  they exercise.
- **No real SDK contexts**: tests do NOT spin up `agent-comm` /
  `agent-tasks` / `agent-knowledge` / `agent-discover` SDK contexts. Those
  are exercised by Layer 2.

## Layer 2 — Integration (vitest)

**Location**: `tests/integration/*.test.ts`
**Runtime**: ~5 seconds (spawns + tears down a server per suite)
**Run**: `npm test` (same vitest config)

Each integration test spawns a real `@agent-desk/server` process via
`child_process.spawn`, waits for the boot banner, then talks to it over
WebSocket / HTTP.

| Test file                       | What it proves                                              |
| ------------------------------- | ----------------------------------------------------------- |
| `server-ws.test.ts`             | Token gating + 5 channels round-trip via WS                 |
| `server-readonly.test.ts`       | `--readonly` flag blocks 17 mutating channels server-side   |
| `server-rate-limit.test.ts`     | Token bucket + terminal cap reject runaway clients          |

These prove the dual-target architecture is real: the SAME core stores
that the desktop drives via Electron IPC also answer requests from a
node WebSocket client.

### Conventions

- Each suite uses a unique port to allow parallel-suite execution.
- Fresh `AGENT_DESK_TOKEN` per suite (no token reuse across tests).
- The server's stdout is monitored for the `http://127.0.0.1:PORT` boot
  banner before any RPC fires.
- Cleanup in `afterAll` kills the server process.

## Layer 3 — Browser E2E (playwright)

**Location**: `tests/e2e/web/*.spec.ts`
**Runtime**: ~6 seconds
**Run**: `npm run test:e2e:web`

Playwright's `web` project boots `@agent-desk/server` via the `webServer`
config block, then runs chromium against the served UI. Validates the
dual-target architecture from the renderer's perspective.

| Test                                                            | What it proves                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| healthz responds without a token                                | Unauthenticated `/healthz` endpoint works                     |
| protected route blocks without a token                          | Token gate enforced on the static UI route                    |
| protected route serves UI shell with a valid token              | Static UI route delivers HTML when authenticated              |
| renders the UI in a real browser                                | Chromium loads the page, sets the title, no page errors       |
| serves the @agent-desk/ui web shim with a valid token           | `/ui/web-entry.js` static route works                         |
| injects the web-entry script tag into the served index.html     | Server-side template injection adds the WS bootstrap script   |
| serves the placeholder PWA icons with a valid token             | Icon assets are reachable                                     |
| rejects WS upgrade without a token                              | `/ws` upgrade gate enforced                                   |

### Electron project (skipped on CI)

`tests/e2e/*.spec.ts` (without the `web/` prefix) tests the Electron
desktop via `playwright-electron`. These currently can't run on the
project's GitHub Actions runner because:

1. The CI runner has no display server.
2. `electron-rebuild` of `better-sqlite3` is brittle without VS build
   tools / python on the agent.

The local dev workflow is `npm run rebuild:desktop && npx playwright test
--project=electron` (electron-rebuild required after any change to
better-sqlite3 or Electron's bundled Node version).

## One-shot validation

`npm run check` runs the full pipeline: build → eslint → prettier check →
vitest → playwright web. Use this before pushing to validate locally
exactly what CI will run.

## CI

`.github/workflows/ci.yml` runs Layer 1 + Layer 2 + Layer 3 (web only)
on every push to `main` and on pull requests. Tag pushes additionally
trigger the `build-linux` job which produces an AppImage artifact.

Current numbers (as of v1.4.10):

- 17 vitest test files
- 195 vitest tests (unit + integration)
- 8 playwright web e2e tests
- **203 tests total in CI**
- 0 lint errors, 0 prettier diff
- ~10 second total CI runtime (excluding electron-builder)

## Adding a new test

1. **For a new core module**: write `tests/unit/<module>.test.ts`. Mirror
   the existing pattern: `mkdtempSync` + env override + `vi.resetModules()`
   + dynamic import.
2. **For a new server channel**: add an assertion to
   `tests/integration/server-ws.test.ts` (one round-trip rpc per channel
   bucket is enough; the unit tests already cover the handler bodies).
3. **For a new renderer surface**: add a playwright assertion to
   `tests/e2e/web/server-ui.spec.ts` if it shows up in the chromium
   render path.
4. **For a desktop-only feature**: add it to a new `tests/e2e/<feature>
   .spec.ts` under the electron project. Run locally with `npm run
   rebuild:desktop && npx playwright test --project=electron`.
