# Contributing to Agent Desk

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/keshrath/agent-desk.git
   cd agent-desk
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build:
   ```bash
   npm run build
   ```

## Node version

All workspace packages pin Node via the `engines` field:

```json
"engines": { "node": ">=22.0.0 <23.0.0", "npm": ">=10.0.0" }
```

This is critical because agent-desk ships native modules (`better-sqlite3`, `node-pty`) that are compiled against a specific Node ABI. The Electron desktop target bundles its own Node (Electron 35.x), but `@agent-desk/server` runs under system Node and will silently break if contributors use a different major version than the one the prebuilt binaries target.

A `.nvmrc` file at the repo root pins the major version to `22`. Before running `npm install`, switch your shell:

```bash
nvm use        # reads .nvmrc
# or: nvm install 22 && nvm use 22
# or: fnm use / volta pin node@22
```

If you absolutely must install under a different major version, pass `--engine-strict=false` to npm — but expect native module rebuild failures.

## Development Setup

### Prerequisites

- **Node.js 22.x** (enforced via `engines` + `.nvmrc`)
- **npm >= 10**
- **Git**
- **Python 3** (required by node-gyp for native module compilation)
- **C++ build tools** (Visual Studio Build Tools on Windows, Xcode on macOS, `build-essential` on Linux)

### Development Mode

```bash
# Build TypeScript + copy vendor libs, then launch Electron
npm run dev

# Watch TypeScript for changes (recompile on save)
npm run watch

# Package distributable for your platform
npm run package
```

### Build Steps

The project is an **npm workspaces** monorepo. The root `npm run build` script orchestrates all packages in dependency order:

1. `@agent-desk/core` — compiles TypeScript to `packages/core/dist/` (transport-agnostic Node core, no Electron)
2. `@agent-desk/desktop` — compiles TypeScript (`packages/desktop/src/main/` + `packages/desktop/src/preload/`) to `packages/desktop/dist/`
3. `@agent-desk/ui` — typecheck only; the renderer is vanilla JS served directly and is **not** compiled
4. Vendor copy — `scripts/copy-vendor.js` copies xterm.js and dockview-core from `node_modules` to `packages/ui/src/renderer/vendor/` (gitignored)
5. `@agent-desk/server` — compiles TypeScript to `packages/server/dist/` (Node Express+ws server for the web/PWA target)

## Project Structure

```
agent-desk/
  packages/
    core/                       @agent-desk/core — transport-agnostic Node (TypeScript)
      src/                        Terminal manager, system monitor, config, sessions,
                                  plugin system, crash reporter, transport router
      dist/                       Build output
    desktop/                    @agent-desk/desktop — Electron shell (TypeScript)
      src/
        main/                     App entry, window management, tray, IPC handlers,
                                  pop-out windows, auto-updater
        preload/                  Context bridge exposing window.agentDesk API
      dist/                       Build output
    ui/                         @agent-desk/ui — renderer (vanilla JS, zero Electron deps)
      src/
        renderer/                 Frontend served directly
          index.html                Main HTML with local vendor imports
          app.js                    Entry point, session restore, global listeners
          state.js                  Shared state and registry
          event-bus.js              Pub/sub event system
          terminals.js              Terminal creation, tabs, status tracking
          layout.js                 Dockview grid management
          views.js                  Sidebar, view switching
          commands.js               Command palette, quick switcher
          context-menus.js          Context menu definitions
          keybinding-manager.js     Customizable keyboard shortcuts
          keybinds.js               Shortcut registration
          settings.js               Settings panel
          workspaces.js             Project-centric workspace CRUD
          workspace-switcher.js     Titlebar workspace dropdown
          git-sidebar.js            Read-only git repo tree (incl. submodules)
          diff-viewer.js            Shiki-highlighted diff overlay
          agent-parser.js           Claude Code / OpenCode / Aider output parser
          agent-features.js         Terminal chains
          batch-launcher.js         Batch launch modal
          templates.js              Agent templates/recipes CRUD
          comm-graph.js             Communication graph canvas
          global-search.js          Cross-terminal search
          event-stream.js           Event timeline panel
          search.js                 In-terminal search bar
          theme-manager.js          Theme system
          theme-init.js             Early theme application
          workspaces.js             Workspace save/load
          system-monitor.js         Status bar widgets, cost tracking
          shell-integration.js      OSC sequence parser
          plugin-loader.js          Plugin discovery/load glue
          dashboard-injectors/      Per-dashboard toolbar injection
          styles.css                MD3 dark theme + component styles
          vendor/                   Local xterm.js + dockview-core (gitignored)
        web-entry.js              Web/PWA entry point (talks to @agent-desk/server over WS)
    server/                     @agent-desk/server — Node Express+ws (TypeScript)
      src/                        WebSocket transport, single-user token auth
      dist/                       Build output
    pwa/                        @agent-desk/pwa — mobile PWA entry
  tests/
    unit/                       Unit tests (vitest)
      agent-parser.test.ts        Agent output parser tests
      ipc-security.test.ts        IPC security validation
      status-patterns.test.ts     Status pattern detection
      terminal-manager.test.ts    Terminal manager tests
    e2e/                        E2E tests (Playwright)
      app-launch.spec.ts          App launch and window creation
      terminal.spec.ts            Terminal creation and interaction
      settings.spec.ts            Settings panel
      themes.spec.ts              Theme switching
      ... (22 spec files)
  scripts/
    copy-vendor.js              Copies vendor libs from node_modules
  resources/
    icon.ico                    Windows icon
    icon.png                    Linux icon
    icon.svg                    Source SVG icon
```

