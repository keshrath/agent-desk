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

## Development Setup

### Prerequisites

- **Node.js >= 22** (LTS recommended)
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

`npm run build` does two things:

1. Compiles TypeScript in `src/main/` and `src/preload/` to `dist/`
2. Runs `scripts/copy-vendor.js` to copy xterm.js and dockview-core from `node_modules` to `src/renderer/vendor/` (gitignored)

The renderer (`src/renderer/`) is vanilla JS served directly -- it is **not** compiled.

## Project Structure

```
agent-desk/
  src/
    main/                       Electron main process (TypeScript)
      index.ts                    App entry, window management, tray, IPC handlers
      terminal-manager.ts         node-pty terminal lifecycle, buffer capture
      system-monitor.ts           CPU/RAM/disk polling
      crash-reporter.ts           Crash log writer with rotation
    preload/                    Context bridge (TypeScript)
      index.ts                    Exposes window.agentDesk API to renderer
      webview-bridge.ts           Preload script for dashboard webviews
    renderer/                   Frontend (vanilla JS, served directly)
      index.html                  Main HTML with local vendor imports
      app.js                      Entry point, session restore, global listeners
      state.js                    Shared state and registry
      event-bus.js                Pub/sub event system
      terminals.js                Terminal creation, tabs, status tracking
      layout.js                   Dockview grid management
      views.js                    Sidebar, view switching
      commands.js                 Command palette, quick switcher, context menu
      keybinding-manager.js       Customizable keyboard shortcuts
      keybinds.js                 Shortcut registration
      settings.js                 Settings panel (40+ options)
      agent-monitor.js            Agent Monitor view (Ctrl+5)
      agent-parser.js             Claude Code output parser
      agent-features.js           Terminal chains
      batch-launcher.js           Batch launch modal
      templates.js                Agent templates/recipes CRUD
      comm-graph.js               Communication graph canvas
      global-search.js            Cross-terminal search
      event-stream.js             Event timeline panel
      search.js                   In-terminal search bar
      theme-manager.js            Theme system (4 built-in + custom)
      theme-init.js               Early theme application
      workspaces.js               Workspace save/load
      system-monitor.js           Status bar widgets, cost tracking
      shell-integration.js        OSC sequence parser
      dashboard.js                Dashboard bridge module
      dashboard-injectors/        Per-dashboard toolbar injection
      styles.css                  MD3 dark theme + all component styles
      vendor/                     Local xterm.js + dockview-core (gitignored)
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

- **TypeScript** for main process and preload (`src/main/`, `src/preload/`)
- **Vanilla JavaScript** for renderer (`src/renderer/`) -- no React, Vue, or other frameworks
- **ESLint + Prettier** enforced via lint-staged (husky pre-commit hook)
- **Naming**: `camelCase` for functions/variables, `PascalCase` for classes, `UPPER_SNAKE` for constants
- **Imports**: ES modules throughout
- **No CDN dependencies** -- vendor libraries are bundled locally

### Formatting

```bash
npx prettier --check .          # Check formatting
npx prettier --write .          # Fix formatting
npx eslint src/                 # Lint
npx eslint src/ --fix           # Lint with auto-fix
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
   npx eslint src/
   npm test
   ```
4. Write or update tests for your changes
5. Keep commits focused -- one logical change per commit

### PR checklist

- [ ] `npm run build` compiles cleanly
- [ ] `npx prettier --check .` passes
- [ ] `npx eslint src/` passes
- [ ] `npm test` passes
- [ ] New features have tests
- [ ] No framework dependencies added to renderer

## Commit Messages

Format: `vX.Y.Z: short description`

Bump the patch version in `package.json` before committing. No Co-Authored-By or AI branding.

## License

MIT
