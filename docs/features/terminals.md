# Terminal Management

Agent Desk's terminal system combines full terminal emulation with a flexible grid layout.

## Terminal Engine

- **Full terminal emulation** with hardware-accelerated WebGL rendering
- **Native process management** for true shell sessions
- **Clickable URLs** in terminal output
- **Built-in search** for fast in-terminal text search
- **Auto-resize** -- terminals resize automatically when their container changes

## Grid Layout

- **Tabbed interface** -- each terminal gets a tab with title, status dot, and close button
- **Split panes** -- split horizontally or vertically to create multi-pane layouts
- **Drag-and-drop** -- reorder tabs or drag them to different grid positions
- **Resize** -- drag dividers between panes to adjust sizes
- **Maximize** -- temporarily maximize a single terminal, then restore
- **Pop-out** -- detach a terminal into its own window

## Profile System

- **3 built-in profiles** -- Default Shell, Claude, OpenCode
- **Custom profiles** -- define command, args, cwd, and icon
- **19 icon choices** -- Material Symbols icons for visual identification
- **Default profile** -- configurable; used for <kbd>Ctrl+Shift+T</kbd>

## Terminal Features

- **Configurable font** -- family, size, line height
- **Cursor options** -- bar, block, or underline; blink on/off
- **Scrollback buffer** -- configurable up to any line count (default 10,000)
- **Bell handling** -- visual flash, sound, or desktop notification
- **Context menu** -- right-click for rename, save output, restart, close
- **Output save** -- export terminal buffer to file via native save dialog
- **Auto-rename** -- terminals running agents are automatically named

## Navigation

- **Tab cycling** -- <kbd>Ctrl+Tab</kbd> / <kbd>Ctrl+Shift+Tab</kbd>
- **Directional focus** -- <kbd>Alt+Arrows</kbd> to move between panes
- **Quick Switcher** -- <kbd>Ctrl+P</kbd> for fuzzy terminal name search
- **Command Palette** -- <kbd>Ctrl+Shift+P</kbd> for all actions

## Process Management

- **Graceful close** -- confirmation dialog for running processes
- **Restart** -- restart a terminal without losing its position in the grid
- **Exit detection** -- terminals show exited status when the process ends
- **Signal support** -- send signals to terminal processes

For the full guide, see [Terminals](/guide/terminals).
