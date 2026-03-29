# Workspaces

Workspaces let you save and restore your entire terminal layout -- including the grid arrangement, terminal profiles, working directories, and window titles. This is ideal for quickly switching between different project setups.

## Saving a Workspace

1. Arrange your terminals in the desired layout
2. Press <kbd>Ctrl+Shift+W</kbd> (or Command Palette > "Save Workspace")
3. Enter a name for the workspace (e.g., "dev-setup", "review-team")
4. Click Save

The workspace captures:

- **Terminal list** -- each terminal's profile, command, arguments, working directory, title, and icon
- **Grid layout** -- the exact panel arrangement (splits, sizes, positions)

## Loading a Workspace

1. Press <kbd>Ctrl+Alt+W</kbd> (or Command Palette > "Load Workspace")
2. Select from your saved workspaces
3. Agent Desk recreates all terminals in the saved layout

::: warning
Loading a workspace does not close existing terminals. The saved terminals are added to your current session. If you want a clean start, close all terminals first.
:::

## Workspace Storage

Workspaces are stored in `~/.agent-desk/config.json` under the `workspaces` key. Each workspace includes:

```json
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
  "layout": { /* serialized grid layout */ }
}
```

## Use Cases

### Project Switching

Save a workspace for each project you work on. When switching contexts, load the appropriate workspace to instantly recreate your terminal setup:

- "frontend" -- 2 terminals in the frontend repo, 1 test runner
- "backend" -- 3 terminals for different backend services
- "review" -- 5 Claude agents set up for parallel code review

### Agent Team Configurations

Combine workspaces with [Templates](/guide/batch-launch) for powerful agent orchestration:

1. Create a template for your agent team configuration
2. Launch the template
3. Arrange the terminals as you like
4. Save as a workspace

Next time, just load the workspace instead of relaunching and rearranging.

### Session Recovery

If you need to restart Agent Desk, your workspace saves ensure you can get back to your previous setup quickly. Consider saving your layout periodically during long sessions.

## Related

- [Batch Launch & Templates](/guide/batch-launch) -- Create agent team configurations
- [Terminals](/guide/terminals) -- Terminal grid layout management
- [Settings](/guide/settings) -- Configuration persistence
