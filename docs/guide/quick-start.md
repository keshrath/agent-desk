# Quick Start

This guide walks you through your first session with Agent Desk -- from launching the app to running agents and monitoring their work.

## First Launch

When you start Agent Desk for the first time, a new terminal opens automatically using your default shell profile. You'll see:

- The **sidebar** on the left with view icons
- The **terminal area** in the center
- The **status bar** at the bottom with system stats

![Agent Desk Overview](/screenshots/overview.png)

## Open a Terminal

Press <kbd>Ctrl+Shift+T</kbd> to open a new terminal. By default, it uses your system shell (PowerShell on Windows, bash/zsh on macOS/Linux).

To open a terminal with a specific profile:
1. Press <kbd>Ctrl+Shift+P</kbd> to open the Command Palette
2. Type the profile name (e.g., "Claude")
3. Select it to launch

## Launch an Agent

If you have Claude Code installed, launch it directly:

1. Press <kbd>Ctrl+Shift+C</kbd> to open a new agent session using the first non-shell profile
2. Or use the Command Palette (<kbd>Ctrl+Shift+P</kbd>) and select "New: Claude"

Agent Desk will automatically detect the running agent and begin tracking its status, tool calls, and cost.

## Split the Layout

Create a side-by-side layout to watch multiple terminals:

- <kbd>Ctrl+Shift+D</kbd> or <kbd>Ctrl+\\</kbd> -- Split right
- <kbd>Ctrl+Shift+E</kbd> -- Split down

You can also drag and drop tabs to rearrange the grid layout. Resize panes by dragging the dividers.

## Navigate Between Terminals

- <kbd>Ctrl+Tab</kbd> / <kbd>Ctrl+Shift+Tab</kbd> -- Cycle through terminals
- <kbd>Alt+Arrow</kbd> -- Focus the terminal in that direction (left/right/up/down)
- <kbd>Ctrl+P</kbd> -- Quick Switcher to jump to any terminal by name

## Check Agent Status

Switch to the **Agent Monitor** view:

1. Press <kbd>Ctrl+5</kbd> or click the monitor icon in the sidebar
2. See live cards for every detected agent with status, assigned tasks, and tool activity

![Agent Monitor](/screenshots/agent-monitor.png)

## Launch Multiple Agents

For parallel workflows, use **Batch Launch**:

1. Press <kbd>Ctrl+Shift+B</kbd>
2. Set the agent count, profile, naming pattern (e.g., `review-{n}`)
3. Optionally set a stagger delay between launches
4. Click Launch

![Batch Launcher](/screenshots/batch-launcher.png)

## Search Across Terminals

Press <kbd>Ctrl+Shift+F</kbd> to open **Global Search**. This searches all terminal buffers simultaneously:

- Toggle case sensitivity and regex mode
- Use <kbd>Up</kbd>/<kbd>Down</kbd> arrows to navigate results
- Press <kbd>Enter</kbd> to jump to the matching terminal and line

![Global Search](/screenshots/global-search.png)

## View the Event Stream

Press <kbd>Ctrl+E</kbd> to toggle the **Event Stream** -- a real-time timeline of all terminal and agent events:

- Filter by category (tools, errors, status, lifecycle)
- Search events by text
- Click an event to expand details
- Export the event log

![Event Stream](/screenshots/event-stream.png)

## Save Your Workspace

When you have a layout you like, save it:

1. Press <kbd>Ctrl+Shift+W</kbd>
2. Enter a workspace name (e.g., "dev-setup")
3. The layout, terminal positions, and profiles are saved

Restore it anytime with <kbd>Ctrl+Alt+W</kbd>.

## Customize the App

Open Settings with <kbd>Ctrl+6</kbd> to:

- Change the theme (8 built-in themes + custom theme editor)
- Configure terminal font, cursor, scrollback
- Set up dashboard service URLs
- Manage profiles and templates
- Customize keybindings

## Next Steps

- Deep dive into [Terminal Management](/guide/terminals)
- Learn about [Profiles](/guide/profiles) for custom agent setups
- Set up [Dashboard Services](/guide/dashboards) for full agent orchestration
- Explore all [Keyboard Shortcuts](/reference/shortcuts)
