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

// Standard CSS variable contract — all agent-* plugins use these names.
// Agent-desk defines them in styles.css; sync copies them 1:1 to shadow DOM.
const CSS_CONTRACT = [
  'bg',
  'bg-surface',
  'bg-elevated',
  'bg-hover',
  'border',
  'border-light',
  'text',
  'text-muted',
  'text-dim',
  'accent',
  'accent-hover',
  'accent-dim',
  'green',
  'green-dim',
  'yellow',
  'yellow-dim',
  'orange',
  'orange-dim',
  'red',
  'red-dim',
  'purple',
  'purple-dim',
  'blue',
  'blue-dim',
  'radius',
  'radius-sm',
  'radius-lg',
  'font-sans',
  'font-mono',
  'shadow-1',
  'shadow-2',
  'shadow-3',
  'focus-ring',
];

function syncThemeToPlugin(container) {
  const shadow = container.shadowRoot;
  if (!shadow) return;
  // Try specific wrapper classes first, then fall back to attribute selector
  const wrapper =
    shadow.querySelector('.ac-wrapper, .tb-wrapper, .ak-wrapper, .ad-wrapper') ||
    shadow.querySelector('[class*="wrapper"]');
  if (!wrapper) return;

  const s = getComputedStyle(document.documentElement);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  wrapper.setAttribute('data-theme', isDark ? 'dark' : 'light');

  for (const name of CSS_CONTRACT) {
    const val = s.getPropertyValue(`--${name}`).trim();
    if (val) wrapper.style.setProperty(`--${name}`, val);
  }
}

export function syncAllPlugins() {
  for (const loaded of _loadedPlugins.values()) {
    if (loaded.mounted && loaded.container) {
      syncThemeToPlugin(loaded.container);
    }
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
