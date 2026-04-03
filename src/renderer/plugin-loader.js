/* global agentDesk, window, document, console, CSS, getComputedStyle */
'use strict';

const _loadedPlugins = new Map();
let _pluginList = [];

export async function loadPlugins() {
  _pluginList = await agentDesk.plugins.list();
  return _pluginList;
}

export function getPlugins() {
  return _pluginList;
}

export function getPlugin(pluginId) {
  return _pluginList.find((p) => p.id === pluginId) || null;
}

export async function mountPlugin(pluginId, container) {
  const plugin = getPlugin(pluginId);
  if (!plugin) return false;

  let loaded = _loadedPlugins.get(pluginId);
  if (!loaded) {
    try {
      for (const url of plugin.scriptUrls) {
        await loadScript(url);
      }
      loaded = { pluginId, mounted: false };
      _loadedPlugins.set(pluginId, loaded);
    } catch (err) {
      console.error(`Failed to load plugin ${pluginId}:`, err);
      throw err;
    }
  }

  if (!loaded.mounted) {
    const config = await agentDesk.plugins.getConfig(pluginId);
    const globalMap = {
      'agent-comm': window.AC,
      'agent-tasks': window.TaskBoard,
      'agent-knowledge': window.Knowledge,
      'agent-discover': window.AD,
    };

    const globalObj = globalMap[pluginId];
    if (globalObj && typeof globalObj.mount === 'function') {
      globalObj.mount(container, {
        baseUrl: config?.baseUrl || '',
        wsUrl: config?.wsUrl || null,
        cssUrl: plugin.cssUrl || null,
      });
      loaded.mounted = true;
      loaded.container = container;
      syncThemeToPlugin(container);
      return true;
    }
  }

  return loaded.mounted;
}

export function unmountPlugin(pluginId) {
  const loaded = _loadedPlugins.get(pluginId);
  if (!loaded?.mounted) return;

  const globalMap = {
    'agent-comm': window.AC,
    'agent-tasks': window.TaskBoard,
    'agent-knowledge': window.Knowledge,
    'agent-discover': window.AD,
  };

  const globalObj = globalMap[pluginId];
  if (globalObj && typeof globalObj.unmount === 'function') {
    globalObj.unmount();
    loaded.mounted = false;
  }
}

function syncThemeToPlugin(container) {
  const shadow = container.shadowRoot;
  if (!shadow) return;
  const wrapper = shadow.querySelector('[class*="wrapper"]');
  if (!wrapper) return;

  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(`--${v}`).trim();

  const bg = get('bg');
  const text = get('text');
  const accent = get('accent');
  const border = get('border');
  if (!bg) return;

  function hexToRgba(hex, alpha) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`;
  }

  function lighten(hex, amt) {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (n >> 16) + amt);
    const g = Math.min(255, ((n >> 8) & 0xff) + amt);
    const b = Math.min(255, (n & 0xff) + amt);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  function darken(hex, amt) {
    return lighten(hex, -amt);
  }

  const theme = {
    '--bg': bg,
    '--bg-surface': lighten(bg, 8),
    '--bg-elevated': lighten(bg, 16),
    '--bg-hover': lighten(bg, 24),
    '--bg-inset': darken(bg, 8),
    '--border': border || lighten(bg, 32),
    '--border-light': border ? lighten(border, -10) : lighten(bg, 20),
    '--text': text || '#e2e9ef',
    '--text-muted': get('text-muted') || lighten(bg, 100),
    '--text-dim': get('text-dim') || lighten(bg, 70),
    '--text-secondary': get('text-muted') || lighten(bg, 100),
    '--accent': accent || '#5d8da8',
    '--accent-solid': accent || '#5d8da8',
    '--accent-dim': accent ? hexToRgba(accent, 0.15) : 'rgba(93,141,168,0.15)',
    '--green': get('green') || '#3fb950',
    '--green-dim': hexToRgba(get('green') || '#3fb950', 0.12),
    '--yellow': get('yellow') || '#d29922',
    '--yellow-dim': hexToRgba(get('yellow') || '#d29922', 0.12),
    '--orange': get('orange') || '#db6d28',
    '--orange-dim': hexToRgba(get('orange') || '#db6d28', 0.12),
    '--red': get('red') || '#f85149',
    '--red-dim': hexToRgba(get('red') || '#f85149', 0.12),
    '--purple': get('purple') || '#8e9ad0',
    '--purple-dim': hexToRgba(get('purple') || '#8e9ad0', 0.12),
    '--blue': get('blue') || '#0969da',
    '--blue-dim': hexToRgba(get('blue') || '#0969da', 0.12),
    '--focus-ring': accent ? accent + '66' : 'rgba(93,141,168,0.4)',
  };

  for (const [k, v] of Object.entries(theme)) {
    wrapper.style.setProperty(k, v);
  }
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CSS.escape(url)}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(script);
  });
}
