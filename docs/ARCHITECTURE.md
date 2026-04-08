# Architecture

agent-desk is a **dual-target** application: the same feature set ships as an Electron desktop app and as a Node web server with a PWA frontend. Both targets share a single transport-agnostic core package.

## Why dual-target

The desktop app is excellent for power users at their workstation, but AI agents run for hours or days and users want to check on them from a phone, tablet, or a different machine. Rather than maintaining two codebases, we extracted all business logic into `@agent-desk/core` — a Node library with no UI or Electron dependency — and put two thin shells on top:

- **Desktop** wraps core with Electron IPC for zero-latency local access and native OS features (tray, autoupdate, notifications).
- **Server** exposes core over WebSocket, reusing the exact same channel contract. A mobile PWA connects over HTTPS.

The renderer (`@agent-desk/ui`) has no knowledge of which transport it is running on. It always calls `window.agentDesk.<bucket>.<method>()`; the preload (desktop) or WS client (PWA) is responsible for marshalling.

## Package responsibilities

| Package              | Runtime              | Depends on | Purpose                                                          |
| -------------------- | -------------------- | ---------- | ---------------------------------------------------------------- |
| `@agent-desk/core`   | Node                 | —          | All stores, terminal/pty, system monitor, plugin system, router  |
| `@agent-desk/desktop`| Electron             | core, ui   | Main process, preload bridge, tray, autoupdater, file dialogs    |
| `@agent-desk/ui`     | Browser (vanilla JS) | —          | Renderer: layout, terminals, views, commands, themes             |
| `@agent-desk/server` | Node                 | core, ui   | Express + ws, token auth, plugin HTTP route, serves ui static    |
| `@agent-desk/pwa`    | Browser              | —          | Mobile-optimized entry that connects to server over WS           |

Core is strict: **no `electron` imports, ever**. If a capability needs Electron (tray, autoupdate, native dialogs), it lives in `desktop/` and is stubbed in `server/`.

## Transport contract

The channel contract in `packages/core/src/transport/channels.ts` is the source of truth. Reference table (buckets and channels as of this writing):

### Request channels

| Bucket      | Channels                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| terminal    | `create`, `write`, `resize`, `kill`, `signal`, `restart`, `list`                                                |
| session     | `save`, `load`, `getBuffer`, `autoSave`, `replayBuffer`, `setAgentInfo`, `saveLayout`                           |
| file        | `write`, `stat`, `dirname`                                                                                      |
| config      | `read`, `write`, `getPath`                                                                                      |
| keybindings | `read`, `write`                                                                                                 |
| history     | `get`, `clear`                                                                                                  |
| comm        | `state`, `agents`, `messages`, `channels`, `state-entries`, `feed`                                              |
| tasks       | `state`, `list`, `get`, `search`                                                                                |
| knowledge   | `entries`, `read`, `search`, `sessions`, `session`                                                              |
| discover    | `state`, `servers`, `server`, `browse`, `activate`, `deactivate`, `delete`, `secrets`, `metrics`, `health`      |
| system      | `stats`, `start-monitoring`, `stop-monitoring`                                                                  |
| app         | `reportError`, `getCrashLogDir`                                                                                 |
| mcp         | `detect-tools`, `auto-configure`                                                                                |
| plugins     | `list`, `getConfig`                                                                                             |

### Command channels (fire-and-forget)

`terminal:subscribe`, `terminal:unsubscribe`.

### Push channels (core → renderer)

`terminal:data`, `terminal:exit`, `comm:update`, `tasks:update`, `knowledge:update`, `discover:update`, `config:changed`, `history:new`, `system:stats-update`.

## Request flow

```
renderer (ui)
   └─ window.agentDesk.terminal.write(id, data)
        ├─ preload (desktop) ──ipcRenderer.invoke──▶ main process
        │    or
        └─ ws-client (pwa/web) ──JSON frame──▶ server ws handler
             └─ router.dispatch('terminal:write', [id, data])
                  └─ TerminalManager.write(id, data)
                       └─ node-pty write
                            ◀─ result ─┘
```

Both transports serialize the same `{ channel, args, id }` envelope and the router invokes the store method registered for that channel. The store returns a Promise; the result travels back on the same envelope id.

## Push flow

```
TerminalManager
   └─ pty 'data' event
        └─ core EventEmitter.emit('terminal:data', id, data)
             ├─ desktop main: BrowserWindow.webContents.send('terminal:data', ...)
             │       └─ preload forwards to window.agentDesk.terminal.onData
             └─ server: ws.send({ type: 'push', channel: 'terminal:data', args: [...] })
                     └─ ws-client in pwa/web dispatches to registered listener
```

Only subscribers (via `terminal:subscribe`) receive `terminal:data` for a given id — this keeps bandwidth bounded when 20 terminals are running but the user is viewing one.

## Adding a new feature — worked example

Adding a "reload plugin" capability:

1. **Contract**. Add to `RequestChannelMap` in `channels.ts`:
   ```ts
   'plugins:reload': { args: [pluginId: string]; result: { ok: boolean; error?: string } };
   ```
2. **Core store**. In `packages/core/src/plugin-system.ts` export `reloadPlugin(id)`. Register it in the router wiring where the other `plugins:*` channels are bound.
3. **Desktop bridge**. In `packages/desktop/src/preload/index.ts`, add `plugins.reload: (id) => ipcRenderer.invoke('plugins:reload', id)`.
4. **Server bridge**. Nothing to do — the WS router dispatches by channel name.
5. **UI**. Wire a button in the plugin settings view to `await window.agentDesk.plugins.reload(id)`.
6. **Test**. Unit-test `reloadPlugin` in core with a fake plugin directory. E2E the button via `playwright-electron` and `playwright-browser`.

## Threat model (web-only)

The desktop target runs with the trust boundary at the OS user. The web target introduces new concerns:

### Auth

- **Single-user** by design. On first launch, the server generates a random 32-byte token, prints a URL like `http://127.0.0.1:8787/#t=<token>`, and persists it to `~/.agent-desk/server-token`.
- The token is required on both the HTTP handshake (for `GET /` and `/plugins/*`) and the WS upgrade.
- No multi-user, no roles, no login form.

### Bind address

- Default bind: `127.0.0.1`. Non-loopback binds require an explicit `--bind` flag and a non-empty token file.
- Refuse to start if bound to `0.0.0.0` without a token.

### CORS / WS origin

- HTTP: `Access-Control-Allow-Origin` echoes only the configured public origin (or none for loopback).
- WS upgrade: check `Origin` header against an allowlist. Drop on mismatch.

### Terminal exposure

- The server exposes real PTYs on the host. This is the highest-risk surface.
- Mitigations: token auth on every WS frame, rate-limit `terminal:create`, optional env var `AGENT_DESK_SERVER_READONLY=1` which makes the router refuse any channel in a mutating allowlist (`terminal:create|write|kill|signal|restart`, `file:write`, `config:write`, `keybindings:write`, `discover:activate|deactivate|delete`). PWA v1 runs with this flag on.

### TLS

- The server speaks plain HTTP. For non-loopback deployments, terminate TLS at a reverse proxy (Caddy recommended — see `deployment.md`).
- Never ship a mode that binds non-loopback over plain HTTP without an explicit `--insecure` flag.
