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

  // Override CSS custom properties
  root.style.setProperty('--bg', c.background);
  root.style.setProperty('--surface', c.surface);
  root.style.setProperty('--surface-hover', c.surfaceHover || c.surface);
  root.style.setProperty('--border', c.border);
  root.style.setProperty('--text', c.text);
  root.style.setProperty('--text-muted', c.textSecondary);
  root.style.setProperty('--text-dim', c.textSecondary);
  root.style.setProperty('--accent', c.accent || c.primary);
  root.style.setProperty('--accent-hover', c.accentHover || c.accent || c.primary);
  root.style.setProperty('--accent-dim', c.primary);
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
  ];
  props.forEach((p) => root.style.removeProperty(p));
}
