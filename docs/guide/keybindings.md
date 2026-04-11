# Keybindings

Every keyboard shortcut in Agent Desk is customizable. The keybinding system supports standard key combos (Ctrl, Shift, Alt, plus a key) and persists your overrides to `~/.agent-desk/keybindings.json`.

## Default Shortcuts

### Terminals

| Action | Shortcut | Description |
|--------|----------|-------------|
| New Terminal | <kbd>Ctrl+Shift+T</kbd> | Create terminal from default profile |
| New Agent Session | <kbd>Ctrl+Shift+C</kbd> | Create terminal from first agent profile |
| Close Terminal | <kbd>Ctrl+W</kbd> | Close the active terminal |
| Next Terminal | <kbd>Ctrl+Tab</kbd> | Cycle to next terminal |
| Previous Terminal | <kbd>Ctrl+Shift+Tab</kbd> | Cycle to previous terminal |
| Split Right | <kbd>Ctrl+Shift+D</kbd> | Split active terminal right |
| Split Right (Alt) | <kbd>Ctrl+\\</kbd> | Alternative split right |
| Split Down | <kbd>Ctrl+Shift+E</kbd> | Split active terminal down |
| Toggle Maximize | <kbd>Ctrl+Shift+M</kbd> | Maximize/restore active terminal |
| Save Output | <kbd>Ctrl+Shift+S</kbd> | Save terminal buffer to file |
| Terminal Search | <kbd>Ctrl+F</kbd> | Search within active terminal |
| Search All Terminals | <kbd>Ctrl+Shift+F</kbd> | Global cross-terminal search |

### Navigation

| Action | Shortcut | Description |
|--------|----------|-------------|
| Focus Left | <kbd>Alt+Left</kbd> | Focus terminal to the left |
| Focus Right | <kbd>Alt+Right</kbd> | Focus terminal to the right |
| Focus Up | <kbd>Alt+Up</kbd> | Focus terminal above |
| Focus Down | <kbd>Alt+Down</kbd> | Focus terminal below |

### Views

| Action | Shortcut | Description |
|--------|----------|-------------|
| Terminals | <kbd>Ctrl+1</kbd> | Switch to Terminals view |
| Agent Comm | <kbd>Ctrl+2</kbd> | Switch to Comm dashboard |
| Agent Tasks | <kbd>Ctrl+3</kbd> | Switch to Tasks dashboard |
| Agent Knowledge | <kbd>Ctrl+4</kbd> | Switch to Knowledge dashboard |
| Agent Discover | <kbd>Ctrl+5</kbd> | Switch to Discover dashboard |
| Event Stream | <kbd>Ctrl+6</kbd> | Switch to Event Stream |
| Settings | <kbd>Ctrl+7</kbd> | Switch to Settings |

### General

| Action | Shortcut | Description |
|--------|----------|-------------|
| Command Palette | <kbd>Ctrl+Shift+P</kbd> | Open the command palette |
| Quick Switcher | <kbd>Ctrl+P</kbd> | Quick-switch to any terminal by name |
| Show Shortcuts | <kbd>F1</kbd> | Display keyboard shortcuts overlay |
| Event Stream | <kbd>Ctrl+E</kbd> | Toggle event stream view |
| Batch Launch | <kbd>Ctrl+Shift+B</kbd> | Open batch agent launcher |

### Workspace

| Action | Shortcut | Description |
|--------|----------|-------------|
| Save Workspace | <kbd>Ctrl+Shift+W</kbd> | Save current terminal layout |
| Load Workspace | <kbd>Ctrl+Alt+W</kbd> | Load a saved workspace |

## Customizing Shortcuts

### Via Settings UI

1. Open Settings (<kbd>Ctrl+7</kbd>)
2. Scroll to the **Keybindings** section
3. Find the shortcut you want to change
4. Click the key combo to enter capture mode
5. Press your desired key combination
6. The new binding is saved automatically

Press <kbd>Escape</kbd> during capture to cancel.

### Via Config File

Edit `~/.agent-desk/keybindings.json` directly:

```json
{
  "terminal.new": "Ctrl+N",
  "terminal.close": "Ctrl+Shift+W",
  "general.commandPalette": "F2"
}
```

Each key is a binding ID and the value is a key combo string. Only overrides need to be listed -- anything not in the file uses the default binding.

### Binding IDs

| ID | Default |
|----|---------|
| `terminal.new` | Ctrl+Shift+T |
| `terminal.newAgent` | Ctrl+Shift+C |
| `terminal.close` | Ctrl+W |
| `terminal.next` | Ctrl+Tab |
| `terminal.prev` | Ctrl+Shift+Tab |
| `terminal.splitRight` | Ctrl+Shift+D |
| `terminal.splitRightAlt` | Ctrl+\\ |
| `terminal.splitDown` | Ctrl+Shift+E |
| `terminal.maximize` | Ctrl+Shift+M |
| `terminal.saveOutput` | Ctrl+Shift+S |
| `terminal.search` | Ctrl+F |
| `terminal.globalSearch` | Ctrl+Shift+F |
| `terminal.selectLastOutput` | *(unbound)* |
| `terminal.copyLastOutput` | *(unbound)* |
| `focus.left` | Alt+ArrowLeft |
| `focus.right` | Alt+ArrowRight |
| `focus.up` | Alt+ArrowUp |
| `focus.down` | Alt+ArrowDown |
| `view.terminals` | Ctrl+1 |
| `view.comm` | Ctrl+2 |
| `view.tasks` | Ctrl+3 |
| `view.knowledge` | Ctrl+4 |
| `view.discover` | Ctrl+5 |
| `view.events` | Ctrl+6 |
| `view.settings` | Ctrl+7 |
| `general.commandPalette` | Ctrl+Shift+P |
| `general.quickSwitcher` | Ctrl+P |
| `general.shortcuts` | F1 |
| `general.eventStream` | Ctrl+E |
| `general.batchLaunch` | Ctrl+Shift+B |
| `workspace.save` | Ctrl+Shift+W |
| `workspace.load` | Ctrl+Alt+W |

### Resetting Bindings

In the Settings UI, each binding has a reset button to restore it to the default. You can also reset all bindings at once.

To reset via the config file, simply delete `~/.agent-desk/keybindings.json` or remove the specific key from the file.

## Key Combo Format

Key combos are written as modifier keys joined by `+` followed by the key name:

- Modifiers: `Ctrl`, `Shift`, `Alt`, `Meta` (Cmd on macOS)
- Keys: single characters (uppercase), `Tab`, `Enter`, `Escape`, `Space`, `Backspace`, `Delete`, `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Home`, `End`, `PageUp`, `PageDown`, `F1`-`F12`

Examples: `Ctrl+Shift+T`, `Alt+ArrowLeft`, `F1`, `Ctrl+\\`

## Related

- [Keyboard Shortcuts Reference](/reference/shortcuts) -- Quick-reference table
- [Settings](/guide/settings) -- Settings panel overview
