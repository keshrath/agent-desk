# Features

Detailed documentation of Agent Desk features and capabilities.

## Table of Contents

- [Terminal Management](#terminal-management)
- [Agent Detection](#agent-detection)
- [Batch Launcher & Templates](#batch-launcher--templates)
- [Event Stream](#event-stream)
- [Cross-Terminal Search](#cross-terminal-search)
- [Shell Profiles](#shell-profiles)
- [Themes & Customization](#themes--customization)
- [Session Persistence](#session-persistence)
- [Workspaces](#workspaces)
- [Dashboard Integration](#dashboard-integration)
- [Cost Tracking](#cost-tracking)
- [Communication Graph](#communication-graph)
- [Terminal Chains](#terminal-chains)
- [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Terminal Management

Agent Desk uses [dockview-core](https://dockview.dev/) for a VS Code-style grid layout with full drag-and-drop support.

### Grid Layout

- **Tabs** -- each terminal gets a tab with name, status icon, and optional task badge
- **Split right** (Ctrl+Shift+D / Ctrl+\\) -- add a terminal to the right of the current pane
- **Split down** (Ctrl+Shift+E) -- add a terminal below the current pane
- **Maximize** (Ctrl+Shift+M) -- toggle maximize for the focused pane
- **Drag and drop** -- reorder tabs or drag them to different positions in the grid
- **Resize** -- drag pane borders to resize

### Tab Features

- **Inline rename** -- double-click a tab label to rename
- **Status indicators** -- colored dots show terminal state (running, idle, exited, error)
- **Task badges** -- `[T42]` badges show assigned pipeline tasks; click to jump to the tasks view
- **Close button** -- configurable per-tab close button
- **Context menu** -- right-click a tab for rename, close, split, chain, and lifecycle options

### Pop-Out Windows

Any terminal can be detached into its own native window. This is useful for placing terminals on different monitors. Pop-out windows share the same PTY process -- closing the pop-out does not kill the terminal.

### Terminal Output

Terminals use [xterm.js](https://xtermjs.org/) with addons:

- **WebGL renderer** -- GPU-accelerated rendering for smooth scrolling
- **Search addon** -- in-terminal search (Ctrl+F)
- **Web links addon** -- clickable URLs in terminal output
- **Fit addon** -- auto-resize terminal to container

---

## Agent Detection

Agent Desk parses terminal output in the background to detect AI agent sessions. Detection is fully automatic — no configuration needed — and results surface on several places in the UI rather than a dedicated "monitor" view (the standalone Agent Monitor was removed in v1.6.0 because its information already lives on the tab bar and inside the Agent Comm overview).

### What detection drives

- **Terminal tab indicators** — tab titles show the agent name, current status (running / idle / waiting / errored), and a pulse when the agent is awaiting user input.
- **Cost tracking** — per-terminal token/cost estimates in the status bar with $2 / $5 warning thresholds.
- **Agent Comm dashboard** (Ctrl+2) — cross-session agent roster, active agents list, and the recent activity feed.
- **Session persistence** — saved sessions remember which terminal was running which agent so titles and cost survive restarts.
- **Batch launcher naming patterns** — `agent-{n}` style names on bulk spawns.

### Recognized signals

The agent parser (`agent-parser.js`) matches on:

- Claude Code tool calls: Read, Write, Edit, Bash, Grep, Glob, TodoRead, TodoWrite, WebFetch, WebSearch, and more
- OpenCode / Aider / Cursor CLI / Gemini CLI / Amazon Q command patterns
- File modification markers
- Test result summaries (pass/fail counts)
- Error patterns and stack traces

No manual configuration is needed — if a terminal runs a known AI coding agent, it is detected.

---

## Batch Launcher & Templates

### Batch Launcher

**Shortcut:** Ctrl+Shift+B

Launch multiple agents at once with a single configuration:

| Option           | Description                                               |
| ---------------- | --------------------------------------------------------- |
| Count            | Number of agents to launch (1-20)                         |
| Profile          | Shell profile to use (Default Shell, Claude Code, custom) |
| Naming pattern   | Template for agent names, e.g. `agent-{n}` becomes `agent-1`, `agent-2`, ... |
| Stagger delay    | Milliseconds between each launch (0-10000)                |
| Working directory| Starting directory for all agents                         |
| Initial command  | Command to run in each terminal after launch              |

### Templates / Recipes

Save and load reusable multi-agent configurations. Two built-in templates:

- **Quick Review** -- 3 agents with the Claude Code profile, for parallel code review
- **Parallel Tasks** -- 5 agents for concurrent task execution

Custom templates can be created, edited, and deleted in Settings. Templates store the full batch launcher configuration and can be launched from the command palette (Ctrl+Shift+P).

---

## Event Stream

**Shortcut:** Ctrl+E

A filterable timeline panel showing the last 200 events from across all terminals and agents.

### Event Types

| Category   | Events                                                     |
| ---------- | ---------------------------------------------------------- |
| Tools      | Tool call start/complete, file modifications               |
| Errors     | Agent errors, terminal errors, crash reports               |
| Status     | Agent status changes, cost threshold warnings              |
| Lifecycle  | Terminal created/closed, agent detected/lost               |

### Features

- **Expandable details** -- click any event to see full JSON payload
- **Severity color coding** -- info (blue), warning (amber), error (red)
- **Filter by category** -- toggle Tools, Errors, Status, and Lifecycle groups
- **Filter by terminal** -- show events from a specific terminal only
- **Text search** -- filter events by keyword
- **JSON export** -- download all events as a JSON file

---

## Cross-Terminal Search

**Shortcut:** Ctrl+Shift+F

Search across all terminal buffers simultaneously.

### Options

- **Case sensitive** -- toggle case-sensitive matching
- **Regex** -- use regular expressions
- **Terminal filter** -- limit search to specific terminals

### Navigation

- **Arrow keys** -- move between results
- **Enter** -- jump to the selected result in its terminal, with the matching line highlighted
- Results are grouped by terminal with match counts

Search runs asynchronously in chunks to avoid blocking the UI on large buffers.

---

## Shell Profiles

Profiles define pre-configured terminal environments. Accessible from the new terminal menu, batch launcher, and templates.

### Built-in Profiles

- **Default Shell** -- your system's default shell with no customization
- **Claude Code** -- launches Claude Code (`claude`) with appropriate flags

### Custom Profiles

Create in Settings (Ctrl+7) with:

- **Name** -- display name
- **Command** -- shell executable (e.g., `pwsh`, `/bin/zsh`, `cmd.exe`)
- **Args** -- command-line arguments
- **Env** -- additional environment variables (key=value pairs)
- **CWD** -- default working directory
- **Icon** -- Material Symbols icon name (e.g., `terminal`, `code`, `robot`)

Profiles are stored in `~/.agent-desk/config.json`.

---

## Themes & Customization

### Built-in Themes

| Theme         | Description                                     |
| ------------- | ----------------------------------------------- |
| Default Dark  | Dark theme with blue-gray accent (#5d8da8)      |
| Default Light | Light theme matching the dark variant            |
| Dracula       | Popular dark theme with purple/pink accents      |
| Nord          | Arctic-inspired cool blue palette                |

### Custom Themes

Create custom themes via the theme manager in Settings:

- Full control over ~40 CSS custom properties
- Background, surface, border, and text colors
- Accent color and hover states
- All 16 terminal ANSI colors
- Preview changes in real time

Custom themes are stored in `localStorage`.

### Design System

- **Fonts**: Inter (UI), JetBrains Mono (terminal), Material Symbols Outlined (icons)
- **Design language**: MD3, consistent with agent-comm and agent-tasks dashboards
- **Accent**: `#5d8da8`
- **Background**: `#1a1d23` (dark), surface: `#21252b` (dark)

---

## Session Persistence

Agent Desk automatically saves and restores your session.

### Auto-Save

Every 60 seconds, the app saves:

- Open terminals (names, profiles, working directories)
- Grid layout (pane positions and sizes)
- Agent metadata (names, status, task assignments)
- Terminal buffers (for replay on restore)

### Restore

On startup, if a previous session exists, a restore prompt appears with a 10-second countdown. Options:

- **Restore** -- reopen all terminals and replay buffers
- **Skip** -- start fresh with a single default terminal

Buffer replay re-feeds saved terminal output into xterm.js so you can see previous output. Note that PTY processes are not preserved -- terminals restart with their configured shell.

### Layout Persistence

The dockview grid layout (pane arrangement, sizes, maximized state) is persisted separately and restored automatically without the restore prompt.

---

## Workspaces

### Save Workspace (Ctrl+Shift+W)

Save the current terminal layout as a named workspace. Saves:

- Terminal names, profiles, and working directories
- Grid layout positions
- Initial commands (if configured)

### Load Workspace (Ctrl+Alt+W)

Select a saved workspace to restore. All current terminals are replaced with the workspace layout.

Workspaces are stored in `~/.agent-desk/config.json`.

---

## Dashboard Integration

Four `agent-*` dashboards are embedded as **first-party plugins** loaded into per-view shadow roots with health monitoring and live theme sync.

### Agent Comm (Ctrl+2)

The agent-comm dashboard shows agent registration, messaging, channels, and shared state. Default URL: `http://localhost:3421`.

### Agent Tasks (Ctrl+3)

The agent-tasks pipeline kanban shows task stages (backlog, spec, plan, implement, test, review, done). Default URL: `http://localhost:3422`.

### Agent Knowledge (Ctrl+4)

The agent-knowledge dashboard shows the shared knowledge base with search, categories, and the knowledge graph. Default URL: `http://localhost:3423`.

### Agent Discover (Ctrl+5)

The agent-discover MCP registry / marketplace shows installed and browsable MCP servers, secrets, metrics, and health. Default URL: `http://localhost:3424`.

### Plugin System

Each `agent-*` package ships an `agent-desk-plugin.json` manifest declaring its UI script bundle. Agent Desk discovers them at startup, registers a `plugin://` Electron protocol to serve their static assets, and mounts each plugin into a per-view shadow root by calling its `mount(container, { baseUrl, wsUrl, cssUrl })` global. Theme sync copies the standard CSS variable contract from the host's `:root` into each plugin's shadow root so they all render in the active theme.

---

## Cost Tracking

Per-agent cost estimation appears in the status bar.

### How It Works

The agent parser estimates token usage based on tool call patterns and output volume. Costs are calculated using approximate per-token pricing.

### Warning Thresholds

- **$2** -- status bar turns amber
- **$5** -- status bar turns red

Thresholds are configurable in Settings. Cost data resets when a terminal is closed.

---

## Communication Graph

A canvas-rendered visualization of agent interactions, accessible from the command palette.

### Display

- **Nodes** -- one per registered agent, with a pulse animation when active
- **Edges** -- drawn between agents that have exchanged messages, with thickness proportional to message count
- **Hover** -- tooltip shows agent name, status, and message count
- **Click** -- focuses the clicked agent's terminal

Data is fetched from the agent-comm REST API. The graph updates periodically.

---

## Terminal Chains

Trigger commands in one terminal based on events in another.

### Setup

Right-click a terminal tab and select "Add Chain" to configure:

- **Source terminal** -- the terminal that triggers the chain
- **Trigger** -- exit (when the source terminal's process ends) or status change
- **Target terminal** -- the terminal that receives the command
- **Command** -- the command to execute in the target terminal

### Use Cases

- Run tests automatically when a build terminal exits successfully
- Start a deploy script when all agent terminals finish
- Chain review agents to run after implementation agents complete

Chain indicators appear on terminal tabs showing active chains.

---

## Keyboard Shortcuts

### Terminal Shortcuts

| Shortcut         | Action                 |
| ---------------- | ---------------------- |
| Ctrl+Shift+T     | New terminal           |
| Ctrl+Shift+C     | New Claude session     |
| Ctrl+W           | Close terminal         |
| Ctrl+Tab         | Next terminal          |
| Ctrl+Shift+Tab   | Previous terminal      |
| Ctrl+Shift+D     | Split right            |
| Ctrl+\\          | Split right (alt)      |
| Ctrl+Shift+E     | Split down             |
| Ctrl+Shift+M     | Toggle maximize        |
| Ctrl+Shift+S     | Save output to file    |
| Ctrl+F           | Search in terminal     |
| Ctrl+Shift+F     | Search all terminals   |

### Navigation Shortcuts

| Shortcut    | Action                 |
| ----------- | ---------------------- |
| Alt+Arrow   | Focus adjacent pane    |
| Ctrl+1      | Terminals view         |
| Ctrl+2      | Agent Comm view        |
| Ctrl+3      | Agent Tasks view       |
| Ctrl+4      | Agent Knowledge view   |
| Ctrl+5      | Agent Discover view    |
| Ctrl+6      | Event Stream view      |
| Ctrl+7      | Settings view          |

### General Shortcuts

| Shortcut         | Action                   |
| ---------------- | ------------------------ |
| Ctrl+Shift+P     | Command palette          |
| Ctrl+P           | Quick switcher           |
| F1               | Show keyboard shortcuts  |
| Ctrl+E           | Toggle event stream      |
| Ctrl+Shift+B     | Batch agent launcher     |
| Ctrl+Shift+W     | Save workspace           |
| Ctrl+Alt+W       | Load workspace           |
| Escape           | Close overlays / search  |

### Customization

All shortcuts are customizable via:

1. **Settings UI** (Ctrl+7) -- use the capture mode to record new key combinations
2. **Keybindings file** (`~/.agent-desk/keybindings.json`) -- edit directly for bulk changes

User overrides take precedence over defaults. Press **F1** to view all available shortcuts.
