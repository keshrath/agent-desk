// Electron-coupled plugin glue. Lives in the desktop shell because it needs
// `protocol.handle('plugin', …)`, `ipcMain.handle`, and `BrowserWindow`.
// All pure plugin discovery + info-list building lives in @agent-desk/core's
// plugin-system module; this file just wires the Electron-side adapters.

import { readFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { ipcMain, protocol, type BrowserWindow } from 'electron';
import {
  discoverPlugins as coreDiscoverPlugins,
  destroyPlugins,
  resolvePluginAsset,
  type LoadedPlugin,
} from '@agent-desk/core';

export type { LoadedPlugin } from '@agent-desk/core';

/** Discover plugins relative to the desktop bundle's node_modules. */
export function discoverPlugins(nodeModulesDir: string): LoadedPlugin[] {
  return coreDiscoverPlugins(nodeModulesDir);
}

/** Register the `plugin://` URL scheme handler used by renderer shadow DOMs. */
export function registerPluginProtocol(plugins: LoadedPlugin[]): void {
  protocol.handle('plugin', (req) => {
    const url = new URL(req.url);
    const pluginId = url.hostname;
    const filePath = url.pathname.slice(1);

    const asset = resolvePluginAsset(plugins, pluginId, filePath);
    if (!asset) {
      return new Response('Not found', { status: 404 });
    }

    const content = readFileSync(asset.absPath);
    return new Response(new Uint8Array(content), {
      headers: { 'Content-Type': asset.mimeType },
    });
  });
}

/** Load and call initMain() on every plugin that ships a main-process module. */
export async function initPlugins(plugins: LoadedPlugin[], mainWindow: BrowserWindow): Promise<void> {
  for (const plugin of plugins) {
    if (!plugin.manifest.main) continue;
    try {
      const mainPath = join(plugin.packageDir, plugin.manifest.main);
      const mod = await import(pathToFileURL(mainPath).href);
      plugin.mainModule = mod;
      if (typeof mod.initMain === 'function') {
        mod.initMain({ ipcMain, mainWindow, pluginId: plugin.manifest.id });
      }
    } catch (err) {
      process.stderr.write(`[plugin:${plugin.manifest.id}] main init failed: ${err}\n`);
    }
  }
}

// NOTE: plugins:list / plugins:getConfig used to be registered here directly,
// but the Phase C migration (v1.2.0) moved them into createRouter() via
// buildDefaultRequestHandlers in @agent-desk/core/handlers-default.ts. The
// double registration crashed Electron at startup with
//   "Attempted to register a second handler for 'plugins:list'"
// Caught by the v1.5.x electron e2e smoke test that actually launched the app.

export { destroyPlugins };
