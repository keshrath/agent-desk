# Agent Desk User Manual

---

## 1. Getting Started

### What is Agent Desk?

Agent Desk is a desktop application that serves as a unified control center for AI coding agents. It combines a powerful multi-terminal environment with integrated dashboards for agent communication, task management, and knowledge bases -- all in a single window. Whether you are running one AI assistant or orchestrating a team of agents working in parallel, Agent Desk gives you visibility and control over every session.

### System Requirements

- **Operating System**: Windows 10+, macOS 11+, or Linux (Ubuntu 20.04+, Fedora 36+, or equivalent)
- **RAM**: 4 GB minimum, 8 GB recommended
- **Disk**: 200 MB for the application
- **Optional services**: agent-comm (localhost:3421), agent-tasks (localhost:3422), agent-knowledge (localhost:3423) for dashboard features

### Installation

1. Go to the [GitHub Releases](https://github.com/user/agent-desk/releases) page.
2. Download the installer for your platform:
   - **Windows**: `.exe` installer
   - **macOS**: `.dmg` disk image
   - **Linux**: `.AppImage` or `.deb` package
3. Run the installer and follow the prompts.
4. Launch Agent Desk from your applications menu or desktop shortcut.

### First Launch -- What You Will See

When you start Agent Desk for the first time, you are greeted by the **onboarding wizard** -- a three-step walkthrough that introduces the core features:

1. **Welcome screen** -- a brief introduction to the app.
2. **Feature carousel** -- swipe through key features: Terminals, Workspaces, Batch Launch, Dashboards, Git Sidebar, and Diff Viewer. Each card shows the feature name, a short description, and (where applicable) the keyboard shortcut.
3. **Quick Start** -- choose to launch your first agent immediately or explore on your own. A checkbox lets you disable the wizard for future launches.

After the wizard closes, Agent Desk opens the Terminals view. If the setting "New Terminal on Startup" is enabled (it is by default), a terminal session starts automatically using your default profile.

![First launch onboarding](screenshots/onboarding.png)

---

## 2. Interface Overview

Agent Desk is organized into five main areas: the **Titlebar**, the **Sidebar**, the **Tab Bar**, the **Main Content Area**, and the **Status Bar**.

![Interface overview](screenshots/interface-overview.png)

### Titlebar

The titlebar spans the top of the window. On the left it shows the application icon and the name "Agent Desk". On the right are the standard window controls:

- **Minimize** -- collapse the window to the taskbar / dock.
- **Maximize / Restore** -- toggle between maximized and windowed mode.
- **Close** -- close the window. If "Close to Tray" is enabled in Settings, the app minimizes to the system tray instead of quitting.

### Sidebar

The sidebar is a narrow vertical bar on the left side of the window (or right, if you change the setting). It is divided into a top section and a bottom section.

**Top section** -- View navigation buttons (top to bottom):

| Icon | View | Shortcut | Description |
| --- | --- | --- | --- |
| `terminal` | Terminals | Ctrl+1 | Your terminal sessions and split layouts |
| `forum` | Agent Comm | Ctrl+2 | Agent communication dashboard |
| `task_alt` | Agent Tasks | Ctrl+3 | Task pipeline dashboard |
| `psychology` | Agent Knowledge | Ctrl+4 | Knowledge base dashboard |
| `widgets` | Agent Discover | Ctrl+5 | MCP registry / marketplace |
| `timeline` | Events | Ctrl+6 | Event stream timeline |
| `timeline` | Event Stream | Ctrl+E | Filterable event timeline |

**Bottom section** -- Action buttons:

| Icon | Button | Description |
| --- | --- | --- |
| `smart_toy` | Start Agent | Launch an AI agent terminal using the default agent profile |
| `add` | New Terminal | Create a new terminal with the default profile. Right-click for a profile picker menu. |
| `dark_mode` / `light_mode` | Theme Toggle | Switch between your preferred dark and light themes |
| `help` | Help / Shortcuts | Open the keyboard shortcuts overlay (same as F1) |
| `settings` | Settings | Open the Settings panel (Ctrl+6) |

Dashboard buttons (Agent Comm, Tasks, Knowledge) display a small colored dot indicating service health:

- **Green dot** -- the service is running and reachable.
- **Red dot** -- the service is down or unreachable.

### Tab Bar

The tab bar appears above the terminal content area when you are in the Terminals view. Each open terminal has a tab showing:

- A **status dot** (colored circle) indicating the terminal state.
- The **terminal name** (editable by double-clicking or pressing F2).
- A **status badge** showing what the terminal is doing (e.g., "idle", "working", "input needed", or the active tool name for AI agents).
- An optional **task badge** like `[T42]` if the agent is assigned to a pipeline task.
- A **close button** (visibility depends on your "Tab Close Button" setting: always, hover, or never).

On the far right of the tab bar is the **+ button** to create a new terminal. Right-click it for additional options like Split Right, Split Down, Save Workspace, and more.

**Tab states** are indicated by both color and label:

| Color | State | Meaning |
| --- | --- | --- |
| Green | idle | Shell prompt is visible, waiting for your input |
| Blue | working / running | A command or agent is actively running |
| Yellow | waiting / input needed | The terminal is waiting for user input (a Y/n prompt, password, etc.) |
| Red | exited | The process has ended (exit code 0 = success, non-zero = failure) |

### Status Bar

The status bar runs along the bottom of the window. It has three sections:

- **Left** -- shows the current view name, or a terminal summary (e.g., "3 terminals: 2 running, 1 idle").
- **Center** -- shows the current working directory of the active terminal (when available via shell integration).
- **Right** -- shows system resource usage (CPU, RAM, Disk), the estimated agent cost, and info about the active terminal.

### Main Content Area

This is where the active view renders:

- **Terminals view** -- a grid of terminal panes that you can split, resize, and rearrange.
- **Dashboard views** (Comm, Tasks, Knowledge, Discover) -- embedded web views of the respective services.
- **Event Stream** -- filterable timeline of terminal lifecycle, agent tool calls, and internal events.
- **Event Stream** -- a filterable event timeline.
- **Settings** -- the configuration panel.

---

## 3. Terminal Management

### Creating a Terminal

There are several ways to create a new terminal:

1. **Keyboard shortcut**: Press **Ctrl+Shift+T** to open a new terminal using your default profile.
2. **Tab bar + button**: Click the **+** button at the right end of the tab bar.
3. **Sidebar button**: Click the **+** (New Terminal) button in the bottom section of the sidebar.
4. **Command palette**: Press **Ctrl+Shift+P**, then type "New Terminal".
5. **Profile picker**: Right-click the **+** button (tab bar or sidebar) to see a menu of all your profiles. Click one to launch it.

### Starting an AI Agent

1. **Start Agent button**: Click the robot icon (`smart_toy`) in the sidebar. This launches your default agent profile (the first non-shell profile, such as Claude or OpenCode).
2. **Keyboard shortcut**: Press **Ctrl+Shift+C** to start a new agent session.
3. **Batch Launch**: Press **Ctrl+Shift+B** to launch multiple agents at once (see [Batch Launch & Templates](#5-batch-launch--templates)).

### Tab Operations

- **Rename**: Double-click the tab label, or select the tab and press **F2**. Type a new name and press Enter.
- **Close**: Click the tab's close button, press **Ctrl+W**, or middle-click the tab.
- **Close with confirmation**: If a process is still running, you will see a confirmation dialog before the terminal is closed.
- **Close Others**: Right-click a tab and select "Close Others" to close every tab except the one you clicked.
- **Reorder**: Drag tabs left and right within the tab bar to rearrange them.

### Grid Layout

Agent Desk uses a grid layout that lets you split and arrange terminal panes:

- **Split Right**: Press **Ctrl+Shift+D** (or **Ctrl+\\**) to split the current terminal to the right.
- **Split Down**: Press **Ctrl+Shift+E** to split the current terminal downward.
- **Resize**: Drag the border between panes to resize them.
- **Maximize**: Press **Ctrl+Shift+M** to maximize the current pane (hides all others). Press again to restore the grid.
- **Focus navigation**: Use **Alt+Arrow** keys to move focus between adjacent panes.
- **Drag to split**: Drag a tab from the tab bar into the grid area to create a new split.

### Terminal Status Indicators

Each terminal is monitored for output patterns to determine its status:

- **Idle** (green) -- a shell prompt is detected (e.g., `$`, `>`, `PS C:\>`).
- **Working** (blue) -- the terminal is producing output or running a command.
- **Waiting** (yellow) -- a prompt requiring user input is detected (e.g., `[Y/n]`, `Password:`, Claude's `> ` prompt).
- **Exited** (red) -- the shell or process has terminated. A checkmark indicates a clean exit (code 0); an X indicates failure.

For AI agent terminals, the status badge also shows the last tool being used (e.g., "Read", "Edit", "Bash").

### Pop-Out Terminals

You can detach any terminal into its own window:

1. Right-click the terminal tab.
2. Select **Pop Out**.

The terminal opens in a separate native window that you can move independently.

### Right-Click Context Menu

Right-clicking a terminal tab or the terminal area opens a context menu with these options:

| Option | Description |
| --- | --- |
| Open in Explorer | Open the terminal's working directory in your file manager |
| Copy Path | Copy the current working directory to clipboard |
| Copy Last Command Output | Copy the output of the most recent command |
| Rename | Rename the terminal tab |
| Save Output... | Save the entire terminal buffer to a file (Ctrl+Shift+S) |
| Copy All Output | Copy the full terminal buffer to clipboard |
| Split Right | Split this terminal to the right |
| Split Down | Split this terminal downward |
| Chain to... | Set up a terminal chain (trigger a command when this terminal exits) |
| Pop Out | Detach into a separate window |
| Maximize / Restore | Toggle maximized state |
| Close | Close this terminal |
| Close Others | Close all terminals except this one |

---

## 4. Agent Detection (no dedicated view)

Agent Desk parses terminal output in the background to detect AI agent sessions (Claude Code, OpenCode, Aider, and others). When detection succeeds, the agent's state becomes visible on several surfaces — **there is no separate "Agent Monitor" view** as of v1.6.0. Detection feeds:

- **Tab titles** — agent name, activity indicator (working / idle / waiting / errored), and attention pulse when the agent is waiting on user input.
- **Cost tracking** — per-terminal token/cost readout in the status bar, with $2 / $5 warning thresholds.
- **Agent Comm dashboard** (Ctrl+2) — cross-session agent roster and activity feed, driven by the agent-comm service.
- **Session persistence** — saved sessions remember which terminal was running which agent so titles + cost attribution survive restarts.
- **Batch launcher naming** — spawned agents get numbered names like `agent-1`, `agent-2`, etc.

### When detection fires

An agent is considered detected when:

- The terminal is running a known agent command (Claude, OpenCode, Aider, Cursor CLI, Gemini CLI, Amazon Q).
- The terminal output matches agent-specific patterns (tool calls, file modifications, test results).

Plain shell terminals stay plain shells — no detection, no tab badges.

### Interacting with detected agents

- **Click a tab** to focus that agent's terminal.
- **Right-click a tab** for lifecycle controls (interrupt / stop / kill / restart) and "Open in external editor" on the agent's cwd.
- **Agent Comm view** (Ctrl+2) is the place to see *all* agents across sessions, not just this window.

> **Migration note (v1.5 → v1.6)**: prior versions shipped a dedicated "Agent Monitor" view at `Ctrl+5`. In v1.6 that view was removed because its information already lives in the tab bar and the Agent Comm overview. Your `Ctrl+5` is now **Agent Discover** (the MCP registry view).

---

## 5. Batch Launch & Templates (Ctrl+Shift+B)

### Batch Launch Dialog

Press **Ctrl+Shift+B** or select "Batch Launch Agents" from the command palette to open the batch launcher. This dialog lets you start multiple agent terminals at once.

**Fields in the batch launcher:**

| Field | Description | Default |
| --- | --- | --- |
| Agent Count | Number of agents to launch (1-20) | 3 |
| Profile | Which profile to use for each agent | Your default profile |
| Naming Pattern | Template for naming tabs. Use `{n}` for the agent number. | `agent-{n}` |
| Working Directory | Starting directory for all agents. Click the folder icon to browse. | Profile default |
| Initial Command | A command to send to each agent after launch (optional). | (empty) |
| Stagger Delay (ms) | Milliseconds to wait between launching each agent. | 1000 |
| Max Concurrent | Maximum number of agents to run at once. 0 means unlimited. | 0 |

Click **Launch** to begin. A progress bar shows how many agents have been started. The launcher is CPU-aware: if system CPU exceeds 80%, it pauses until it drops below 60%.

Click **Save as Template** to save the current configuration as a reusable template.

### What Are Templates?

Templates (also called recipes) are saved multi-agent configurations. Instead of filling out the batch launcher each time, you can save a template and launch it with one click.

### Default Templates

Agent Desk includes two built-in templates:

- **Quick Review** -- 3 Claude agents named `arch-review`, `security-review`, and `quality-review`. Designed for parallel code review.
- **Parallel Tasks** -- 5 Claude agents named `task-1` through `task-5`. A general-purpose template for parallel work.

### Creating Custom Templates

1. Open Settings (Ctrl+6) and scroll to the **Templates** section.
2. Click **Create Template**.
3. Fill in the template name, icon, and description.
4. Add agents: for each agent, specify a name, profile, and optional initial input.
5. Click **Create** to save.

Alternatively, open the Batch Launcher, configure it, and click **Save as Template**.

### Launching from Templates

There are several ways to launch a template:

- In Settings > Templates, click the **play** button next to a template.
- Open the command palette (Ctrl+Shift+P) and type "Launch Template:" followed by the template name.
- Click a template row in Settings to launch it directly.

### Template Variables

Templates support variables using the `{{variableName}}` syntax in the "Initial Input" field of each agent. When you launch a template that contains variables, a dialog prompts you to enter values for each variable before the agents start.

For example, an initial input of `Review the {{module}} module for security issues` will prompt you to enter a value for `module` at launch time.

---

## 6. Event Stream (Ctrl+E)

The Event Stream is a timeline view that records everything happening across your terminals.

### What Events Are Tracked

| Event Type | Category | Description |
| --- | --- | --- |
| Terminal created | Lifecycle | A new terminal session was opened |
| Terminal exited | Lifecycle | A terminal process ended (shows exit code) |
| Terminal status change | Status | A terminal changed state (e.g., idle to working) |
| Agent detected | Status | An AI agent was detected in a terminal |
| Agent named | Status | An agent registered its name |
| Tool call | Tools | An agent invoked a tool (Read, Edit, Bash, etc.) |
| File modified | Tools | An agent modified a file |
| Test result | Lifecycle | A test suite reported results |
| Error | Errors | An error was detected in terminal output |
| Chain triggered | Lifecycle | A terminal chain fired |

### Filter Bar

At the top of the Event Stream panel you will find:

- **Terminal dropdown** -- filter events to a specific terminal, or show all.
- **Type toggle chips** -- click to enable/disable event categories:
  - **Tools** -- tool calls and file modifications
  - **Errors** -- error events
  - **Status** -- status changes, agent detection, agent naming
  - **Lifecycle** -- terminal creation/exit, chains, test results
- **Search field** -- type to filter events by text content.

### Expanding Event Details

Click any event row to expand it and see additional details:

- Tool calls show the tool name, argument, file path, call number, and duration.
- Errors show the full error message or stack trace.
- Status changes show the before and after states.

If the event is associated with a terminal, a **Go to terminal** button lets you jump directly to it.

### Export Events

Click the **copy** icon in the Event Stream header to export all events (up to 1000) as JSON to your clipboard.

### Clear Events

Click the **delete sweep** icon to clear all events from the timeline.

Events are persisted in localStorage and restored when you reopen the app.

---

## 7. Cross-Terminal Search (Ctrl+Shift+F)

The global search lets you find text across every terminal buffer at once.

### How It Works

1. Press **Ctrl+Shift+F** to open the search overlay.
2. Type your search query (minimum 2 characters).
3. Results appear grouped by terminal, with line numbers and highlighted matches.

The search runs asynchronously in chunks to keep the UI responsive, even with large terminal buffers.

### Search Options

Two toggle buttons appear below the search input:

- **Case Sensitive** (`match_case` icon) -- when enabled, the search distinguishes between uppercase and lowercase.
- **Regex** (`regular_expression` icon) -- when enabled, the query is treated as a regular expression.

### Navigating Results

- Use **Arrow Down** / **Arrow Up** to move through results.
- Press **Enter** to jump to the selected result.
- Click any result row to jump to it.

### Jumping to a Match

When you select a result, Agent Desk:

1. Switches to the Terminals view.
2. Activates the terminal containing the match.
3. Scrolls to the matching line.
4. Highlights the match using the terminal's built-in search.

Press **Escape** to close the search overlay.

---

## 8. Profiles

### What Are Profiles?

Profiles define how a terminal session is launched -- what command to run, with what arguments, in what directory, and with what environment variables. You can think of them as "terminal presets."

### Default Profiles

Agent Desk ships with three built-in profiles:

| Profile | Command | Icon | Description |
| --- | --- | --- | --- |
| Default Shell | (system shell) | `terminal` | Opens your system's default shell (PowerShell on Windows, bash/zsh on macOS/Linux) |
| Claude | `claude` | `smart_toy` | Starts a Claude Code AI agent session |
| OpenCode | `opencode` | `code` | Starts an OpenCode AI agent session |

### Creating a Custom Profile

1. Open Settings (Ctrl+6).
2. Scroll to the **Profiles** section.
3. Click **Create Profile**.
4. Fill in the fields:
   - **Name** -- a descriptive name (e.g., "Python Dev").
   - **Command** -- the command to run (e.g., `python`, `node`, `ssh user@host`).
   - **Arguments** -- command-line arguments (optional).
   - **Working Directory** -- the starting directory (optional; defaults to the system default).
   - **Environment Variables** -- additional env vars in `KEY=VALUE` format (optional).
   - **Icon** -- choose from a set of Material Symbols icons.
5. Click **Save**.

### Setting the Default Profile

In Settings > Profiles, click the star icon next to the profile you want as your default. The default profile is used when you press Ctrl+Shift+T or click the + button.

### Using Profiles

- **New Terminal button** (sidebar or tab bar): Left-click uses the default profile. Right-click opens a menu listing all profiles.
- **Batch Launcher**: Select a profile from the dropdown.
- **Templates**: Each agent in a template can specify its own profile.

---

## 9. Themes & Appearance

### Built-in Themes

Agent Desk includes eight built-in themes:

**Dark themes:**

| Theme | Accent Color | Description |
| --- | --- | --- |
| Default Dark | Teal/blue (#5d8da8) | The default Agent Desk dark theme |
| Dracula | Purple (#bd93f9) | Classic Dracula color scheme |
| Nord | Frost blue (#88c0d0) | Arctic, minimalist Nord palette |
| Gruvbox | Orange (#fe8019) | Warm, retro Gruvbox palette |

**Light themes:**

| Theme | Accent Color | Description |
| --- | --- | --- |
| Default Light | Teal/blue (#4a7a96) | A clean light counterpart to Default Dark |
| Solarized | Blue (#268bd2) | Ethan Schoonover's Solarized Light |
| Catppuccin | Purple (#8839ef) | Catppuccin Latte -- pastel light theme |
| GitHub | Blue (#0969da) | Inspired by GitHub's light mode |

Each theme defines colors for the entire UI (backgrounds, text, borders, accents) as well as all 16 terminal ANSI colors.

### Switching Themes

1. Open Settings (Ctrl+6).
2. Scroll to the **Themes** section.
3. Click any theme card to apply it immediately.

### Theme Toggle Button

The sidebar's theme toggle button (sun/moon icon) switches between your preferred dark and light themes. You can configure which specific dark and light themes are used via these settings:

- **Preferred Dark Theme** -- the theme applied when toggling to dark mode (default: Default Dark).
- **Preferred Light Theme** -- the theme applied when toggling to light mode (default: Default Light).

### Creating a Custom Theme

In the Themes section of Settings, you can create a fully custom theme by clicking **Create Custom Theme**. You can customize every color property, including:

- Background, surface, and border colors
- Text and accent colors
- All 16 terminal ANSI colors

Custom themes are stored in localStorage and persist across sessions.

### Follow System Theme

Enable the **Follow System Theme** option in Settings to have Agent Desk automatically switch between your preferred dark and light themes when your operating system's theme changes.

---

## 10. Dashboard Integration

### What Are the Dashboards?

Agent Desk embeds three web-based dashboards as views within the app:

- **Agent Comm** (Ctrl+2) -- a real-time communication hub for agent-to-agent messaging, channels, and broadcast. Runs at `http://localhost:3421`.
- **Agent Tasks** (Ctrl+3) -- a task pipeline manager where work flows through stages (backlog, spec, plan, implement, test, review, done). Runs at `http://localhost:3422`.
- **Agent Knowledge** (Ctrl+4) -- a knowledge base for cross-session and cross-machine knowledge persistence. Runs at `http://localhost:3423`.

### How to Set Up Dashboard Services

The dashboards require their respective backend services to be running. These are separate Node.js applications:

1. Install and start each service according to its own documentation.
2. By default, Agent Desk expects them at `localhost:3421`, `localhost:3422`, and `localhost:3423`.
3. If your services run on different ports, update the URLs in Settings > Dashboard URLs.

### Dashboard URLs in Settings

In the Settings panel under **Dashboard URLs**, you can configure:

- **Agent Comm URL** -- default: `http://localhost:3421`
- **Agent Tasks URL** -- default: `http://localhost:3422`
- **Agent Knowledge URL** -- default: `http://localhost:3423`

Changes take effect immediately.

### Theme Syncing

When you change the theme in Agent Desk, it automatically syncs to all embedded dashboards. The dashboards receive the full color palette and switch between light and dark modes to match. If you change the theme inside a dashboard, Agent Desk detects the change and syncs it back.

### Health Status Dots

The sidebar shows small colored dots next to each dashboard button:

- **Green** -- the service is healthy and responding.
- **Red** -- the service is not reachable.
- **(No dot / gray)** -- status not yet determined.

Health checks run every 30 seconds. If a service comes back online, the dashboard automatically reconnects.

When a dashboard fails to load, an overlay shows "Dashboard not available" with a countdown to the next retry and a **Retry Now** button.

---

## 11. Settings

Open Settings by clicking the gear icon in the sidebar or pressing **Ctrl+6**. Settings are organized into sections.

### Terminal

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| Default Terminal Path | Directory | (empty) | Starting directory for new terminals. Leave empty to use the system default. |
| Font Size | Number (10-24) | 14 | Terminal text size in pixels. |
| Font Family | Text | JetBrains Mono | The monospace font used in terminals. |
| Cursor Style | Select | bar | Terminal cursor shape: `bar`, `block`, or `underline`. |
| Cursor Blink | Checkbox | On | Whether the terminal cursor blinks. |
| Scrollback Lines | Number (1000-100000) | 10000 | How many lines of history the terminal buffer retains. |
| Line Height | Number (1.0-2.0) | 1.3 | Spacing between lines in the terminal. |

### Dashboard URLs

| Setting | Default | Description |
| --- | --- | --- |
| Agent Comm URL | `http://localhost:3421` | URL of the agent-comm service |
| Agent Tasks URL | `http://localhost:3422` | URL of the agent-tasks service |
| Agent Knowledge URL | `http://localhost:3423` | URL of the agent-knowledge service |

### Appearance

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| Sidebar Position | Select | left | Place the sidebar on the `left` or `right` side of the window. |
| Show Status Bar | Checkbox | On | Show or hide the bottom status bar. |
| Tab Close Button | Select | hover | When to show the tab close button: `always`, `hover` (on mouse-over), or `never`. |

### Themes

Visual theme picker showing all available themes as clickable cards. See [Themes & Appearance](#9-themes--appearance).

### Profiles

Manage terminal profiles. See [Profiles](#8-profiles).

### Notifications

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| Visual Bell | Checkbox | On | Flash the terminal tab when a bell character is received. |
| Bell Sound | Checkbox | Off | Play the system beep sound on bell. |
| Desktop Notifications | Checkbox | On | Show OS-level desktop notifications for important events. |

### Behavior

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| Close to Tray | Checkbox | On | Minimize to system tray instead of quitting when the window is closed. |
| Start on Login | Checkbox | Off | Automatically start Agent Desk when you log in to your computer. |
| New Terminal on Startup | Checkbox | On | Automatically open a terminal when Agent Desk starts (and no session is restored). |
| Default New Terminal Command | Text | (empty) | A command to run automatically in each new terminal. |

### Templates

Manage agent launch templates. See [Batch Launch & Templates](#5-batch-launch--templates).

### Workspaces

Manage saved workspaces. See [Workspaces](#12-workspaces).

### Keyboard Shortcuts

View and customize all keyboard shortcuts. See [Keyboard Shortcuts](#14-keyboard-shortcuts).

---

## 12. Workspaces

**Project-centric workspaces** (v1.6+). A workspace bundles a project root folder, per-workspace environment variables, a color, and a list of AI agents to spawn on open. The workspace switcher in the titlebar shows pinned workspaces at the top and recently-opened ones below.

### Saving a Workspace

1. Press **Ctrl+Shift+W** or select "Save Workspace" from the command palette.
2. The save dialog asks for:
   - **Name** — short label, e.g. "agent-desk" or "api-review"
   - **Root path** — pick with the folder picker button, or paste an absolute path
   - **Color** — click a swatch from the 24-hue palette; colors tint the titlebar tab and switcher row
   - **Environment variables** — add `KEY=VALUE` rows with the + button; removed values are never written to the user's process environment, they're scoped to terminals spawned by this workspace
   - **Agents** — multi-select from your available profiles (Claude Code, Default Shell, any custom profile)
   - **Pin** — toggle to surface the workspace at the top of the switcher
3. Click **Save**.

### Opening a Workspace

- **Switcher**: click the dropdown in the titlebar, then click any pinned or recent workspace.
- **Keyboard**: **Ctrl+Alt+W** opens the legacy workspace picker (still available for power users).

Opening a workspace does three things:
1. Resolves the root path as the new default cwd
2. Merges the workspace's env vars with the process env for every terminal it spawns
3. Spawns one terminal per configured agent, each named `<profile> @ <workspace>`

### Recent workspaces

The switcher shows the most recently opened workspaces first, with pinned ones pinned to the top of the list. Opening a workspace bumps its `lastOpened` timestamp and re-orders the switcher automatically.

### Migration from older versions

If you're upgrading from v1.5 or earlier, your existing workspaces are migrated on first launch. The migration is lossless: layouts, terminal lists, and names are preserved; new fields (root path, color, env, agents, pinned) default to empty. You can add them later by saving the workspace again.

---

## 13. Session Persistence

Agent Desk automatically saves your session so you can pick up where you left off.

### What Is Auto-Saved

Every 60 seconds, Agent Desk saves:

- The list of open terminals (their commands, arguments, working directories, titles, profile names, and agent names).
- The grid layout (which terminals are split where and at what sizes).
- Terminal buffer content (the text currently in each terminal's scrollback).

### Restore Prompt on Startup

When you launch Agent Desk and a previous session is found, a restore dialog appears:

- It shows how many terminals were in the saved session.
- A 10-second countdown auto-restores the session if you do not interact.
- Click **Restore** to bring back the session immediately.
- Click **Start Fresh** to skip restoration and begin with a clean slate.

### What Gets Restored

- All terminal sessions are recreated with their original commands and working directories.
- Terminal names are restored.
- Buffer content is replayed so you can see previous output.
- If agent-comm is running, agent registrations are re-established.

---

## 14. Keyboard Shortcuts

All keyboard shortcuts are customizable. Open Settings > Keyboard Shortcuts, or press **F1** to see the shortcuts overlay.

### Terminals

| Shortcut | Action |
| --- | --- |
| Ctrl+Shift+T | New terminal |
| Ctrl+Shift+C | New agent session |
| Ctrl+W | Close terminal |
| Ctrl+Tab | Next terminal |
| Ctrl+Shift+Tab | Previous terminal |
| Ctrl+Shift+D | Split right |
| Ctrl+\\ | Split right (alt) |
| Ctrl+Shift+E | Split down |
| Ctrl+Shift+M | Toggle maximize |
| Ctrl+Shift+S | Save terminal output to file |
| Ctrl+F | Search in current terminal |
| Ctrl+Shift+F | Search all terminals |

### Navigation

| Shortcut | Action |
| --- | --- |
| Alt+ArrowLeft | Focus left pane |
| Alt+ArrowRight | Focus right pane |
| Alt+ArrowUp | Focus upper pane |
| Alt+ArrowDown | Focus lower pane |

### Views

| Shortcut | Action |
| --- | --- |
| Ctrl+1 | Terminals view |
| Ctrl+2 | Agent Comm dashboard |
| Ctrl+3 | Agent Tasks dashboard |
| Ctrl+4 | Agent Knowledge dashboard |
| Ctrl+5 | Agent Discover dashboard |
| Ctrl+6 | Event Stream |
| Ctrl+7 | Settings |

### General

| Shortcut | Action |
| --- | --- |
| Ctrl+Shift+P | Command palette |
| Ctrl+P | Quick switcher |
| F1 | Show keyboard shortcuts |
| Ctrl+E | Event Stream view |
| Ctrl+Shift+B | Batch agent launcher |
| Ctrl+Shift+W | Save workspace |
| Ctrl+Alt+W | Load workspace |
| Escape | Close overlays, search bars, dialogs |

### Customizing Keybindings

1. Open Settings (Ctrl+7) and scroll to **Keyboard Shortcuts**.
2. Each shortcut shows its current key combo and a capture button.
3. Click the capture button, then press the key combination you want.
4. Press Escape to cancel capture, or press any other key combo to assign it.
5. Click the reset icon next to a shortcut to restore its default binding.

Custom keybindings are saved to `~/.agent-desk/keybindings.json` and persist across sessions.

---

## 15. Lifecycle Controls

Agent Desk provides several ways to manage the lifecycle of terminal processes, especially AI agents.

### From the Right-Click Context Menu

Right-click a terminal tab to access lifecycle options. The available actions depend on the terminal's state:

- **Interrupt (Ctrl+C)** -- sends SIGINT to the running process. Useful for interrupting a long-running command or an agent that is stuck.
- **Stop** -- sends SIGTERM, asking the process to terminate gracefully.
- **Force Kill** -- sends SIGKILL, immediately terminating the process with no chance to clean up.
- **Restart** -- kills the current process and starts a fresh one with the same command and working directory.

### Tab Action Buttons

When a terminal is running, small action buttons appear on its tab:

- A **stop** button (visible when the terminal is in the running or working state).
- A **restart** button (visible when the terminal has exited).

### Signals Explained

| Signal | Effect | When to Use |
| --- | --- | --- |
| SIGINT | Interrupt | The process may catch this and clean up. Same as pressing Ctrl+C in a terminal. |
| SIGTERM | Terminate | Asks the process to shut down gracefully. Most programs will save state and exit. |
| SIGKILL | Kill | Forces immediate termination. Use only if SIGTERM does not work. |

---

## 16. Cost Tracking

Agent Desk estimates the cost of running AI agents and displays it in the status bar.

### Where to See It

Look at the right side of the status bar for the cost widget, which shows a dollar amount (e.g., `~$1.42`). The `~` prefix indicates an estimate; when actual cost data is parsed from agent output, the prefix changes to `$`.

### How Costs Are Estimated

Agent Desk tracks tool calls and messages from each AI agent terminal using the agent parser. It estimates costs based on the number of tool calls and message exchanges. If the agent outputs actual cost information, that data is used instead of estimates.

### Per-Agent Breakdown

Hover over the cost widget to see a tooltip with a breakdown per agent:

```
Estimated Cost: ~$3.45

arch-review: ~$1.20 (15 tools, 8 msgs)
security-review: ~$1.05 (12 tools, 6 msgs)
quality-review: ~$1.20 (14 tools, 7 msgs)
```

### Warning Thresholds

Agent Desk shows toast warnings at two levels:

- **$2 per agent** -- when any single agent's estimated cost exceeds $2, a warning toast appears.
- **$5 total** -- when the combined cost of all agents exceeds $5, a warning toast appears.

The cost value in the status bar also changes color:

- **Green** -- under $2
- **Yellow** -- $2 to $5
- **Red** -- over $5

---

## 17. Communication Graph

The Communication Graph is a canvas-based visualization of agent interactions.

### What It Shows

The graph displays:

- **Nodes** -- one circle for each agent currently registered with agent-comm. Each node shows the agent's initial letter, name, and status color (blue for online, gray for idle/offline).
- **Edges** -- lines connecting agents that have communicated. Thicker lines indicate more messages exchanged.
- **Pulse animation** -- online agents have a subtle pulsing glow.

### How to Access It

Open the Communication Graph from the command palette (Ctrl+Shift+P, type "Communication Graph") or via the Agent Comm dashboard's toolbar.

### Reading the Visualization

- **Node colors**: Blue nodes are online, gray nodes are idle or offline.
- **Edge thickness**: Proportional to message count between two agents.
- **Hover**: Hover over a node to see the agent's name, status, and status text in a tooltip.
- **Click**: Click a node to switch to the Terminals view and focus that agent's terminal.

The graph fetches data from agent-comm every 10 seconds and renders at 60fps with smooth animations.

---

## 18. Git Sidebar

Read-only view of the git state of the current workspace, docked in the sidebar.

### What it shows

- **Branch line** — current branch name with a detached-HEAD indicator and a dirty indicator if any file is modified
- **Ahead / behind badges** — commits local is ahead of `@{u}` and commits behind, if an upstream is tracked
- **File list** — grouped by status: staged, unstaged, untracked. Each row shows the path and the status code (M / A / D / ? / R / U).
- **Last commit** — the subject, author, and age of HEAD.

### How it updates

The sidebar polls `git status` on the active workspace's root at a 1 s TTL cache. When any file inside `.git/HEAD` or `.git/index` changes, a debounced push event fires and the sidebar refreshes immediately — so committing or branch-switching from a terminal is reflected within a second.

### Clicking a file

Clicking a file row opens the diff viewer with that file's working-tree-vs-HEAD diff. Right-clicking offers **Open in external editor** (see section 20).

### Read-only

v1 is **read-only**. You cannot stage, commit, push, or pull from the sidebar — drive those operations from the terminal as usual. This is deliberate: the sidebar is a visibility tool, not a git frontend.

### Non-git directories

If the active workspace root isn't a git repository, the sidebar shows an empty state with a "Not a git repository" hint instead of erroring.

---

## 19. Diff Viewer

Keyboard-driven overlay for inspecting what an agent changed.

### Opening a diff

- **Click a file** in the git sidebar — opens the working-tree-vs-HEAD diff
- **Trigger** via the command palette or `window.agentDesk.diff.render(old, new)` from a plugin
- **Programmatic**: dispatch a `diff:open` CustomEvent on `window` with `{ path, root }` in the detail

### Reading the diff

- **Unified mode** (default) — single column with +/- gutters and pre-highlighted syntax
- **Side-by-side mode** — toggle with **s**; old text on the left, new text on the right, blank-padded rows to align add/del pairs
- **Hunks** are rendered as separate sections with a `@@ -oldStart,oldLines +newStart,newLines @@` header
- **Colors** follow your current theme — github-dark under dark themes, github-light under light

### Keyboard shortcuts inside the viewer

| Key    | Action                                          |
| ------ | ----------------------------------------------- |
| `j`    | Jump to next hunk                               |
| `k`    | Jump to previous hunk                           |
| `s`    | Toggle unified / side-by-side                   |
| `o`    | Open current file in external editor            |
| `Esc`  | Close                                           |

### Edge cases

- **Binary files** — the viewer detects null bytes and shows "Binary file — no textual preview available" instead of rendering garbage
- **Large files** (> 500 KB on either side) — syntax highlighting is skipped and the diff renders as plain text with a "highlighting skipped" status. The diff itself is still computed.

---

## 20. External Editor Handoff

When you want to leave Agent Desk and keep editing a file in your real editor, just right-click and pick "Open in \<editor>".

### Supported editors

On first launch, Agent Desk scans your `PATH` for:

- `code` — Visual Studio Code
- `cursor` — Cursor
- `windsurf` — Windsurf
- `codium` — VSCodium

The first one found becomes your default. You can switch via `config.settings.externalEditor` (a settings UI is a follow-up).

### Where the menu appears

1. **Terminal tab right-click** — opens the terminal's current working directory
2. **Agent monitor card right-click** — opens the agent's working directory
3. **Git sidebar file row right-click** — opens the specific file
4. **Diff viewer** — press **o** inside the viewer to open the current file at the viewed line

### How the handoff works

Agent Desk tries the editor's URL scheme first (`vscode://file/<path>:<line>:<col>`, `cursor://file/...`, etc.) via `shell.openExternal`. If the URL scheme isn't registered — common if the editor has never been launched — it falls back to spawning the CLI directly with `--goto <path>:<line>:<col>`, detached, with stdio ignored so Agent Desk can exit without tearing down the child.

### Web / server target

If you're running Agent Desk's server target and connecting via the web or PWA client, `editor:open` returns `{ ok: false, reason: 'desktop-only' }` — opening a file in an editor on the server host has no meaning for a remote browser user.

---

## 21. Troubleshooting

### App Won't Start

Agent Desk enforces a single-instance lock. If you see nothing happen when launching, a previous instance may still be running. Check your system tray (the app may be minimized there). If the previous instance crashed, you may need to wait a moment or terminate the process manually from Task Manager / Activity Monitor.

### Terminals Show the Wrong Path

The working directory shown in the status bar relies on shell integration (OSC escape sequences). If your shell does not emit these sequences, the path may be blank or outdated. Most modern shells (bash, zsh, PowerShell, fish) support this natively.

### Dashboard Shows "Connection Failed"

This means the corresponding backend service is not running. Check that:

1. The service (agent-comm, agent-tasks, or agent-knowledge) is installed and started.
2. It is running on the expected port (3421, 3422, or 3423 by default).
3. No firewall is blocking localhost connections.
4. The URL in Settings > Dashboard URLs is correct.

The dashboard will retry automatically with exponential backoff (3s, 6s, 12s, up to 30s). Click **Retry Now** to reconnect immediately.

### Theme Doesn't Apply to Dashboards

Themes are synced to plugin shadow roots whenever a plugin mounts and whenever you change theme in Settings. The host walks the standard CSS variable contract (`bg`, `accent`, `text`, …) and copies the resolved values into the plugin's shadow root. If a plugin somehow renders with default styling, switch away and back to trigger a remount, or change the theme in Settings to force an immediate sync.

### Onboarding Keeps Showing

The onboarding wizard sets a flag in both the config file (`~/.agent-desk/config.json`) and localStorage. If it keeps appearing:

1. Open Settings and check that the config file is writable.
2. Clear localStorage via DevTools (Ctrl+Shift+I > Application > Local Storage) if needed.
3. The "Don't show again" checkbox on the final step must be checked.

### Crash Logs

If Agent Desk crashes, a crash log is saved to `~/.agent-desk/crash-logs/`. On next launch, a toast notification tells you where to find it. You can open the crash log directory via the app's API. Up to 10 crash logs are retained with automatic rotation.

### Auto-Update Issues

Agent Desk checks for updates automatically. If a download completes, a banner appears at the top of the window with a **Restart Now** button. If you dismiss it, the update installs on the next restart. If updates fail, check your internet connection and that the app has write access to its installation directory.
