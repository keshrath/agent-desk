# Architecture

Agent Desk is an Electron application with a clear separation between the main process, preload bridge, and renderer.

## Process Model

```
┌─────────────────────────────────────────────────┐
│                 Main Process                     │
│  (Node.js + Electron)                           │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ index.ts      │  │ terminal-manager.ts      │ │
│  │ Window mgmt   │  │ node-pty lifecycle       │ │
│  │ Tray, IPC     │  │ Buffer capture           │ │
│  │ Auto-update   │  │ History tracking         │ │
│  │ Config watch  │  │                          │ │
│  └──────────────┘  └──────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ system-       │  │ crash-reporter.ts        │ │
│  │ monitor.ts    │  │ Crash log writer         │ │
│  │ CPU/RAM/Disk  │  │ Log rotation             │ │
│  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────┘
                      │ IPC
                      ▼
┌─────────────────────────────────────────────────┐
│               Preload Bridge                     │
│  (Context Bridge)                                │
│                                                  │
│  window.agentDesk API                            │
│  - terminal.create/write/resize/kill/...         │
│  - session.save/load/getBuffer/...               │
│  - config.read/write/getPath/onChange             │
│  - keybindings.read/write                        │
│  - system.getStats/startMonitoring/...           │
│  - dashboard.getStatus/onStatusChanged           │
│  - window.minimize/maximize/close                │
│  - dialog.saveFile/openDirectory                 │
│  - app.checkForUpdates/installUpdate/...         │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│                Renderer Process                  │
│  (Vanilla JS, not compiled)                      │
│                                                  │
│  ┌─────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │ app.js  │ │ state.js │ │ event-bus.js    │  │
│  │ Entry   │ │ Shared   │ │ Pub/sub events  │  │
│  └─────────┘ └──────────┘ └─────────────────┘  │
│                                                  │
│  ┌──────────────┐ ┌───────────────────────────┐ │
│  │ terminals.js │ │ layout.js                 │ │
│  │ Tab mgmt     │ │ Dockview grid             │ │
│  └──────────────┘ └───────────────────────────┘ │
│                                                  │
│  ┌──────────────┐ ┌───────────────────────────┐ │
│  │ agent-       │ │ agent-parser.js           │ │
│  │ monitor.js   │ │ Output parsing            │ │
│  │ Cards view   │ │ Tool call extraction      │ │
│  └──────────────┘ └───────────────────────────┘ │
│                                                  │
│  ┌──────────────┐ ┌───────────────────────────┐ │
│  │ batch-       │ │ templates.js              │ │
│  │ launcher.js  │ │ Agent templates           │ │
│  │ Multi-launch │ │ CRUD + palette            │ │
│  └──────────────┘ └───────────────────────────┘ │
│                                                  │
│  ┌──────────────┐ ┌───────────────────────────┐ │
│  │ global-      │ │ event-stream.js           │ │
│  │ search.js    │ │ Timeline panel            │ │
│  │ Cross-term   │ │ Filter + export           │ │
│  └──────────────┘ └───────────────────────────┘ │
│                                                  │
│  + views.js, commands.js, settings.js,           │
│    theme-manager.js, keybinding-manager.js,      │
│    workspaces.js, comm-graph.js,                 │
│    shell-integration.js, system-monitor.js,      │
│    notifications.js, drag-drop.js,               │
│    context-menus.js, dashboard-injectors/         │
└─────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Electron 35 |
| Terminal emulation | xterm.js 5.5 |
| PTY management | node-pty |
| Grid layout | dockview-core 5.1 |
| Main/preload language | TypeScript 5.7 |
| Renderer language | Vanilla JavaScript (ES modules) |
| Styling | CSS custom properties (no preprocessor) |
| Build | TypeScript compiler + vendor copy script |
| Packaging | electron-builder |
| Testing | Vitest (unit), Playwright (E2E) |
| Linting | ESLint 9 + Prettier |

## Design Decisions

### Vanilla JS Renderer

The renderer uses plain JavaScript with ES modules rather than a framework like React or Vue. This was a deliberate choice for:

- **Simplicity** -- no build step for the renderer, hot-reload friendly
- **Performance** -- no virtual DOM overhead for terminal rendering
- **Vendor bundling** -- xterm.js and dockview are copied as local vendor libraries

### Local Vendor Libraries

Instead of importing xterm.js and dockview from node_modules at runtime, a build script (`scripts/copy-vendor.js`) copies them to `src/renderer/vendor/`. This ensures:

- No module resolution issues in the Electron renderer
- Explicit version control over vendor dependencies
- Clean separation from Node.js-only packages

### IPC API Design

All main-process functionality is exposed through the `window.agentDesk` preload API. The renderer never imports Node.js modules directly. This follows Electron security best practices:

- Context isolation is enabled
- Node integration is disabled in the renderer
- All privileged operations go through the preload bridge

### Config File Architecture

Settings use a dual-storage approach:

1. **Primary**: `~/.agent-desk/config.json` (file system, cross-session)
2. **Cache**: localStorage (fast access, same-session)

The config file is watched for external changes, enabling sync with other tools or file sync services.

## Module Dependency Graph

The renderer modules follow a layered dependency pattern:

- **state.js** -- shared state and registry, imported by most modules
- **event-bus.js** -- pub/sub system, imported by event producers/consumers
- **app.js** -- entry point that initializes all modules
- **Feature modules** (terminals, search, events, etc.) -- import state and event-bus, export to registry

## Related

- [Configuration Reference](/reference/configuration) -- Config file schema
- [Contributing](/reference/contributing) -- Development setup
