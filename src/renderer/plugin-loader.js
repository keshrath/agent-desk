/* global agentDesk, window, document, console, CSS */
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
