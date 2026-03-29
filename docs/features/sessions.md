# Session & Persistence

Agent Desk provides several mechanisms for saving and restoring your work across sessions.

## Workspaces

Save and restore complete terminal layouts:

- **Layout capture** -- saves grid arrangement, pane sizes, and positions
- **Terminal state** -- saves each terminal's profile, command, args, cwd, title, and icon
- **Named workspaces** -- save multiple layouts with descriptive names
- **Quick save/load** -- <kbd>Ctrl+Shift+W</kbd> to save, <kbd>Ctrl+Alt+W</kbd> to load

## Configuration Persistence

All settings are persisted to `~/.agent-desk/config.json`:

- **Settings** -- all 30+ configurable options
- **Profiles** -- terminal profile definitions
- **Templates** -- agent launch templates
- **Workspaces** -- saved workspace layouts
- **Custom themes** -- user-created themes

The config file is versioned (currently version 1) and watched for external changes. Edits made outside the app are picked up automatically.

## Keybinding Persistence

Keyboard shortcut overrides are stored separately in `~/.agent-desk/keybindings.json`. Only customized bindings are stored -- defaults are not persisted.

## Event Stream Persistence

The event stream stores up to 1,000 events in localStorage, surviving page reloads. Events are pruned when the buffer limit is reached.

## Auto-Save

Agent Desk auto-saves session layout data periodically. This includes:

- Current terminal positions and sizes
- Active terminal references
- View state

## Config File Watching

The config file is watched by the main process using a file system watcher. When the file changes (e.g., edited externally or synced via a file sync service), the changes are broadcast to the renderer and applied immediately.

## Crash Recovery

Agent Desk includes a crash reporter that:

- Writes crash logs to `~/.agent-desk/crash-logs/`
- Maintains a rotation of the last 10 crash logs
- On startup, checks for previous crash logs and offers recovery
- Reports errors via the IPC API

## Auto-Update

Agent Desk checks for updates automatically:

- Uses electron-updater to check GitHub Releases
- Shows a notification when an update is available
- Supports one-click install-and-restart

For the full guide, see [Workspaces](/guide/workspaces).
