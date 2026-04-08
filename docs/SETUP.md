# Setup Guide

Detailed instructions for installing, configuring, and running Agent Desk.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [From npm](#from-npm)
  - [From Source](#from-source)
  - [From GitHub Releases](#from-github-releases)
- [First Run](#first-run)
- [Configuration](#configuration)
  - [Config File](#config-file)
  - [Keybindings](#keybindings)
  - [Crash Logs](#crash-logs)
- [Dashboard Services](#dashboard-services)
- [Shell Integration](#shell-integration)
  - [PowerShell](#powershell)
  - [Bash](#bash)
  - [Zsh](#zsh)
  - [Fish](#fish)
- [Shell Profiles](#shell-profiles)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js >= 22** (LTS recommended)
- **npm >= 10**
- **Git**
- **Python 3** (required by node-gyp for node-pty compilation)
- **C++ build tools**:
  - Windows: Visual Studio Build Tools (`npm install -g windows-build-tools`)
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Linux: `build-essential` (`sudo apt install build-essential`)

```bash
node --version   # v22.0.0 or later
npm --version    # v10 or later
```

---

## Installation

### From npm

```bash
npm install -g agent-desk
agent-desk
```

### From Source

```bash
git clone https://github.com/keshrath/agent-desk.git
cd agent-desk
npm install
npm run build
npm run dev
```

`npm run build` compiles TypeScript and copies vendor libraries (xterm.js, dockview-core) from `node_modules` to `src/renderer/vendor/`.

### From GitHub Releases

Pre-built binaries are available on the [GitHub Releases](https://github.com/keshrath/agent-desk/releases) page:

| Platform | Formats                  | Notes                         |
| -------- | ------------------------ | ----------------------------- |
| Windows  | NSIS installer, Portable | No build tools needed         |
| macOS    | DMG                      | Requires macOS 10.15+         |
| Linux    | AppImage, deb            | AppImage is self-contained    |

Download the appropriate file, run it, and Agent Desk is ready.

### Verify

Launch the app. You should see the main window with a terminal tab and sidebar navigation.

---

## First Run

On first launch, Agent Desk:

1. Creates `~/.agent-desk/` directory for configuration
2. Opens a default terminal with your system shell
3. Checks dashboard service health (agent-comm, agent-tasks, agent-knowledge)
4. Shows sidebar status dots indicating which services are available

To get started with multi-agent workflows:

1. **Ctrl+Shift+C** -- open a Claude Code terminal
2. **Ctrl+Shift+D** -- split right for a second terminal
3. **Ctrl+5** -- open the Agent Monitor to see detected agents
4. **Ctrl+2/3/4** -- view embedded dashboards (requires running services)

---

## Configuration

### Config File

`~/.agent-desk/config.json` stores all settings, profiles, workspaces, and templates. It is created automatically on first run.

```json
{
  "version": 1,
  "settings": {
    "fontSize": 14,
    "fontFamily": "JetBrains Mono, monospace",
    "cursorStyle": "block",
    "cursorBlink": true,
    "scrollback": 5000,
    "lineHeight": 1.2,
    "defaultShell": "",
    "defaultTerminalCwd": "",
    "agentCommUrl": "http://localhost:3421",
    "agentTasksUrl": "http://localhost:3422",
    "agentKnowledgeUrl": "http://localhost:3423",
    "sidebarPosition": "left",
    "closeToTray": false,
    "startOnLogin": false,
    "bellSound": false,
    "bellVisual": true,
    "desktopNotifications": true
  },
  "profiles": [],
  "workspaces": [],
  "templates": []
}
```

Settings are also editable via the Settings panel (**Ctrl+6**). Changes in Settings write to the config file; external edits to the config file trigger a hot-reload in the app.

### Keybindings

`~/.agent-desk/keybindings.json` stores user keybinding overrides. Format:

```json
{
  "Ctrl+Shift+N": "terminal:new",
  "Ctrl+Shift+K": "terminal:close"
}
```

Default keybindings are built into the app. User overrides take precedence. You can also configure keybindings via Settings (**Ctrl+6**) using the capture UI.

### Crash Logs

`~/.agent-desk/crash-logs/` stores structured crash logs with memory snapshots. Logs are automatically rotated (max 10 files). Useful for diagnosing issues.

---

## Dashboard Services

Agent Desk embeds four `agent-*` dashboards as **first-party plugins** loaded into per-view shadow roots. Each dashboard must be running on its port for the respective view to populate.

| Service         | Default URL              | Purpose                       | Install                           |
| --------------- | ------------------------ | ----------------------------- | --------------------------------- |
| agent-comm      | http://localhost:3421    | Agent communication hub       | `npm install -g agent-comm`       |
| agent-tasks     | http://localhost:3422    | Task pipeline management      | `npm install -g agent-tasks`      |
| agent-knowledge | http://localhost:3423    | Cross-machine knowledge base  | `npm install -g agent-knowledge`  |
| agent-discover  | http://localhost:3424    | MCP server registry / market  | `npm install -g agent-discover`   |

Dashboard URLs are configurable in Settings. The sidebar shows colored status dots:

- **Green dot** -- service is healthy and reachable
- **Red dot** -- service is unreachable
- **No dot** -- health check pending

Health checks run every 30 seconds with automatic reconnection when services come back online.

If you are using Agent Desk with Claude Code, the dashboard services typically auto-start when Claude Code connects via MCP.

---

## Shell Integration

Agent Desk supports OSC (Operating System Command) sequences for enhanced shell integration. When your shell emits these sequences, Agent Desk can track:

- **Current working directory** (OSC 7)
- **Command boundaries** (OSC 133) -- mark where commands start/end
- **Custom properties** (OSC 1337) -- e.g., current user, hostname

### PowerShell

Add to your PowerShell profile (`$PROFILE`):

```powershell
function prompt {
    $loc = Get-Location
    $esc = [char]27
    # OSC 7: report CWD
    Write-Host -NoNewline "$esc]7;file://localhost/$($loc.Path.Replace('\','/'))$esc\"
    # OSC 133: command boundary
    Write-Host -NoNewline "$esc]133;A$esc\"
    return "PS $loc> "
}
```

### Bash

Add to `~/.bashrc`:

```bash
__agent_desk_prompt() {
    printf '\e]7;file://localhost%s\e\\' "$PWD"
    printf '\e]133;A\e\\'
}
PROMPT_COMMAND="__agent_desk_prompt;${PROMPT_COMMAND}"
```

### Zsh

Add to `~/.zshrc`:

```zsh
__agent_desk_precmd() {
    printf '\e]7;file://localhost%s\e\\' "$PWD"
    printf '\e]133;A\e\\'
}
precmd_functions+=(__agent_desk_precmd)
```

### Fish

Add to `~/.config/fish/config.fish`:

```fish
function __agent_desk_prompt --on-event fish_prompt
    printf '\e]7;file://localhost%s\e\\' "$PWD"
    printf '\e]133;A\e\\'
end
```

---

## Shell Profiles

Shell profiles let you configure different terminal environments. Two profiles are built in:

- **Default Shell** -- uses your system's default shell
- **Claude Code** -- launches `claude` with appropriate flags

Custom profiles can be created in Settings (**Ctrl+6**) with:

| Field   | Description                                    |
| ------- | ---------------------------------------------- |
| Name    | Display name in menus and tabs                 |
| Command | Shell executable path (e.g., `pwsh`, `bash`)   |
| Args    | Command-line arguments                         |
| Env     | Additional environment variables               |
| CWD     | Working directory                              |
| Icon    | Material Symbols icon name                     |

Profiles are stored in `~/.agent-desk/config.json` and available in the new terminal menu, batch launcher, and templates.

---

## Troubleshooting

### App does not start

- Ensure Node.js 22+ is installed: `node --version`
- Rebuild native modules: `npm rebuild node-pty`
- On Windows, ensure Visual Studio Build Tools are installed

### Terminal does not render

- Check that `npm run build` completed successfully (vendor files must be copied)
- Look for errors in the Electron DevTools console (**Ctrl+Shift+I**)

### Dashboards show "Service unavailable"

- Verify the dashboard service is running: `curl http://localhost:3421/health`
- Check the configured URL in Settings matches the actual service port
- Ensure no firewall is blocking localhost connections

### node-pty build fails

- Windows: Install Visual Studio Build Tools and Python 3
- macOS: Run `xcode-select --install`
- Linux: Install `build-essential` and `python3`
- Then: `npm rebuild node-pty`

### Session restore fails

- The session file at `~/.agent-desk/` may be corrupted
- Delete it and restart -- a fresh session will be created
- Terminal buffers are replayed on restore; very large buffers may take a moment
