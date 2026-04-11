# Profiles

Profiles define how terminals are created. Each profile specifies a command, arguments, working directory, and display icon. When you open a new terminal, you're launching a profile.

## Built-in Profiles

Agent Desk ships with three built-in profiles:

| Profile | Command | Icon | Description |
|---------|---------|------|-------------|
| Default Shell | *(system default)* | `terminal` | Your OS shell (PowerShell, bash, zsh) |
| Claude | `claude` | `smart_toy` | Claude Code CLI agent |
| OpenCode | `opencode` | `code` | OpenCode agent |

Built-in profiles cannot be deleted, but you can modify their settings.

## Creating a Profile

1. Open Settings (<kbd>Ctrl+7</kbd>)
2. Scroll to the **Profiles** section
3. Click **Add Profile**
4. Fill in the fields:
   - **Name** -- display name in menus and tabs
   - **Command** -- the executable to run (e.g., `claude`, `bash`, `python`)
   - **Arguments** -- command-line arguments (as a list)
   - **Working Directory** -- initial directory (leave blank for home directory)
   - **Icon** -- choose from the Material Symbols icon set

![Settings Profiles](/screenshots/settings-profiles.png)

## Default Profile

The default profile is used when you press <kbd>Ctrl+Shift+T</kbd>. To change it:

1. Open Settings (<kbd>Ctrl+7</kbd>)
2. In the **Terminal** section, find "Default Profile"
3. Select from the dropdown

## Profile Icons

Each profile has an icon that appears in tabs, the sidebar, and the command palette. Available icons include:

`terminal`, `smart_toy`, `code`, `data_object`, `memory`, `bug_report`, `build`, `science`, `psychology`, `hub`, `dns`, `storage`, `cloud`, `settings`, `folder`, `language`, `developer_mode`, `speed`, `analytics`

These are [Material Symbols](https://fonts.google.com/icons) rendered from the app's icon font.

## Using Profiles

Profiles appear in several places:

- **Command Palette** (<kbd>Ctrl+Shift+P</kbd>) -- type "New:" to see all profiles
- **Batch Launcher** (<kbd>Ctrl+Shift+B</kbd>) -- select which profile to launch in batch
- **Templates** -- agent templates reference profiles for each agent slot

::: tip
Create separate profiles for different project setups. For example, a "Claude (frontend)" profile with `--cwd ~/projects/frontend` and a "Claude (backend)" profile with `--cwd ~/projects/backend`.
:::

## Profile Storage

Profiles are stored in `~/.agent-desk/config.json` under the `profiles` key. They are also cached in localStorage for fast access. Changes made in Settings are automatically persisted to both locations.

## Related

- [Terminals](/guide/terminals) -- How terminals use profiles
- [Batch Launch](/guide/batch-launch) -- Launching multiple terminals from a profile
- [Settings](/guide/settings) -- All configurable options
