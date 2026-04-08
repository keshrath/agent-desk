# agent-desk

Dual-target AI agent control center: Electron desktop app AND web/PWA, sharing one transport-agnostic core.

## Overview

agent-desk runs as either:
- **Desktop**: Electron shell wrapping `@agent-desk/core` via IPC bridge.
- **Server + Web/PWA**: Node Express+ws server driving the same core over WebSocket, mobile PWA as a read-only (v1) client.

The renderer (`@agent-desk/ui`) is vanilla JS with zero Electron dependencies — it talks to whatever transport `window.agentDesk` is wired to.

## Workspace layout

```
packages/
  core/       @agent-desk/core     — transport-agnostic Node, no Electron
  desktop/    @agent-desk/desktop  — Electron main + preload, IPC bridge to core
  ui/         @agent-desk/ui       — vanilla JS renderer, zero Electron deps
  server/     @agent-desk/server   — Node Express+ws, single-user token auth, WS → core
  pwa/        @agent-desk/pwa      — thin mobile-optimized read-only entry over server
docs/         vitepress site (docs:dev / docs:build / docs:preview)
```

### `@agent-desk/core` public exports

From `packages/core/src/index.ts`:

- `TerminalManager` (+ `ManagedTerminal`, `TerminalClient`, `HistoryEntry`)
- `startMonitoring`, `stopMonitoring`, `getSystemStats`, `onStatsUpdate`, `SystemStats`
- `paths` namespace (platform paths)
- `setAppVersion`, `writeCrashLog`, `hasRecentCrashLogs`, `getLatestCrashLog`, `setupCrashHandlers`, `CRASH_LOG_DIR`
- `detectInstalledTools`, `configureToolMcp`, `autoConfigureMcpServers`, `configureClaudeCodeExtras`, `ConfigResult`
- `CONFIG_FILE`, `readConfig`, `writeConfig`, `watchConfig`, `ConfigData`
- `KEYBINDINGS_FILE`, `readKeybindings`, `writeKeybindings`
- `HistoryStore`, `HISTORY_FILE`
- `SESSION_DIR`, `SESSION_FILE`, `BUFFER_DIR`, `saveSession`, `loadSession`, `getSavedBuffer`, `SessionData`, `SessionTerminalData`, `SaveSessionInput`
- `fileStat`, `fileDirname`, `fileWrite`, `FileStat`
- `discoverPlugins`, `destroyPlugins`, `getPluginInfoList`, `resolvePluginAsset`, `getPluginConfig`, `LoadedPlugin`, `PluginManifest`, `PluginInfo`
- `createRouter`, `Router`, `RequestHandlers`, `CommandHandlers`, `CreateRouterOptions`
- All channel types (`RequestChannel`, `RequestChannelMap`, `PushChannel`, etc.)

## Build / dev / test

Run from the repo root (npm workspaces).

- `npm run build` — build all packages in dependency order
- `npm run dev` — desktop: build + launch Electron
- `npm run dev:server` — run dev server (`packages/server`)
- `npm run dev:pwa` — PWA dev server
- `npm test` — vitest across workspaces
- `npx playwright test` — E2E (desktop via `playwright-electron`, web via `playwright-browser`)
- `npx eslint .` — lint
- `npx prettier --check .` / `--write .` — format
- `npm run docs:dev` / `docs:build` / `docs:preview` — vitepress

## Transport contract

The single source of truth is `packages/core/src/transport/channels.ts`:

- **`RequestChannelMap`** — request/response (Promise<Result>). Buckets: terminal, session, file, config, keybindings, history, comm, tasks, knowledge, discover, system, app, mcp, plugins. ~55 channels.
- **`CommandChannelMap`** — fire-and-forget (`terminal:subscribe`, `terminal:unsubscribe`).
- **`PushChannelMap`** — core → renderer events (`terminal:data`, `terminal:exit`, `comm:update`, `tasks:update`, `knowledge:update`, `discover:update`, `config:changed`, `history:new`, `system:stats-update`).

