# Appearance

Agent Desk offers extensive visual customization with built-in themes, a custom theme editor, and dashboard theme sync.

## Built-in Themes

8 themes ship with Agent Desk:

| Theme | Type | Accent Color |
|-------|------|-------------|
| Default Dark | Dark | #5d8da8 (blue-gray) |
| Dracula | Dark | #bd93f9 (purple) |
| Nord | Dark | #88c0d0 (arctic blue) |
| Gruvbox | Dark | #fe8019 (orange) |
| Default Light | Light | #4a7a96 (blue-gray) |
| Dracula Light | Light | Dracula palette |
| Nord Light | Light | Nord palette |
| Gruvbox Light | Light | Gruvbox palette |

Each theme defines colors for the UI chrome (background, surface, borders, text, accents) and a complete 16-color terminal palette with cursor, selection, and foreground/background colors.

## Custom Theme Editor

Create your own themes in Settings with full control over:

- **UI colors** -- background, surface, surface hover, border, primary, text, text secondary
- **Terminal palette** -- all 16 ANSI colors (normal + bright), cursor, selection, foreground, background

Custom themes are stored in `~/.agent-desk/config.json` alongside built-in themes.

## System Theme Following

Enable "Follow System Theme" to automatically switch between your preferred dark and light themes based on OS appearance settings. Agent Desk watches for system theme changes and switches instantly.

## Dashboard Theme Sync

Embedded dashboards (agent-comm, agent-tasks, agent-knowledge) automatically match the app's active theme. Dashboard injectors sync CSS custom properties into each webview, ensuring a consistent look.

## UI Customization

Beyond themes, you can customize:

- **Sidebar position** -- left or right
- **Status bar** -- show or hide
- **Tab close button** -- hover, always, or never
- **Terminal font** -- family, size, line height
- **Cursor style** -- bar, block, or underline

## Design System

Agent Desk follows Material Design 3 principles:

- **Fonts** -- Inter for UI, JetBrains Mono for terminals
- **Icons** -- Material Symbols Outlined
- **Colors** -- semantic color tokens applied via CSS custom properties
- **Surfaces** -- layered elevation with subtle borders

For the full guide, see [Themes](/guide/themes).
