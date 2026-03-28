# Changelog

All notable changes to Agent Desk are documented in this file.

## [Unreleased]

### Added

- **Agent Monitor view** (Ctrl+5) -- live card-based dashboard with agent status, task badges, tool call counts, uptime, and click-to-focus navigation
- **Batch Agent Launcher** (Ctrl+Shift+B) -- launch N agents at once with profile selection, naming patterns (`agent-{n}`), stagger delays, working directory, and optional initial commands
- **Agent Templates / Recipes** -- save, edit, and load reusable multi-agent configurations with CRUD in Settings; 2 built-in defaults (Quick Review: 3 review agents, Parallel Tasks: 5 generic agents)
- **Lifecycle Controls** -- interrupt (SIGINT), stop (SIGTERM), kill (SIGKILL), and restart agents from context menu and tab action buttons
- **Cost / Token Tracking** -- per-agent cost estimation in the status bar with configurable $2/$5 warning thresholds
- **Agent Communication Graph** -- canvas-rendered visualization of agent interactions with animated pulse, edge thickness by message count, hover tooltips, and click-to-focus
- **Cross-Terminal Search** (Ctrl+Shift+F) -- async chunked search across all terminal buffers with case-sensitive/regex modes, keyboard navigation (arrow keys + Enter), and jump-to-line with highlight
- **Session Persistence** -- 60-second auto-save, restore prompt on startup with 10-second countdown, terminal buffer replay, agent name/profile preservation, and layout persistence
- **Dashboard Health Monitoring** -- 30-second HTTP health checks for agent-comm/tasks/knowledge with sidebar status dots and auto-reconnect
- **Shell Profiles UI** -- create, edit, and delete shell profiles with command, args, env, cwd, and icon selection; Default Shell and Claude Code pre-configured
- **Task-Terminal Linking** -- `[T42]` badges on terminal tabs showing the assigned pipeline task; click badge to jump to tasks view
- **Offline Support** -- bundled xterm.js and dockview-core from node_modules via `scripts/copy-vendor.js` (no CDN dependency)
- **Shell Integration** -- OSC sequence parsing (OSC 7, OSC 133, OSC 1337) for current directory tracking, command boundary detection, and scroll marks
- **Event Stream** (Ctrl+E) -- filterable timeline panel with up to 200 events, expandable details, severity color coding, terminal filter, text search, and JSON export
- **Command Palette** (Ctrl+Shift+P) -- fuzzy-filtered command list with keyboard navigation
- **Quick Switcher** (Ctrl+P) -- fast terminal switching overlay
- **Keyboard Shortcuts overlay** (F1) -- categorized reference of all shortcuts
- **Workspaces** (Ctrl+Shift+W / Ctrl+Alt+W) -- save and load named terminal layouts
- **Pop-out windows** -- detach any terminal into its own native window
- **Terminal Chains** -- trigger commands in a target terminal when a source terminal exits or changes status
- **Customizable Keybindings** -- `~/.agent-desk/keybindings.json` with capture UI in Settings
- **Config file** -- `~/.agent-desk/config.json` persists settings, profiles, workspaces, and templates with hot-reload via file watcher
- **Theme system** -- 4 built-in themes (Default Dark, Default Light, Dracula, Nord) plus custom theme creation with full ANSI color control
- **Agent Parser** -- detects Claude Code tool calls (Read, Write, Edit, Bash, Grep, Glob, etc.), file modifications, test results, and errors from terminal output
- **Crash Reporter** -- structured crash logs in `~/.agent-desk/crash-logs/` with memory snapshots and automatic rotation
- **Auto-Update** -- checks for updates with download and install prompts
- **System Monitor** -- CPU, RAM, and disk usage in the status bar
- **Webview Bridge** -- bidirectional state sync between dashboard webviews and terminal state
- **Dashboard Injectors** -- per-dashboard toolbar injection for agent-comm, agent-tasks, and agent-knowledge

### Removed

- **Recording / Replay** -- buffer replay and command history cover this use case
- **Terminal Linking (stdout piping)** -- agents use agent-comm for coordination, not stdout piping
- **Per-Terminal Settings** -- global settings are sufficient; profiles handle per-terminal customization
- **Snippets** -- not useful when AI agents run commands
- **Inline Images addon** -- removed unused CDN dependency
- **Notification Rules** -- agents report via agent-comm, not regex-based terminal matching

### Simplified

- **Event Stream** -- removed HTTP polling; kept local event bus with filters, search, and export
- **System Monitor** -- kept status bar widget with CPU/RAM/disk; removed detailed panel view
- **Theme System** -- kept 4 built-in themes + custom creation; removed theme importers/exporters
- **Keybindings** -- kept key combos with capture UI; removed chord support and conflict detection
