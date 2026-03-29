# Architecture

## System Overview

Agent Desk is an Electron application with three process layers: main (Node.js), preload (context bridge), and renderer (browser). The main process manages terminal PTYs, system resources, and IPC. The renderer builds the UI with vanilla JavaScript and locally bundled vendor libraries.

```
┌─────────────────────────────────────────────────────────────┐
│                        Electron App                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Renderer Process                    │   │
│  │                                                       │   │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────┐  │   │
│  │  │ Terminal │ │  Agent   │ │  Batch    │ │ Event  │  │   │
│  │  │  Grid   │ │ Monitor  │ │ Launcher  │ │ Stream │  │   │
│  │  │(dockview)│ │          │ │           │ │        │  │   │
│  │  └────┬────┘ └────┬─────┘ └─────┬─────┘ └───┬────┘  │   │
│  │       │           │             │            │        │   │
│  │  ┌────┴───────────┴─────────────┴────────────┴────┐  │   │
│  │  │              State + Event Bus                  │  │   │
│  │  └────────────────────┬───────────────────────────┘  │   │
│  │                       │                               │   │
│  │  ┌────────────────────┴───────────────────────────┐  │   │
│  │  │         window.agentDesk (Preload API)          │  │   │
│  │  └────────────────────┬───────────────────────────┘  │   │
│  └───────────────────────┼───────────────────────────────┘   │
│                          │ IPC (contextBridge)               │
│  ┌───────────────────────┼───────────────────────────────┐   │
│  │                  Main Process                          │   │
│  │                       │                                │   │
│  │  ┌─────────┐ ┌───────┴──────┐ ┌──────────┐ ┌───────┐ │   │
│  │  │Terminal  │ │   IPC        │ │  System  │ │ Crash │ │   │
│  │  │Manager  │ │  Handlers    │ │ Monitor  │ │Report │ │   │
│  │  │(node-pty)│ │              │ │          │ │       │ │   │
│  │  └─────────┘ └──────────────┘ └──────────┘ └───────┘ │   │
│  │                                                        │   │
│  │  ┌──────────┐ ┌────────────┐ ┌───────────┐            │   │
│  │  │  Tray    │ │  Config    │ │  Auto     │            │   │
│  │  │  Menu    │ │  Watcher   │ │  Updater  │            │   │
│  │  └──────────┘ └────────────┘ └───────────┘            │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Dashboard Webviews                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐  │   │
│  │  │agent-comm│ │agent-task│ │ agent-knowledge      │  │   │
│  │  │ :3421    │ │  :3422   │ │  :3423               │  │   │
│  │  └──────────┘ └──────────┘ └──────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Process Model

### Main Process (`src/main/`)

TypeScript, compiled to `dist/main/`. Runs in Node.js with full system access.

| File                  | Responsibility                                                      |
| --------------------- | ------------------------------------------------------------------- |
| `index.ts`            | App entry, BrowserWindow creation, tray menu, IPC handler registration, config file watcher, auto-update, dashboard health checks |
| `terminal-manager.ts` | PTY lifecycle via node-pty: spawn, write, resize, kill, signal, buffer capture, history tracking |
| `system-monitor.ts`   | CPU, RAM, and disk usage polling via `os` module                    |
| `crash-reporter.ts`   | Structured crash log writer with memory snapshots, rotation (max 10)|

### Preload (`src/preload/`)

TypeScript, compiled to `dist/preload/`. Runs in a sandboxed context between main and renderer.

| File                | Responsibility                                                  |
| ------------------- | --------------------------------------------------------------- |
| `index.ts`          | Exposes `window.agentDesk` API via `contextBridge.exposeInMainWorld` -- terminal, session, config, dialog, keybindings, history, dashboard, system, app lifecycle |
| `webview-bridge.ts` | Preload script injected into dashboard webviews for bidirectional state sync |

### Renderer (`src/renderer/`)

Vanilla JavaScript served directly from the source directory -- **not compiled**. Uses locally bundled vendor libraries (xterm.js, dockview-core) copied from `node_modules` at build time.

No frameworks (React, Vue, etc.). All UI is built with DOM APIs, event listeners, and CSS custom properties.

## IPC Communication Flow

All renderer-to-main communication goes through `contextBridge`. The preload script exposes a structured API under `window.agentDesk`:

```
Renderer                    Preload                     Main
────────                    ───────                     ────
agentDesk.terminal.create() → ipcRenderer.invoke()    → ipcMain.handle('terminal:create')
                            ←                          ← returns terminal ID

agentDesk.terminal.onData() → ipcRenderer.on()        ← ipcMain sends 'terminal:data'
                              callback fires
