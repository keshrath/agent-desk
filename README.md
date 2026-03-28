# Agent Desk

Unified control center for AI coding agents -- terminals, dashboards, and orchestration in one Electron app.

## Features

### Terminal Management

- **Multi-terminal** with tabs, split views (horizontal/vertical), drag-and-drop reordering
- **Dockview grid layout** -- resize, maximize, and rearrange terminal panes freely
- **Pop-out windows** -- detach any terminal into its own native window
- **Shell profiles** -- Default Shell and Claude Code built-in; create custom profiles with command, args, env, cwd, and icon
- **Shell integration** -- OSC sequence parsing for current directory tracking, command boundary detection, and scroll marks
- **Inline rename** -- double-click tab labels to rename terminals

### Agent Intelligence

- **Agent Detection** -- auto-detects Claude Code sessions by parsing tool calls, file modifications, test results, and errors from terminal output
- **Agent Monitor** (Ctrl+5) -- live card-based dashboard showing all agents with status, task assignments, tool call counts, uptime, and activity
- **Lifecycle Controls** -- interrupt (SIGINT), stop (SIGTERM), kill (SIGKILL), and restart agents from the context menu or tab buttons
- **Cost Tracking** -- per-agent token/cost estimation in the status bar with $2/$5 warning thresholds
- **Terminal Chains** -- trigger commands in one terminal when another exits or changes status

### Multi-Agent Orchestration

- **Batch Launcher** (Ctrl+Shift+B) -- launch N agents at once with profile selection, naming patterns (`agent-{n}`), stagger delays, working directory, and initial commands
- **Templates / Recipes** -- save and load reusable multi-agent configurations; 2 built-in defaults (Quick Review: 3 agents, Parallel Tasks: 5 agents)
- **Communication Graph** -- canvas visualization of agent interactions fetched from the agent-comm API, with animated nodes and edge thickness by message count

### Search

- **Terminal Search** (Ctrl+F) -- search within the active terminal buffer using xterm.js search addon
- **Cross-Terminal Search** (Ctrl+Shift+F) -- async chunked search across all terminal buffers with case-sensitive and regex options, keyboard navigation, and jump-to-line

### Dashboard Integration

- **Agent Comm** (Ctrl+2) -- embedded agent-comm dashboard at localhost:3421 with injected action toolbar
- **Agent Tasks** (Ctrl+3) -- embedded agent-tasks pipeline at localhost:3422 with injected action toolbar
- **Agent Knowledge** (Ctrl+4) -- embedded agent-knowledge dashboard at localhost:3423 with injected action toolbar
- **Dashboard Health** -- 30-second health checks with auto-reconnect; sidebar status dots show service availability
- **Webview Bridge** -- bidirectional communication between dashboards and terminal state

### Event System

- **Event Stream** (Ctrl+E) -- filterable timeline panel showing up to 200 events with expandable details, severity color coding, and JSON export
- **Event Bus** -- internal pub/sub system emitting terminal lifecycle, agent tool calls, file modifications, test results, errors, and chain triggers
- **Filter groups** -- toggle Tools, Errors, Status, and Lifecycle events; filter by terminal; text search

### Session & Workspace

- **Session Persistence** -- auto-save every 60 seconds; restore prompt on startup with 10-second countdown; buffer replay for terminal history
- **Workspaces** (Ctrl+Shift+W / Ctrl+Alt+W) -- save and load named terminal layouts including commands, profiles, and working directories
- **Layout auto-save** -- dockview grid state persisted automatically

### Appearance

- **4 built-in themes** -- Default Dark, Default Light, Dracula, Nord; custom themes via the theme manager
- **Custom themes** -- full color customization including terminal ANSI colors, stored in localStorage
- **MD3 design language** -- consistent with agent-comm and agent-tasks dashboards
- **Fonts** -- Inter (UI), JetBrains Mono (terminal), Material Symbols Outlined (icons)
- **System tray** -- minimize to tray with context menu for quick terminal launch

### Configuration

- **40+ settings** -- terminal font/size/cursor/scrollback, dashboard URLs, sidebar position, close-to-tray, start-on-login, bell behavior, notifications
- **Config file** -- `~/.agent-desk/config.json` persists settings, profiles, workspaces, and templates
- **Keybinding customization** -- `~/.agent-desk/keybindings.json` for user overrides
- **Config hot-reload** -- file watcher triggers live updates on external config changes

### Reliability

- **Crash reporter** -- writes structured crash logs to `~/.agent-desk/crash-logs/` with memory snapshots
- **Auto-update** -- checks for updates with download and install prompts
- **System monitor** -- CPU, RAM, and disk usage in the status bar

## Keyboard Shortcuts

### Terminals

| Shortcut | Action |
|---|---|
| Ctrl+Shift+T | New terminal |
| Ctrl+Shift+C | New Claude session |
| Ctrl+W | Close terminal |
| Ctrl+Tab | Next terminal |
| Ctrl+Shift+Tab | Previous terminal |
| Ctrl+Shift+D | Split right |
| Ctrl+\\ | Split right (alt) |
| Ctrl+Shift+E | Split down |
| Ctrl+Shift+M | Toggle maximize |
| Ctrl+Shift+S | Save output to file |
| Ctrl+F | Search in terminal |
| Ctrl+Shift+F | Search all terminals |

