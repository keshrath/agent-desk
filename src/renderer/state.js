// =============================================================================
// Agent Desk — Central State & Registry
// =============================================================================
// Shared application state, DOM references, xterm/dockview globals, and a
// registry object for cross-module function references (breaks circular deps).
// =============================================================================

'use strict';

// xterm.js UMD Global Resolution (loaded from vendor/)
export const Terminal = window.Terminal;
export const FitAddon = (window.FitAddon && window.FitAddon.FitAddon) || window.FitAddon;
export const WebglAddon = (window.WebglAddon && window.WebglAddon.WebglAddon) || window.WebglAddon;
export const SearchAddon = (window.SearchAddon && window.SearchAddon.SearchAddon) || window.SearchAddon;
export const WebLinksAddon = (window.WebLinksAddon && window.WebLinksAddon.WebLinksAddon) || window.WebLinksAddon;

// dockview-core UMD global
const _dv = window['dockview-core'];
export const DockviewComponent = _dv && _dv.DockviewComponent;

if (!Terminal) {
  console.error('xterm.js Terminal not loaded — vendor files may be missing (run npm run build)');
}
if (!DockviewComponent) {
  console.error('dockview-core not loaded — vendor files may be missing (run npm run build)');
}

// Application state
export const state = {
  activeView: 'terminals',
  terminals: new Map(),
  activeTerminalId: null,
  terminalOrder: [],
  dockview: null,
  maximizedGroup: null,
  _panelCounter: 0,
  terminalChains: [], // { sourceId, targetId, trigger: 'exit-0'|'exit-any'|'idle', command: string }
};

window.__agentDeskState = state;

// DOM references
export const dom = {
  get sidebar() {
    return document.getElementById('sidebar');
  },
  get tabBar() {
    return document.getElementById('tab-bar');
  },
  get tabsContainer() {
    return document.getElementById('tab-list');
  },
  get btnNewTab() {
    return document.getElementById('btn-new-tab');
  },
  get terminalViews() {
    return document.getElementById('terminal-views');
  },
  get viewComm() {
    return document.getElementById('view-comm');
  },
  get viewTasks() {
    return document.getElementById('view-tasks');
  },
  get viewKnowledge() {
    return document.getElementById('view-knowledge');
  },
  get viewMonitor() {
    return document.getElementById('view-monitor');
  },
  get viewEvents() {
    return document.getElementById('view-events');
  },
  get settingsView() {
    return document.getElementById('settings-panel');
  },
  get statusLeft() {
    return document.querySelector('#status-bar .status-left');
  },
  get statusRight() {
    return document.querySelector('#status-bar .status-right');
  },
  get titlebarTitle() {
    return document.querySelector('#titlebar .app-title');
  },
};

// Theme & Terminal Configuration

export function getTermTheme(overrideThemeId) {
  const themeId = overrideThemeId || getSetting('themeId') || null;
  if (themeId && typeof getThemeById === 'function') {
    const theme = getThemeById(themeId);
    if (theme && theme.colors && theme.colors.terminal) {
      return theme.colors.terminal;
    }
  }
  const fallback = typeof getThemeById === 'function' ? getThemeById('default-dark') : null;
  return fallback && fallback.colors ? fallback.colors.terminal : { background: '#1a1d23', foreground: '#c8d1da' };
}

export const termTheme = getTermTheme();

export function stripAnsi(str) {
  return str
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b[()][0-9A-B]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

export function getTermFontWeight(themeId) {
  if (themeId && typeof getThemeById === 'function') {
    const t = getThemeById(themeId);
    return t && t.type === 'light' ? '500' : '400';
  }
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark ? '400' : '500';
}

export const termOptions = {
  theme: termTheme,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 14,
  fontWeight: getTermFontWeight(),
  fontWeightBold: '600',
  lineHeight: 1.3,
  cursorBlink: true,
  cursorStyle: 'bar',
  scrollback: 10000,
  allowTransparency: true,
};

// Registry for cross-module function references (breaks circular deps)
export const registry = {};
window.__agentDeskRegistry = registry;