```

### IPC Channels

| Namespace    | Examples                                              |
| ------------ | ----------------------------------------------------- |
| `terminal:`  | `create`, `write`, `resize`, `kill`, `signal`, `list` |
| `session:`   | `save`, `load`, `getBuffer`, `replayBuffer`           |
| `config:`    | `read`, `write`, `getPath`, `onChange`                 |
| `window:`    | `minimize`, `maximize`, `close`, `flashFrame`          |
| `dialog:`    | `saveFile`, `openDirectory`                            |
| `dashboard:` | `getStatus`, `onStatusChanged`                         |
| `system:`    | `getStats`, `startMonitoring`, `stopMonitoring`        |
| `app:`       | `checkForUpdates`, `installUpdate`, `reportError`      |
| `keybindings:` | `read`, `write`                                      |
| `history:`   | `get`, `clear`, `onNew`                                |

## Dashboard Integration

Three external dashboards are embedded as Electron `<webview>` tags:

```
agent-comm    → http://localhost:3421
agent-tasks   → http://localhost:3422
agent-knowledge → http://localhost:3423
```

### Health Monitoring

The main process runs HTTP health checks every 30 seconds against each dashboard URL. Results are pushed to the renderer, which updates sidebar status dots (green = healthy, red = unreachable).

### Webview Bridge

Each webview gets a custom preload script (`webview-bridge.ts`) that enables bidirectional communication:

- **Dashboard to App**: Dashboard can query terminal state, trigger terminal creation
- **App to Dashboard**: App pushes terminal updates, agent status changes

### Dashboard Injectors

Per-dashboard JavaScript files (`dashboard-injectors/*.js`) are injected into each webview after load to add a toolbar with quick actions (e.g., create agent, view tasks).

## Agent Detection Pipeline

The agent parser (`agent-parser.js`) processes terminal output in real time to detect Claude Code sessions:

```
Terminal Output
    │
    ▼
OSC Sequence Parser ──→ CWD tracking, command boundaries
    │
    ▼
Agent Parser
    ├── Tool call detection (Read, Write, Edit, Bash, Grep, Glob, etc.)
    ├── File modification tracking
    ├── Test result parsing (pass/fail counts)
    ├── Error detection
    └── Cost/token estimation
    │
    ▼
Event Bus ──→ Agent Monitor, Event Stream, Status Bar, Tab Badges
```

## Theme System

Themes are implemented via CSS custom properties on the document root. The theme manager applies a set of ~40 CSS variables covering:

- Background, surface, and border colors
- Text colors (primary, secondary, muted)
- Accent color and hover states
- Terminal ANSI colors (16 colors)
- Scrollbar, selection, and shadow colors

Built-in themes: Default Dark, Default Light, Dracula, Nord. Custom themes are stored in `localStorage`.

Early theme application (`theme-init.js`) runs before the main app loads to prevent flash of unstyled content.

## State Management

The renderer uses a centralized state module (`state.js`) that holds:

- Terminal map (ID to xterm instance + metadata)
- Dockview grid instance
- Active view (terminals, comm, tasks, knowledge, monitor, settings)
- Agent registry (detected agents with status, tools, costs)

The event bus (`event-bus.js`) provides pub/sub for decoupled communication between renderer modules:

| Event Category | Examples                                              |
| -------------- | ----------------------------------------------------- |
| Terminal       | `terminal:created`, `terminal:closed`, `terminal:data`|
| Agent          | `agent:detected`, `agent:tool-call`, `agent:error`    |
| Status         | `status:changed`, `cost:updated`                      |
| Chain          | `chain:triggered`, `chain:completed`                  |

## File Structure

```
agent-desk/
├── src/
│   ├── main/                   TypeScript — Electron main process
│   ├── preload/                TypeScript — context bridge
│   └── renderer/               Vanilla JS — UI (not compiled)
│       ├── vendor/             Local xterm.js + dockview-core (gitignored)
│       └── dashboard-injectors/ Per-dashboard toolbar injection
├── tests/
│   ├── unit/                   vitest unit tests (4 suites)
│   └── e2e/                    Playwright E2E tests (22 specs)
├── scripts/
│   └── copy-vendor.js          Copies vendor libs from node_modules
├── resources/                  App icons (ico, png, svg)
├── dist/                       Compiled TypeScript output (gitignored)
├── release/                    Packaged binaries (gitignored)
├── package.json                Dependencies and build config
├── tsconfig.json               TypeScript configuration
├── electron-builder.yaml       Packaging configuration (in package.json)
└── vitest.config.ts            Test configuration
```
