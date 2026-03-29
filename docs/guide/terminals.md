# Terminals

Agent Desk's terminal system provides a full-featured terminal experience with native process management and a flexible grid layout, plus agent-aware enhancements.

## Creating Terminals

There are several ways to create a new terminal:

| Method | Description |
|--------|-------------|
| <kbd>Ctrl+Shift+T</kbd> | New terminal using default profile |
| <kbd>Ctrl+Shift+C</kbd> | New terminal using first agent profile |
| Command Palette | <kbd>Ctrl+Shift+P</kbd> then select a profile |
| Context Menu | Right-click a tab for options |

Each terminal is created from a **profile** that defines the shell command, arguments, working directory, and icon. See [Profiles](/guide/profiles) for details.

## Tab Management

Terminals appear as tabs in the terminal grid. Each tab shows:

- The terminal title (profile name or auto-detected agent name)
- A status indicator dot (running, idle, exited)
- A close button (hover to reveal, configurable in Settings)

### Tab Actions

- **Click** a tab to focus that terminal
- **Double-click** a tab to rename it
- **Drag** a tab to reorder or move it to a different grid position
- **Right-click** a tab for the context menu (rename, save output, restart, close)

## Grid Layout

The terminal area uses a flexible grid layout. You can create complex multi-pane arrangements:

### Splitting

- <kbd>Ctrl+Shift+D</kbd> or <kbd>Ctrl+\\</kbd> -- Split the active terminal to the right
- <kbd>Ctrl+Shift+E</kbd> -- Split the active terminal downward

### Navigation

- <kbd>Alt+Left/Right/Up/Down</kbd> -- Focus the terminal in that direction
- <kbd>Ctrl+Tab</kbd> / <kbd>Ctrl+Shift+Tab</kbd> -- Cycle through all terminals
- <kbd>Ctrl+P</kbd> -- Quick Switcher for instant jump-to-terminal by name

### Resize and Maximize

- **Drag dividers** between panes to resize
- <kbd>Ctrl+Shift+M</kbd> -- Toggle maximize for the active terminal (hides all other panes temporarily)

### Pop-Out Windows

Terminals can be popped out into separate windows via the context menu. This is useful when you want an agent running on a secondary monitor while keeping the main grid for other work.

## Terminal Features

### In-Terminal Search

Press <kbd>Ctrl+F</kbd> to open the search bar within the active terminal. This uses the built-in search to find text in the scrollback buffer.

- Navigate matches with the arrow buttons or <kbd>Enter</kbd>/<kbd>Shift+Enter</kbd>
- Press <kbd>Escape</kbd> to close the search bar

### Save Output

Press <kbd>Ctrl+Shift+S</kbd> to save the entire terminal buffer to a file. A native save dialog opens where you can choose the output location and format.

### Select / Copy Last Output

The command palette includes actions to select or copy the output of the last command. These work with shell integration (see [Shell Integration](/guide/shell-integration)) to detect command boundaries.

### Scrollback Buffer

Terminals maintain a configurable scrollback buffer (default: 10,000 lines). You can adjust this in Settings under the Terminal section.

## Terminal Status

Each terminal tracks its process status:

- **Running** (green dot) -- the shell or agent process is active
- **Idle** -- the process is running but no recent activity
- **Exited** (red dot) -- the process has terminated

When a terminal contains a detected AI agent, additional status information is shown including the agent's current activity, tool calls, and cost metrics.

## Closing Terminals

- <kbd>Ctrl+W</kbd> -- Close the active terminal (with confirmation if the process is running)
- Click the close button on a tab
- Right-click the tab and select Close

::: tip
If you accidentally close a terminal, the session data is not recoverable. Consider using [Workspaces](/guide/workspaces) to save your layout for easy restoration.
:::

## Related

- [Profiles](/guide/profiles) -- Configure terminal profiles
- [Search](/guide/search) -- In-terminal and cross-terminal search
- [Shell Integration](/guide/shell-integration) -- Enhanced shell features with OSC sequences
- [Keybindings](/guide/keybindings) -- Customize keyboard shortcuts
