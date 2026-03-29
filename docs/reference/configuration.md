# Configuration Reference

Agent Desk stores its configuration in `~/.agent-desk/config.json`. This page documents the complete schema.

## Config File Location

| Platform | Path |
|----------|------|
| Windows | `%USERPROFILE%\.agent-desk\config.json` |
| macOS | `~/.agent-desk/config.json` |
| Linux | `~/.agent-desk/config.json` |

## Schema

The config file uses a versioned schema. Current version: **1**.

```json
{
  "version": 1,
  "settings": { ... },
  "profiles": [ ... ],
  "templates": [ ... ],
  "workspaces": [ ... ]
}
```

## Settings Object

```json
{
  "settings": {
    "defaultShell": "PowerShell",
    "defaultTerminalCwd": "",
    "fontSize": 14,
    "fontFamily": "JetBrains Mono",
    "cursorStyle": "bar",
    "cursorBlink": true,
    "scrollback": 10000,
    "lineHeight": 1.3,
    "agentCommUrl": "http://localhost:3421",
    "agentTasksUrl": "http://localhost:3422",
    "agentKnowledgeUrl": "http://localhost:3423",
    "sidebarPosition": "left",
    "showStatusBar": true,
    "tabCloseButton": "hover",
    "closeToTray": true,
    "startOnLogin": false,
    "newTerminalOnStartup": true,
    "defaultNewTerminalCommand": "",
    "bellSound": false,
    "bellVisual": true,
    "desktopNotifications": true,
    "theme": "dark",
    "preferredDarkTheme": "default-dark",
    "preferredLightTheme": "default-light",
    "followSystemTheme": false
  }
}
```

### Setting Details

| Key | Type | Default | Values |
|-----|------|---------|--------|
| `defaultShell` | string | `"PowerShell"` | Any installed shell name |
| `defaultTerminalCwd` | string | `""` | Absolute path or empty for home |
| `fontSize` | number | `14` | 8-72 |
| `fontFamily` | string | `"JetBrains Mono"` | Any monospace font |
| `cursorStyle` | string | `"bar"` | `"bar"`, `"block"`, `"underline"` |
| `cursorBlink` | boolean | `true` | |
| `scrollback` | number | `10000` | 1-1000000 |
| `lineHeight` | number | `1.3` | 0.5-3.0 |
| `agentCommUrl` | string | `"http://localhost:3421"` | URL |
| `agentTasksUrl` | string | `"http://localhost:3422"` | URL |
| `agentKnowledgeUrl` | string | `"http://localhost:3423"` | URL |
| `sidebarPosition` | string | `"left"` | `"left"`, `"right"` |
| `showStatusBar` | boolean | `true` | |
| `tabCloseButton` | string | `"hover"` | `"hover"`, `"always"`, `"never"` |
| `closeToTray` | boolean | `true` | |
| `startOnLogin` | boolean | `false` | |
| `newTerminalOnStartup` | boolean | `true` | |
| `defaultNewTerminalCommand` | string | `""` | Any command string |
| `bellSound` | boolean | `false` | |
| `bellVisual` | boolean | `true` | |
| `desktopNotifications` | boolean | `true` | |
| `theme` | string | `"dark"` | Theme ID |
| `preferredDarkTheme` | string | `"default-dark"` | Theme ID |
| `preferredLightTheme` | string | `"default-light"` | Theme ID |
| `followSystemTheme` | boolean | `false` | |

## Profiles Array

```json
{
  "profiles": [
    {
      "id": "default-shell",
      "name": "Default Shell",
      "command": "",
      "args": [],
      "cwd": "",
      "icon": "terminal",
      "builtin": true
    },
    {
      "id": "claude",
      "name": "Claude",
      "command": "claude",
      "args": [],
      "cwd": "",
      "icon": "smart_toy",
      "builtin": true
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Display name |
| `command` | string | Executable command (empty for default shell) |
| `args` | string[] | Command-line arguments |
| `cwd` | string | Working directory (empty for home) |
| `icon` | string | Material Symbol icon name |
| `builtin` | boolean | Whether this is a built-in profile |

## Templates Array

```json
{
  "templates": [
    {
      "id": "quick-review",
      "name": "Quick Review",
      "icon": "rate_review",
      "description": "3 agents for parallel code review",
      "builtin": true,
      "agents": [
        {
          "name": "arch-review",
          "profile": "claude",
          "command": "claude",
          "initialInput": ""
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Display name |
| `icon` | string | Material Symbol icon name |
| `description` | string | Template description |
| `builtin` | boolean | Whether this is a built-in template |
| `agents` | array | Agent slot definitions |
| `agents[].name` | string | Agent name |
| `agents[].profile` | string | Profile ID to use |
| `agents[].command` | string | Command override |
| `agents[].initialInput` | string | Text to type after launch |

## Workspaces Array

```json
{
  "workspaces": [
    {
      "name": "dev-setup",
      "terminals": [
        {
          "panelId": "panel-1",
          "command": "claude",
          "args": [],
          "cwd": "~/projects/my-app",
          "title": "agent-1",
          "profile": "Claude",
          "icon": "smart_toy"
        }
      ],
      "layout": { }
    }
  ]
}
```

## Keybindings File

Keybinding overrides are stored separately in `~/.agent-desk/keybindings.json`:

```json
{
  "terminal.new": "Ctrl+N",
  "terminal.close": "Ctrl+Shift+W"
}
```

Only overridden bindings are listed. See [Keybindings](/guide/keybindings) for the full binding ID list.

## Other Files

| File | Description |
|------|-------------|
| `~/.agent-desk/config.json` | Main configuration |
| `~/.agent-desk/keybindings.json` | Keybinding overrides |
| `~/.agent-desk/crash-logs/` | Crash log directory (max 10 files) |
