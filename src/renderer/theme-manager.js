// theme-manager.js — Custom theme system for agent-desk
// Manages built-in and custom themes, persistence

'use strict';

const CUSTOM_THEMES_KEY = 'agent-desk-custom-themes';

// -----------------------------------------------------------------------------
// Built-in Themes (default-dark, default-light, dracula, nord)
// -----------------------------------------------------------------------------

const BUILTIN_THEMES = [
  {
    id: 'default-dark',
    name: 'Default Dark',
    type: 'dark',
    builtin: true,
    colors: {
      background: '#1a1d23',
      surface: '#21252b',
      surfaceHover: '#282c34',
      border: '#2d3139',
      primary: '#5d8da8',
      onPrimary: '#ffffff',
      text: '#c8d1da',
      textSecondary: '#6b7785',
      accent: '#5d8da8',
      accentHover: '#6b9db8',
      terminal: {
        background: '#1a1d23',
        foreground: '#c8d1da',
        cursor: '#5d8da8',
        cursorAccent: '#1a1d23',
        selectionBackground: 'rgba(93, 141, 168, 0.3)',
        black: '#1a1d23',
        red: '#d45050',
        green: '#4caf50',
        yellow: '#ff9800',
        blue: '#5d8da8',
        magenta: '#b07cc8',
        cyan: '#56b6c2',
        white: '#c8d1da',
        brightBlack: '#6b7785',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#e5c07b',
        brightBlue: '#6ba4c0',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff',
      },
    },
  },
  {
    id: 'default-light',
    name: 'Default Light',
    type: 'light',
    builtin: true,
    colors: {
      background: '#e8ecf0',
      surface: '#f0f2f5',
      surfaceHover: '#dce1e7',
      border: '#c5cdd5',
      primary: '#4a7a96',
      onPrimary: '#ffffff',
      text: '#2c3e50',
      textSecondary: '#4a5a6a',
      accent: '#4a7a96',
      accentHover: '#5d8da8',
      terminal: {
        background: '#fafafa',
        foreground: '#383a42',
        cursor: '#526eff',
        cursorAccent: '#fafafa',
        selectionBackground: 'rgba(56, 58, 66, 0.15)',
        black: '#383a42',
        red: '#e45649',
        green: '#50a14f',
        yellow: '#c18401',
        blue: '#4078f2',
        magenta: '#a626a4',
        cyan: '#0184bc',
        white: '#a0a1a7',
        brightBlack: '#4f525e',
        brightRed: '#e06c75',
        brightGreen: '#50a14f',
        brightYellow: '#986801',
        brightBlue: '#4078f2',
        brightMagenta: '#a626a4',
        brightCyan: '#0184bc',
        brightWhite: '#9da5b4',
      },
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    type: 'dark',
    builtin: true,
    colors: {
      background: '#282a36',
      surface: '#383a4e',
      surfaceHover: '#44475a',
      border: '#44475a',
      primary: '#bd93f9',
      onPrimary: '#282a36',
      text: '#f8f8f2',
      textSecondary: '#6272a4',
      accent: '#bd93f9',
      accentHover: '#caa8ff',
      terminal: {
        background: '#282a36',
        foreground: '#f8f8f2',
        cursor: '#f8f8f2',
        cursorAccent: '#282a36',
        selectionBackground: '#44475a88',
        black: '#21222c',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff',
      },
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    type: 'dark',
    builtin: true,
    colors: {
      background: '#2e3440',
      surface: '#3b4252',
      surfaceHover: '#434c5e',
      border: '#434c5e',
      primary: '#88c0d0',
      onPrimary: '#2e3440',
      text: '#d8dee9',
      textSecondary: '#7b88a1',
      accent: '#88c0d0',
      accentHover: '#8fbcbb',
      terminal: {
        background: '#2e3440',
        foreground: '#d8dee9',
        cursor: '#d8dee9',
        cursorAccent: '#2e3440',
        selectionBackground: '#434c5ecc',
        black: '#3b4252',
        red: '#bf616a',
        green: '#a3be8c',
        yellow: '#ebcb8b',
        blue: '#81a1c1',
        magenta: '#b48ead',
        cyan: '#88c0d0',
        white: '#e5e9f0',
        brightBlack: '#4c566a',
        brightRed: '#bf616a',
        brightGreen: '#a3be8c',
        brightYellow: '#ebcb8b',
        brightBlue: '#81a1c1',
        brightMagenta: '#b48ead',
        brightCyan: '#8fbcbb',
        brightWhite: '#eceff4',
      },
    },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox',
    type: 'dark',
    builtin: true,
    colors: {
      background: '#282828',
      surface: '#3c3836',
      surfaceHover: '#464240',
      border: '#504945',
      primary: '#fe8019',
      onPrimary: '#282828',
      text: '#ebdbb2',
      textSecondary: '#a89984',
      accent: '#fe8019',
      accentHover: '#ff9633',
      terminal: {
        background: '#282828',
        foreground: '#ebdbb2',
        cursor: '#fe8019',
        cursorAccent: '#282828',
        selectionBackground: 'rgba(254, 128, 25, 0.3)',
        black: '#3c3836',
        red: '#fb4934',
        green: '#b8bb26',
        yellow: '#fabd2f',
        blue: '#83a598',
        magenta: '#d3869b',
        cyan: '#8ec07c',
        white: '#ebdbb2',
        brightBlack: '#504945',
        brightRed: '#fb4934',
        brightGreen: '#b8bb26',
        brightYellow: '#fabd2f',
        brightBlue: '#83a598',
        brightMagenta: '#d3869b',
        brightCyan: '#8ec07c',
        brightWhite: '#fbf1c7',
      },
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized',
    type: 'light',
    builtin: true,
    colors: {
      background: '#fdf6e3',
      surface: '#eee8d5',
      surfaceHover: '#e6dfca',
      border: '#eee8d5',
      primary: '#268bd2',
      onPrimary: '#fdf6e3',
      text: '#657b83',
      textSecondary: '#93a1a1',
      accent: '#268bd2',
      accentHover: '#2e9ee6',
      terminal: {
        background: '#fdf6e3',
        foreground: '#657b83',
        cursor: '#268bd2',
        cursorAccent: '#fdf6e3',
        selectionBackground: 'rgba(38, 139, 210, 0.2)',
        black: '#073642',
        red: '#dc322f',
        green: '#859900',
        yellow: '#b58900',
        blue: '#268bd2',
        magenta: '#d33682',
        cyan: '#2aa198',
        white: '#eee8d5',
        brightBlack: '#586e75',
        brightRed: '#cb4b16',
        brightGreen: '#859900',
        brightYellow: '#b58900',
        brightBlue: '#268bd2',
        brightMagenta: '#6c71c4',
        brightCyan: '#2aa198',
        brightWhite: '#fdf6e3',
      },
    },
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin',
    type: 'light',
    builtin: true,
    colors: {
      background: '#eff1f5',
      surface: '#e6e9ef',
      surfaceHover: '#dce0e8',
      border: '#ccd0da',
      primary: '#8839ef',
      onPrimary: '#eff1f5',
      text: '#4c4f69',
      textSecondary: '#9ca0b0',
      accent: '#8839ef',
      accentHover: '#9a4fff',
      terminal: {
        background: '#eff1f5',
        foreground: '#4c4f69',
        cursor: '#8839ef',
        cursorAccent: '#eff1f5',
        selectionBackground: 'rgba(136, 57, 239, 0.2)',
        black: '#5c5f77',
        red: '#d20f39',
        green: '#40a02b',
        yellow: '#df8e1d',
        blue: '#1e66f5',
        magenta: '#ea76cb',
        cyan: '#179299',
        white: '#4c4f69',
        brightBlack: '#6c6f85',
        brightRed: '#d20f39',
        brightGreen: '#40a02b',
        brightYellow: '#df8e1d',
        brightBlue: '#1e66f5',
        brightMagenta: '#ea76cb',
        brightCyan: '#179299',
        brightWhite: '#4c4f69',
      },
    },
  },
  {
    id: 'github-light',
    name: 'GitHub',
    type: 'light',
    builtin: true,
    colors: {
      background: '#ffffff',
      surface: '#f6f8fa',
      surfaceHover: '#eaeef2',
      border: '#d0d7de',
      primary: '#0969da',
      onPrimary: '#ffffff',
      text: '#24292f',
      textSecondary: '#57606a',
      accent: '#0969da',
      accentHover: '#0550ae',
      terminal: {
        background: '#ffffff',
        foreground: '#24292f',
        cursor: '#0969da',
        cursorAccent: '#ffffff',
        selectionBackground: 'rgba(9, 105, 218, 0.2)',
        black: '#24292f',
        red: '#cf222e',
        green: '#1a7f37',
        yellow: '#9a6700',
        blue: '#0969da',
        magenta: '#8250df',
        cyan: '#1b7c83',
        white: '#f6f8fa',
        brightBlack: '#57606a',
        brightRed: '#a40e26',
        brightGreen: '#116329',
        brightYellow: '#7d4e00',
        brightBlue: '#0550ae',
        brightMagenta: '#6639ba',
        brightCyan: '#1b7c83',
        brightWhite: '#ffffff',
      },
    },
  },
];

// -----------------------------------------------------------------------------
// Storage
// -----------------------------------------------------------------------------

function _loadCustomThemes() {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function _saveCustomThemes(themes) {
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

function getAllThemes() {
  return [...BUILTIN_THEMES, ..._loadCustomThemes()];
}

// eslint-disable-next-line no-unused-vars
function getThemeById(id) {
  if (!id) return BUILTIN_THEMES[0];
  const all = getAllThemes();
  return all.find((t) => t.id === id) || BUILTIN_THEMES[0];
}

// eslint-disable-next-line no-unused-vars
function saveCustomTheme(theme) {
  const customs = _loadCustomThemes();
  const idx = customs.findIndex((t) => t.id === theme.id);
  const entry = { ...theme, builtin: false };
  if (idx >= 0) {
    customs[idx] = entry;
  } else {
    customs.push(entry);
  }
  _saveCustomThemes(customs);
  window.dispatchEvent(new CustomEvent('themes-changed'));
}

// eslint-disable-next-line no-unused-vars
function deleteCustomTheme(id) {
  const customs = _loadCustomThemes();
  _saveCustomThemes(customs.filter((t) => t.id !== id));
  window.dispatchEvent(new CustomEvent('themes-changed'));
}

// -----------------------------------------------------------------------------
// Apply theme to CSS custom properties
// -----------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
function applyThemeColors(theme) {
  if (!theme || !theme.colors) return;
  const c = theme.colors;
  const root = document.documentElement;

  root.setAttribute('data-theme', theme.type || 'dark');

  // Override CSS custom properties (agent-desk internal)
  root.style.setProperty('--bg', c.background);
  root.style.setProperty('--surface', c.surface);
  root.style.setProperty('--surface-hover', c.surfaceHover || c.surface);
  root.style.setProperty('--border', c.border);
  root.style.setProperty('--text', c.text);
  root.style.setProperty('--text-muted', c.textSecondary);
  root.style.setProperty('--text-dim', c.textSecondary);
  root.style.setProperty('--accent', c.accent || c.primary);
  root.style.setProperty('--accent-hover', c.accentHover || c.accent || c.primary);
  // accent-dim must be a transparent version of accent, not a solid color
  const accentColor = c.accent || c.primary;
  const r = parseInt(accentColor.slice(1, 3), 16);
  const g = parseInt(accentColor.slice(3, 5), 16);
  const b = parseInt(accentColor.slice(5, 7), 16);
  root.style.setProperty('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.15)`);

  // Standard plugin contract variables (derived from theme colors)
  root.style.setProperty('--bg-surface', c.surface);
  root.style.setProperty('--bg-elevated', c.surfaceHover || c.surface);
  root.style.setProperty('--bg-hover', c.surfaceHover || c.surface);
  root.style.setProperty('--border-light', c.border);
  root.style.setProperty('--font-sans', "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif");
}

// eslint-disable-next-line no-unused-vars
function clearThemeColors() {
  const root = document.documentElement;
  const props = [
    '--bg',
    '--surface',
    '--surface-hover',
    '--border',
    '--text',
    '--text-muted',
    '--text-dim',
    '--accent',
    '--accent-hover',
    '--accent-dim',
    '--bg-surface',
    '--bg-elevated',
    '--bg-hover',
    '--border-light',
    '--font-sans',
  ];
  props.forEach((p) => root.style.removeProperty(p));
}
