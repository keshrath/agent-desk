# Settings

Agent Desk has a comprehensive settings panel accessible via <kbd>Ctrl+6</kbd> or the sidebar's settings icon. All settings are persisted to `~/.agent-desk/config.json` and cached in localStorage for fast access.

## Terminal Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Default Shell | PowerShell | Shell used for the Default Shell profile |
| Default Terminal CWD | *(home dir)* | Working directory for new terminals |
| Font Size | 14 | Terminal font size in pixels |
| Font Family | JetBrains Mono | Terminal font (monospace fonts recommended) |
| Cursor Style | Bar | `bar`, `block`, or `underline` |
| Cursor Blink | On | Whether the cursor blinks |
| Scrollback | 10,000 | Number of lines kept in the scrollback buffer |
| Line Height | 1.3 | Line height multiplier for terminal text |

## Dashboard URLs

| Setting | Default | Description |
|---------|---------|-------------|
| Agent Comm URL | `http://localhost:3421` | URL of the agent-comm service |
| Agent Tasks URL | `http://localhost:3422` | URL of the agent-tasks service |
| Agent Knowledge URL | `http://localhost:3423` | URL of the agent-knowledge service |

These URLs are used for embedding dashboards and for API polling (agent monitor, task badges).

## Appearance

| Setting | Default | Description |
|---------|---------|-------------|
| Theme | Dark | Active theme selection |
| Preferred Dark Theme | Default Dark | Theme used in dark mode when following system |
| Preferred Light Theme | Default Light | Theme used in light mode when following system |
| Follow System Theme | Off | Automatically switch dark/light with OS |
| Sidebar Position | Left | `left` or `right` sidebar placement |
| Show Status Bar | On | Toggle the bottom status bar |
| Tab Close Button | Hover | When to show tab close buttons: `hover`, `always`, or `never` |

## Behavior

| Setting | Default | Description |
|---------|---------|-------------|
| Close to Tray | On | Minimize to system tray instead of quitting |
| Start on Login | Off | Launch Agent Desk when the OS starts |
| New Terminal on Startup | On | Automatically open a terminal when the app launches |
| Default New Terminal Command | *(empty)* | Command to auto-type into new terminals |

## Notifications

| Setting | Default | Description |
|---------|---------|-------------|
| Bell Sound | Off | Play a sound on terminal bell |
| Bell Visual | On | Flash the terminal tab on bell |
| Desktop Notifications | On | Show OS notifications for agent events |

## Profiles Section

The Profiles section shows all configured profiles with options to:

- **Add** a new profile
- **Edit** an existing profile (name, command, args, cwd, icon)
- **Delete** a custom profile
- **Set default** profile

See [Profiles](/guide/profiles) for details.

## Templates Section

The Templates section shows agent launch templates with options to:

- **Add** a new template
- **Edit** template name, description, icon, and agent slots
- **Delete** a custom template

See [Batch Launch & Templates](/guide/batch-launch) for details.

## Keybindings Section

The Keybindings section displays all keyboard shortcuts organized by category, with the ability to rebind any shortcut. See [Keybindings](/guide/keybindings) for details.

## Config File

Settings are stored in `~/.agent-desk/config.json` with the following structure:

```json
{
  "version": 1,
  "settings": {
    "fontSize": 14,
    "theme": "dark",
    ...
  },
  "profiles": [...],
  "templates": [...],
  "workspaces": [...]
}
```

The config file is watched for external changes. If you edit it in a text editor while Agent Desk is running, the app will pick up the changes automatically.

## Related

- [Profiles](/guide/profiles) -- Profile management
- [Themes](/guide/themes) -- Theme system details
- [Keybindings](/guide/keybindings) -- Keyboard shortcut customization
- [Configuration Reference](/reference/configuration) -- Full config file schema
