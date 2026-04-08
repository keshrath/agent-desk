# Changelog

All notable changes to Agent Desk are documented in this file.

## [Unreleased] - 2026-04-08

### Added

- **Playwright E2E plugin views test suite** at `tests/e2e/plugins.spec.ts`. Launches the Electron app via existing helpers and verifies that all four agent-\* plugin views (`comm`, `tasks`, `knowledge`, `discover`) load and respond inside the host: clicks each sidebar nav button, waits for the plugin global (`window.AC` / `window.TaskBoard` / `window.Knowledge` / `window.AD`), asserts the wrapper inside the shadow DOM has visible content, screenshots into `~/.claude/tmp/e2e-agent-desk-<view>.png`, and asserts no new console errors per view. Runnable via `npm run test:e2e:plugins`.

### Changed

- Tidied `.gitignore` with section headers (dependencies, local data, test artifacts, docs cache, scratch, OS cruft).

## [1.0.24] - 2026-04-07

### Changed

- Replaced hub-session lookups with direct agent-comm DB queries.

## [1.0.23] - 2026-04-06

### Fixed

- macOS dock Quit not actually quitting the app.
- False crash detection on startup.

## [1.0.22] - 2026-04-03

### Added

- **Keyboard shortcuts for all views** — `Ctrl+5` Discover, `Ctrl+6` Monitor, `Ctrl+7` Events, `Ctrl+8` Settings.

### Fixed

- Event badge filter count was off.
- Plugin version now read from `package.json` instead of being hardcoded.

## [1.0.21] - 2026-04-03

### Changed

- Adopted morphdom for DOM rendering across `agent-monitor`, `event-stream`, `commands`, `settings`. Replaces innerHTML rewrites with diffed updates.

## [1.0.20] - 2026-04-03

### Fixed

- Synced all missing CSS variables to plugins (`accent-solid`, `bg-inset`, `text-secondary`, `shadow-hover`, `shadow-panel`).

## [1.0.19] - 2026-04-03

### Fixed

- `accent-dim` was being set to a solid colour instead of a transparent rgba.

## [1.0.18] - 2026-04-03

### Fixed

- Empty state overlay glitch.
- Theme toggle resetting the active view.
- Task poll backoff under load.
- Plugin theme sync on first mount.
- Settings panel scroll position.
- Status bar overflow on narrow widths.
- Cost popover positioning.
- Monitor empty-state copy.

## [1.0.17] - 2026-04-03

### Changed

- **Standard CSS variable contract** for plugins — agent-desk defines the variables in `styles.css` and `syncThemeToPlugin` copies them 1:1 into each plugin's shadow DOM. Simpler than the previous derived-theme path.

## [1.0.16] - 2026-04-03

### Fixed

- Empty state not clearing on session restore.

## [1.0.15] - 2026-04-02

### Changed

- **Shadow-DOM plugin views replace native views.** All four agent-\* dashboards now load via the plugin protocol into a shadow root, with derived theme sync.

## [1.0.13] - 2026-04-02

### Changed

- Reverted to native views temporarily — plugin mount needed shadow DOM iteration. Re-fixed in v1.0.15.

## [1.0.12] - 2026-04-02

### Changed

- Restored native views, kept plugin infra for future use.

## [1.0.11] - 2026-04-02

### Fixed

- Plugin discovery — `__dirname` was undefined in ESM context.

## [1.0.10] - 2026-04-02

### Removed

- Native views deleted; plugins are now the only path for embedded agent-\* dashboards.

## [1.0.9] - 2026-04-02

### Added

- **Plugin system** for loading agent-\* UIs as first-party plugins. Each plugin ships an `agent-desk-plugin.json` manifest, and the renderer mounts it via a `plugin://` protocol into a per-view container.

## [1.0.8] - 2026-04-01

### Added

- Full feature parity for the four embedded views (comm/tasks/knowledge/discover).
- Hooks autoconfig.
- E2E test framework (`tests/e2e/`) with reusable launch/teardown helpers.

### Fixed

- Assorted bugfixes from QA.

## [1.0.7] - 2026-04-01

### Removed

- Webview infrastructure. Embedded dashboards no longer use `<webview>`.

### Added

- MCP config step in the onboarding wizard.

## [1.0.6] - 2026-04-01

### Added

- **Auto-configure MCP servers** for Claude Code, Cursor, Windsurf, Gemini CLI, and OpenCode on first launch.

## [1.0.5] - 2026-03-31

### Added

- Native views for comm, tasks, knowledge, discover via direct npm dep imports (later replaced by the plugin system in 1.0.9).

## [1.0.4] - 2026-03-30

### Added

- Discover tab — embeds the agent-discover dashboard on port 3424.

## [1.0.3] - 2026-03-30

### Added

- Full dashboard theme sync across the embedded views.
- Bundled MCP servers in the install package.

### Fixed

- Assorted bugs.

## [1.0.2] - 2026-03-29

### Added

- VitePress documentation site, MIT license headers.
- Mac x64 build added to CI.

### Changed

- Comprehensive docs / screenshots refresh.

## [1.0.1] - 2026-03-28

### Changed

- **Generified codebase** -- removed all personal/organization-specific references; fully open-source ready
- **Comprehensive documentation** -- README rewrite, CONTRIBUTING.md, LICENSE, docs/ARCHITECTURE.md, docs/SETUP.md, docs/FEATURES.md
- **Dashboard URLs configurable** -- all three dashboard URLs now editable in Settings instead of hardcoded
- **Shell profiles** -- profiles use generic defaults; no hardcoded paths or tool-specific assumptions

### Fixed

- **Config hot-reload** -- file watcher correctly detects external config changes on all platforms
- **Theme persistence** -- custom themes survive app restarts without flicker

## [1.0.0] - 2026-03-27

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
