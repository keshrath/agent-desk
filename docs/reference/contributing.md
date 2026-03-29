# Contributing

Contributions to Agent Desk are welcome. This guide covers the development setup, code conventions, and contribution workflow.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- npm (included with Node.js)
- Git

### Getting Started

```bash
git clone https://github.com/keshrath/agent-desk.git
cd agent-desk
npm install
npm run build
npm start
```

### Development Workflow

```bash
# Build and launch in one step
npm run dev

# Watch TypeScript for incremental builds
npm run watch

# In another terminal, launch Electron
npm start
```

## Project Structure

```
agent-desk/
├── src/
│   ├── main/           # Electron main process (TypeScript)
│   │   ├── index.ts
│   │   ├── terminal-manager.ts
│   │   ├── system-monitor.ts
│   │   └── crash-reporter.ts
│   ├── preload/        # Context bridge (TypeScript)
│   │   ├── index.ts
│   │   └── webview-bridge.ts
│   └── renderer/       # Frontend (vanilla JS, NOT compiled)
│       ├── index.html
│       ├── styles.css
│       ├── app.js
│       ├── state.js
│       └── ... (20+ modules)
├── dist/               # Compiled TypeScript output
├── resources/          # App icons
├── tests/              # Test files
├── scripts/            # Build scripts
└── docs/               # Documentation (VitePress)
```

## Code Conventions

### TypeScript (main + preload)

- Strict mode enabled
- Compiled to `dist/` via `tsc`
- ES module syntax

### JavaScript (renderer)

- `'use strict'` in all files
- ES module imports/exports
- No framework -- vanilla JS with DOM APIs
- Local vendor libraries in `src/renderer/vendor/`

### CSS

- CSS custom properties for theming
- No preprocessor
- Single `styles.css` file for all styles
- BEM-like class naming

### Linting and Formatting

```bash
# Lint
npx eslint src/

# Format
npx prettier --write "src/**/*.{ts,js,css,html}"

# Check formatting
npx prettier --check "src/**/*.{ts,js,css,html}"
```

## Testing

### Unit Tests (Vitest)

```bash
npm test
# or
npm run test:unit
```

### E2E Tests (Playwright)

```bash
npm run test:e2e
```

E2E tests launch the full Electron app and test user-facing workflows.

## Build Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript + copy vendor libs |
| `npm run dev` | Build + launch Electron |
| `npm run watch` | Watch TypeScript for changes |
| `npm run package` | Build distributable for current platform |
| `npm run package:win` | Build Windows distributable |
| `npm run package:mac` | Build macOS distributable |
| `npm run package:linux` | Build Linux distributable |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier |

## Pull Request Guidelines

1. Fork the repository and create a feature branch
2. Make your changes following the code conventions above
3. Run `npm run build`, `npm run lint`, and `npm test` to ensure everything passes
4. Write a clear PR description explaining what changed and why
5. Include screenshots for UI changes

## Architecture Notes

Before making changes, read the [Architecture](/reference/architecture) page to understand the process model and module dependencies. Key things to keep in mind:

- The renderer uses vanilla JS -- no React/Vue/Svelte
- All Node.js access goes through the preload bridge (`window.agentDesk`)
- xterm.js and dockview are vendored, not imported from node_modules at runtime
- Themes use CSS custom properties -- add new properties to `theme-manager.js`

## License

Agent Desk is released under the [MIT License](https://github.com/keshrath/agent-desk/blob/main/LICENSE).
