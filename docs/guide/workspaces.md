# Workspaces

**A workspace is a folder.** It can contain zero, one, or many git repositories — and each of those git repos can have submodules nested arbitrarily deep. Opening a workspace points Agent Desk at that folder: the git sidebar discovers every repo inside (including recursive submodules), and terminals spawn rooted at the workspace path with the configured environment variables and AI agents.

Workspaces also remember:

- A **color** from a 24-hue palette (shows on the titlebar tab and switcher row)
- A list of **AI agents** to spawn on open (Claude Code, OpenCode, Aider, custom profiles, ...)
- Per-workspace **environment variables** that are merged into every terminal spawned for that workspace
- A **pinned** flag that surfaces the workspace at the top of the switcher
- The saved **terminal layout** (grid positions, sizes, titles, commands) so you get the same panel arrangement back on reopen

## Saving a Workspace

1. Press <kbd>Ctrl+Shift+W</kbd> (or Command Palette → "Save Workspace")
2. Fill in the multi-field form:
   - **Name** — a short label, e.g. `api-server` or `agent-desk`
   - **Root path** — click **Browse** to pick a folder, or paste an absolute path. This is the workspace's root folder.
   - **Color** — click a swatch from the 24-color palette
   - **Environment variables** — click **+** to add `KEY=VALUE` rows; these are scoped to terminals spawned from this workspace only, they don't mutate the app's own process env
   - **Agents** — multi-select from your available shell profiles
   - **Pin** — toggle to surface this workspace at the top of the switcher
3. Click **Save**

## Opening a Workspace

Three ways:

- **Workspace switcher** in the titlebar — click the dropdown, then click any pinned or recent workspace row
- **Keyboard**: <kbd>Ctrl+Alt+W</kbd> opens a picker
- **Programmatically**: `window.agentDesk.workspace.open(id)` (useful from plugins / keybindings)

Opening a workspace does three things in order:

1. **Resolves the root path** as the active workspace root
2. **Spawns terminals** — one per configured agent, each rooted at the workspace root with the merged environment
3. **Fires a `workspace-opened` event** that the git sidebar listens to; the sidebar then runs `git:discover` on the root and populates its repo tree

## The git sidebar and submodules

When a workspace opens, the git sidebar scans the workspace's root folder and shows one of three layouts:

### Case 1: The root folder IS a git repo

You get one top-level repo node. If it has submodules, they appear nested underneath at their correct depth. Submodules can contain submodules, up to any depth — the tree recurses.

```
.claude (main)
├── apps/agent-desk (release/v1.6.0) [sub]
│   ├── packages/core/... files
│   └── mcp-servers/agent-common (main) [sub]
├── mcp-servers/agent-comm (main) [sub]
├── mcp-servers/agent-knowledge (main) [sub]
└── mcp-servers/agent-tasks (main) [sub]
```

### Case 2: The root folder is a plain directory with git repos inside

You get each direct child repo as a top-level sibling node (plus their own submodule subtrees). Node_modules, `dist`, `build`, and hidden directories are skipped.

```
projects/ (workspace root — not a git repo)
├── frontend (main)
│   ├── files
│   └── libs/shared (dev) [sub]
├── backend (develop)
│   └── files
└── infrastructure (main)
    └── terraform/modules/... [sub]
```

### Case 3: No git repos found

The sidebar shows "No git repositories found in this workspace." — you can still use the workspace for terminals, themes, etc.

### Clicking a file

Clicking a file row dispatches a `diff:open` event whose `root` is the **owning repo's** root path, not the workspace root. Files inside submodules route their diffs through the submodule's own git client — so you see real content diffs, not the useless "submodule commit bumped" delta.

## Migration from v1.5 and earlier

Older versions stored workspaces as layout-only records `{ terminals, layout }` keyed by name. On first read under v1.6+, every legacy record is automatically wrapped into the new shape: you get a fresh UUID, defaults for the new fields (empty root path, indigo color, no env vars, empty agents list, unpinned), and the original terminal list + layout are preserved. No user action required.

You can enrich older workspaces by opening the Save dialog for them and filling in the new fields.

## Config layout

Workspaces live in `~/.agent-desk/config.json` under `workspaces`, keyed by UUID:

```json
{
  "version": 2,
  "workspaces": {
    "11111111-1111-1111-1111-111111111111": {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "agent-desk",
      "rootPath": "/home/mathi/.claude/apps/agent-desk",
      "color": "#6366f1",
      "env": { "NODE_ENV": "development" },
      "agents": ["claude-code", "default-shell"],
      "pinned": true,
      "lastOpened": 1712847600000,
      "terminals": [],
      "layout": null
    }
  }
}
```

`id` is stable across renames; the map key always matches `id`. `lastOpened` is bumped on every open and drives the "recent workspaces" ordering in the switcher.

## Use cases

### Project switching

Save a workspace per project. When switching contexts, click the switcher: the git sidebar re-discovers the repo tree for the new root, terminals close and respawn, environment variables apply. Instant context switch.

### Meta-repo / multi-repo workflows

If you have a folder that contains several top-level git repos side by side (e.g. `~/work` with `frontend/`, `backend/`, `infrastructure/`), save it as one workspace. The sidebar shows all three repos at once.

### Submodule-heavy repos

For repos with deeply nested submodules (like `~/.claude` itself), the sidebar shows the entire submodule tree — you can see which submodule is on which branch, drill in to see their file changes, and click any file to open its diff through the correct submodule git client.

## Related

- [Batch Launch & Templates](/guide/batch-launch) — spawn N agents at once for a workspace
- [Terminals](/guide/terminals) — grid layout management
- [Settings](/guide/settings) — configuration persistence