Both transports (Electron IPC in `@agent-desk/desktop`, WebSocket in `@agent-desk/server`) dispatch through `createRouter()` from `packages/core/src/transport/router.ts`. The renderer calls `window.agentDesk.<bucket>.<method>()`; the preload (desktop) or WS client (web) marshals to a typed channel name.

## Adding a new IPC channel

1. Add the typed entry to `RequestChannelMap` / `CommandChannelMap` / `PushChannelMap` in `packages/core/src/transport/channels.ts`.
2. Implement the handler in the relevant core store (`packages/core/src/<store>.ts`) and register it in `createRouter` wiring.
3. Desktop bridge: expose it in `packages/desktop/src/preload/index.ts` under `window.agentDesk.<bucket>`.
4. Server bridge: the WS router auto-dispatches by channel name — nothing to add unless the payload needs special serialization.
5. UI: call it via `window.agentDesk.<bucket>.<method>()` — identical API for desktop and web.
6. Tests: unit-test the store handler in `packages/core`; add transport smoke test if new push channel.

## Desktop vs Web

| Capability            | Desktop                       | Web/Server                               |
| --------------------- | ----------------------------- | ---------------------------------------- |
| Transport             | Electron IPC (contextBridge)  | WebSocket, single-user token in URL      |
| Auth                  | OS user                       | Server-generated token, bind `127.0.0.1` |
| Tray                  | yes                           | stub (no-op)                             |
| Pop-out windows       | yes                           | stub                                     |
| `autoUpdater`         | electron-updater              | stub                                     |
| `flashFrame`          | yes                           | stub                                     |
| `shell.openPath`      | yes                           | stub                                     |
| Plugin assets         | `protocol.handle('plugin',…)` | HTTP `/plugins/:id/*`                    |
| PWA v1                | n/a                           | read-only monitoring                     |
| PWA v2                | n/a                           | full driving                             |

All electron-only fallbacks degrade gracefully on web — UI checks capability, not target.

## Plugin system

- Plugins discovered by `discoverPlugins()` in `packages/core/src/plugin-system.ts`.
- Manifest: `PluginManifest`. Loaded: `LoadedPlugin`. Info for renderer: `PluginInfo`.
- Asset serving:
  - Desktop: `protocol.handle('plugin', …)` registered in desktop main.
  - Server: HTTP route `/plugins/:id/*` resolving via `resolvePluginAsset()`.
- Config per plugin via `getPluginConfig(pluginId)` and the `plugins:getConfig` request channel.

## Config files

- `~/.agent-desk/config.json` — settings, profiles, workspaces, templates
- `~/.agent-desk/keybindings.json` — user keybinding overrides
- `~/.agent-desk/crash-logs/` — rotated (max 10)
- `~/.agent-desk/sessions/` — saved terminal sessions + replay buffers
- `~/.agent-desk/history.json` — command history

All paths resolved through `core/src/platform/paths.ts`. Do not hardcode paths in `desktop/`, `server/`, or `ui/`.

## Rules

- Core is **Node-only, no Electron imports**. Ever. If it compiles against `electron`, it doesn't belong in `core`.
- UI is **vanilla JS, no Electron imports**. Talks only to `window.agentDesk`.
- All renderer ↔ backend communication goes through the channel contract. No ad-hoc IPC.
- Bump the channel contract first, then implement. The contract is the spec.
- Web auth: default-bind `127.0.0.1`, require token for any non-loopback bind, check WS origin.
- Do not leak desktop-only APIs (`tray`, `popout`, `autoUpdater`, `flashFrame`, `shell.openPath`) into core or ui — use stubs on web.
- Keep `package.json`, `server.json`, and `agent-desk-plugin.json` versions in sync when releasing.
- TypeScript for `core`, `desktop`, `server`. Vanilla JS for `ui` and `pwa`.
