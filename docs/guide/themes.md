# Themes

Agent Desk includes 8 built-in themes and a custom theme editor. Themes control the entire application appearance including the UI chrome, terminal colors, and embedded dashboard styling.

## Built-in Themes

### Dark Themes

| Theme | Description |
|-------|-------------|
| **Default Dark** | Agent Desk's signature dark theme with blue-gray accents (#5d8da8) |
| **Dracula** | The popular Dracula color scheme with purple accents |
| **Nord** | Arctic blue-gray palette inspired by the Nord theme |
| **Gruvbox** | Warm, retro-inspired colors with orange accents |

### Light Themes

| Theme | Description |
|-------|-------------|
| **Default Light** | Clean light theme matching the dark default's color language |
| **Dracula Light** | Light variant of the Dracula palette |
| **Nord Light** | Light variant of the Nord palette |
| **Gruvbox Light** | Light variant of the Gruvbox palette |

![Dark Theme](/screenshots/dark-theme.png)

![Light Theme](/screenshots/light-theme.png)

## Changing Themes

1. Open Settings (<kbd>Ctrl+6</kbd>)
2. In the **Appearance** section, select a theme from the dropdown
3. The theme is applied immediately

You can also set separate preferred themes for dark and light modes when using system theme following.

## System Theme Following

Enable "Follow System Theme" in Settings to automatically switch between your preferred dark and light themes based on your operating system's appearance setting.

When enabled, Agent Desk watches for system theme changes and switches instantly.

## Custom Themes

The custom theme editor lets you create your own themes with full control over every color:

### Creating a Custom Theme

1. Open Settings (<kbd>Ctrl+6</kbd>)
2. Scroll to the **Themes** section
3. Click **Create Theme**
4. Configure colors for:
   - **Background** -- main application background
   - **Surface** -- panel and card backgrounds
   - **Surface Hover** -- hover state for surfaces
   - **Border** -- divider and border colors
   - **Primary/Accent** -- brand color used for active states and highlights
   - **Text** -- primary and secondary text colors
   - **Terminal colors** -- all 16 ANSI colors plus cursor, selection, foreground, and background

![Theme Settings](/screenshots/settings-themes.png)

### Terminal Color Palette

Each theme defines a complete terminal color palette:

| Color | Normal | Bright |
|-------|--------|--------|
| Black | background variant | muted gray |
| Red | error/danger | lighter red |
| Green | success | lighter green |
| Yellow | warning | lighter yellow |
| Blue | accent/info | lighter blue |
| Magenta | decorative | lighter magenta |
| Cyan | secondary accent | lighter cyan |
| White | text | bright white |

Plus cursor color, cursor accent, selection background, and the default foreground/background.

### Theme Storage

Custom themes are stored in `~/.agent-desk/config.json` and cached in localStorage. They persist across app restarts and can be exported/imported as part of the config file.

## Dashboard Theme Sync

When you change the application theme, embedded dashboards (agent-comm, agent-tasks, agent-knowledge) are automatically notified of the theme change. The dashboard injectors sync the theme's CSS custom properties into each webview so the dashboards match the app's appearance.

## Related

- [Settings](/guide/settings) -- All appearance options
- [Dashboard Services](/guide/dashboards) -- Dashboard theme sync details