## Code Style

- **TypeScript** for `@agent-desk/core`, `@agent-desk/desktop` (main + preload), and `@agent-desk/server`
- **Vanilla JavaScript** for `@agent-desk/ui` (`packages/ui/src/renderer/`) -- no React, Vue, or other frameworks
- **ESLint + Prettier** enforced via lint-staged (husky pre-commit hook)
- **Naming**: `camelCase` for functions/variables, `PascalCase` for classes, `UPPER_SNAKE` for constants
- **Imports**: ES modules throughout
- **No CDN dependencies** -- vendor libraries are bundled locally

### Formatting

```bash
npx prettier --check .          # Check formatting
npx prettier --write .          # Fix formatting
npx eslint packages/*/src       # Lint
npx eslint packages/*/src --fix # Lint with auto-fix
```

## Testing

### Unit Tests (vitest)

```bash
npm test                        # Run all unit tests
npm run test:unit               # Same as above
```

Unit tests cover the main process logic (agent parser, terminal manager, IPC security, status patterns). Tests use **vitest** and run without Electron.

### E2E Tests (Playwright)

```bash
npm run test:e2e                # Run E2E tests
npx playwright test             # Same as above
```

E2E tests launch the full Electron app and test UI interactions including terminal creation, settings, themes, dashboard integration, keybindings, and more. There are 22 spec files covering all major features.

### What to Test

- **Main process**: terminal lifecycle, IPC handlers, config management, crash reporting
- **Preload**: API exposure, input validation
- **Renderer**: UI interactions, state management, keyboard shortcuts
- **Integration**: dashboard bridge, agent detection, session persistence

## Pull Requests

1. Fork the repository
2. Create a feature branch from `main`
3. Ensure all checks pass:
   ```bash
   npm run build
   npx prettier --check .
   npx eslint packages/*/src
   npm test
   ```
4. Write or update tests for your changes
5. Keep commits focused -- one logical change per commit

### PR checklist

- [ ] `npm run build` compiles cleanly
- [ ] `npx prettier --check .` passes
- [ ] `npx eslint packages/*/src` passes
- [ ] `npm test` passes
- [ ] New features have tests
- [ ] No framework dependencies added to renderer

## Commit Messages

Format: `vX.Y.Z: short description`

Bump the patch version in `package.json` before committing. No Co-Authored-By or AI branding.

## License

MIT
