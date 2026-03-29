# Shell Integration

Agent Desk supports shell integration via OSC (Operating System Command) escape sequences. When your shell emits these sequences, Agent Desk can track the current working directory, detect command boundaries, and provide enhanced navigation.

## Supported OSC Sequences

| Sequence | Purpose | Description |
|----------|---------|-------------|
| OSC 7 | Current Directory | Reports the shell's working directory |
| OSC 133 A/B/C/D | Command Boundaries | Marks prompt start, command start, output start, and command end |
| OSC 1337 CurrentDir | Current Directory | iTerm2-style directory reporting |
| OSC 1337 SetMark | Scroll Marks | Sets a navigation mark in the terminal |

## What Shell Integration Enables

### Current Directory Tracking

When your shell reports its working directory via OSC 7 or OSC 1337, Agent Desk knows which directory each terminal is in. This information is used for:

- Displaying the current path in the terminal status
- Setting the correct working directory when saving workspaces
- Providing context for agent operations

### Command Boundary Detection

OSC 133 sequences mark the boundaries between commands:

- **A** -- Prompt start (the shell is ready for input)
- **B** -- Command start (the user pressed Enter)
- **C** -- Output start (command output begins)
- **D** -- Command end (with exit code)

This enables features like:

- **Select Last Output** -- select just the output of the most recent command
- **Copy Last Output** -- copy the last command's output to clipboard
- **Exit code tracking** -- know whether the last command succeeded or failed

## Setting Up Shell Integration

### Bash

Add to your `~/.bashrc`:

```bash
# OSC 7 — report current directory
__agent_desk_osc7() {
  printf '\e]7;file://%s%s\e\\' "$HOSTNAME" "$PWD"
}

# OSC 133 — command boundary marks
__agent_desk_prompt() {
  printf '\e]133;D;%s\e\\' "$?"
  printf '\e]133;A\e\\'
}

__agent_desk_preexec() {
  printf '\e]133;C\e\\'
}

PROMPT_COMMAND="__agent_desk_osc7;__agent_desk_prompt;${PROMPT_COMMAND}"
trap '__agent_desk_preexec' DEBUG
```

### Zsh

Add to your `~/.zshrc`:

```zsh
# OSC 7 — report current directory
__agent_desk_osc7() {
  printf '\e]7;file://%s%s\e\\' "$HOST" "$PWD"
}

# OSC 133 — command marks
__agent_desk_precmd() {
  local exit_code=$?
  printf '\e]133;D;%s\e\\' "$exit_code"
  printf '\e]133;A\e\\'
  __agent_desk_osc7
}

__agent_desk_preexec() {
  printf '\e]133;C\e\\'
}

precmd_functions+=(__agent_desk_precmd)
preexec_functions+=(__agent_desk_preexec)
```

### PowerShell

Add to your `$PROFILE`:

```powershell
function prompt {
  $exitCode = $LASTEXITCODE
  # OSC 133 command end + prompt start
  Write-Host -NoNewline "`e]133;D;$exitCode`e\"
  Write-Host -NoNewline "`e]133;A`e\"
  # OSC 7 current directory
  Write-Host -NoNewline "`e]7;file://$env:COMPUTERNAME/$($PWD.Path -replace '\\','/')`e\"
  # Your normal prompt
  return "PS> "
}
```

## Without Shell Integration

Shell integration is entirely optional. Agent Desk works fully without it -- you just won't get directory tracking and command boundary features. All terminal, agent detection, and search features work regardless.

## Related

- [Terminals](/guide/terminals) -- Terminal features overview
- [Search](/guide/search) -- Select/copy last command output
- [Keyboard Shortcuts](/reference/shortcuts) -- Select Last Output, Copy Last Output actions