### Navigation

| Shortcut | Action |
|---|---|
| Alt+Arrow | Focus adjacent terminal pane |
| Ctrl+1 | Terminals view |
| Ctrl+2 | Agent Comm view |
| Ctrl+3 | Agent Tasks view |
| Ctrl+4 | Agent Knowledge view |
| Ctrl+5 | Agent Monitor view |
| Ctrl+6 | Settings view |

### General

| Shortcut | Action |
|---|---|
| Ctrl+Shift+P | Command palette |
| Ctrl+P | Quick switcher |
| F1 | Show keyboard shortcuts |
| Ctrl+E | Toggle event stream |
| Ctrl+Shift+B | Batch agent launcher |
| Ctrl+Shift+W | Save workspace |
| Ctrl+Alt+W | Load workspace |
| Escape | Close overlays / search |

All shortcuts are customizable via Settings or `~/.agent-desk/keybindings.json`.

## Getting Started

### Prerequisites

- Node.js 22+
- npm

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

### Run (development)

```bash
npm run dev
```

### Package

```bash
npm run package
```

## Architecture

```
src/
  main/           TypeScript — Electron main process
    index.ts        App entry, window management, tray, IPC handlers
    terminal-manager.ts   node-pty terminal lifecycle
    system-monitor.ts     CPU/RAM/disk polling
    crash-reporter.ts     Crash log writer
  preload/         TypeScript — context bridge
    index.ts        Exposes window.agentDesk API (terminal, session, config, etc.)
    webview-bridge.ts     Preload script for dashboard webviews
  renderer/        Vanilla JS — UI (served directly, not compiled)
    index.html      Main HTML with local vendor imports
    app.js          Entry point, session restore, global listeners
    agent-monitor.js      Agent Monitor view (Ctrl+5)
    agent-parser.js       Claude Code output parser
    agent-features.js     Terminal chains, agent registry
    batch-launcher.js     Batch launch modal
    templates.js          Agent templates/recipes CRUD
    comm-graph.js         Communication graph canvas
    commands.js           Command palette, quick switcher, context menus
    event-stream.js       Event timeline panel
    global-search.js      Cross-terminal search
    keybinding-manager.js Customizable keyboard shortcuts
    keybinds.js           Shortcut registration
    settings.js           Settings panel (40+ options)
    theme-manager.js      Theme system (4 built-in + custom)
    workspaces.js         Workspace save/load
    views.js              Sidebar, view switching
    layout.js             Dockview grid management
    terminals.js          Terminal creation, tabs, status
    dashboard.js          Dashboard bridge
    dashboard-injectors/  Per-dashboard toolbar injection
    system-monitor.js     Status bar stats + cost tracking
    shell-integration.js  OSC sequence parsing
    state.js              Shared state and registry
    event-bus.js          Pub/sub event system
    styles.css            MD3 dark theme + all component styles
    vendor/               Local xterm.js + dockview-core (gitignored, copied at build)
```

### Process Model

- **Main process** (TypeScript, compiled to `dist/main/`): manages terminal PTYs via node-pty, handles IPC, system tray, config file I/O, health checks, auto-updates, crash reporting
- **Preload** (TypeScript, compiled to `dist/preload/`): exposes `window.agentDesk` with sandboxed IPC bindings for terminal, session, config, dashboard, system monitor, dialogs, keybindings, and history APIs
- **Renderer** (vanilla JS, served from `src/renderer/`): builds the UI with no framework, uses locally bundled vendor libraries (xterm.js, dockview-core) copied from node_modules at build time

## Configuration

Config is stored at `~/.agent-desk/config.json` and organized into sections:

| Section | Key Settings |
|---|---|
| Terminal | `fontSize`, `fontFamily`, `cursorStyle`, `cursorBlink`, `scrollback`, `lineHeight` |
| Shell | `defaultShell`, `defaultTerminalCwd`, `defaultNewTerminalCommand` |
| Dashboard | `agentCommUrl`, `agentTasksUrl`, `agentKnowledgeUrl` |
| Appearance | `sidebarPosition`, `showStatusBar`, `tabCloseButton`, `theme` / `themeId` |
| Behavior | `closeToTray`, `startOnLogin`, `newTerminalOnStartup` |
| Notifications | `bellSound`, `bellVisual`, `desktopNotifications` |

### Dashboard Services

| Service | Default URL | Purpose |
|---|---|---|
| agent-comm | http://localhost:3421 | Agent communication hub |
| agent-tasks | http://localhost:3422 | Task pipeline management |
| agent-knowledge | http://localhost:3423 | Knowledge base |

## Development

```bash
npm run build          # Compile TypeScript + copy vendor libs
npm run dev            # Build + launch Electron
npm run watch          # Watch TypeScript for changes
npm test               # Unit tests (vitest)
npx playwright test    # E2E tests
npx eslint src/        # Lint
npx prettier --write . # Format
npm run package        # Build distributable
```

## Design System

- Accent: `#5d8da8`
- Background: `#1a1d23`
- Surface: `#21252b`
- Font: Inter (UI), JetBrains Mono (terminal)
- Icons: Material Symbols Outlined
- MD3 design language, consistent with agent-comm and agent-tasks dashboards

## License

ISC
