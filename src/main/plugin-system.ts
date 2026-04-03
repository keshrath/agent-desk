import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { ipcMain, protocol, type BrowserWindow } from 'electron';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PluginManifest {
  id: string;
  name: string;
  icon: string;
  version: string;
  description: string;
  main?: string; // main process module path (relative to package)
  ui: string; // renderer module path (relative to package)
  css?: string; // CSS file path (relative to package)
  uiFiles?: string[]; // ordered list of UI JS files
  position?: number;
}

interface LoadedPlugin {
  manifest: PluginManifest;
  packageDir: string;
  mainModule?: Record<string, unknown>;
}

interface PluginInfo {
  id: string;
  name: string;
  icon: string;
  version: string;
  description: string;
  position: number;
  cssUrl: string | null;
  scriptUrls: string[];
}

// Discover plugins from node_modules
function discoverPlugins(): LoadedPlugin[] {
  const plugins: LoadedPlugin[] = [];
  const nodeModulesDir = join(__dirname, '..', '..', 'node_modules');

  if (!existsSync(nodeModulesDir)) return plugins;

  for (const entry of readdirSync(nodeModulesDir)) {
    const entryPath = join(nodeModulesDir, entry);
    if (entry.startsWith('@')) {
      try {
        for (const subEntry of readdirSync(entryPath)) {
          tryLoadPlugin(join(entryPath, subEntry), plugins);
        }
      } catch {
        /* skip */
      }
      continue;
    }
    tryLoadPlugin(entryPath, plugins);
  }

  // Also scan ~/.agent-desk/plugins/
  const localPluginsDir = join(homedir(), '.agent-desk', 'plugins');
  if (existsSync(localPluginsDir)) {
    for (const entry of readdirSync(localPluginsDir)) {
      tryLoadPlugin(join(localPluginsDir, entry), plugins);
    }
  }

  plugins.sort((a, b) => (a.manifest.position ?? 99) - (b.manifest.position ?? 99));
  return plugins;
}

function tryLoadPlugin(dir: string, plugins: LoadedPlugin[]): void {
  const manifestPath = join(dir, 'agent-desk-plugin.json');
  if (!existsSync(manifestPath)) return;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    plugins.push({ manifest, packageDir: dir });
  } catch {
    /* skip malformed */
  }
}

// Register plugin:// protocol to serve plugin static files
function registerPluginProtocol(plugins: LoadedPlugin[]): void {
  const pluginMap = new Map<string, LoadedPlugin>();
  for (const p of plugins) pluginMap.set(p.manifest.id, p);

  protocol.handle('plugin', (req) => {
    const url = new URL(req.url);
    const pluginId = url.hostname;
    const filePath = url.pathname.slice(1); // remove leading /

    const plugin = pluginMap.get(pluginId);
    if (!plugin) {
      return new Response('Plugin not found', { status: 404 });
    }

    // Resolve to the dist/ui/ directory
    const uiDir = join(plugin.packageDir, 'dist', 'ui');
    const resolved = join(uiDir, filePath);

    // Security: ensure resolved path is within uiDir
    if (!resolved.startsWith(uiDir)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (!existsSync(resolved)) {
      return new Response('File not found', { status: 404 });
    }

    const content = readFileSync(resolved);
    const ext = resolved.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      js: 'application/javascript',
      css: 'text/css',
      html: 'text/html',
      json: 'application/json',
      svg: 'image/svg+xml',
    };

    return new Response(content, {
      headers: { 'Content-Type': mimeTypes[ext || ''] || 'application/octet-stream' },
    });
  });
}

// Build plugin info for renderer
function getPluginInfoList(plugins: LoadedPlugin[]): PluginInfo[] {
  return plugins.map((p) => {
    const m = p.manifest;
    const uiDir = join(p.packageDir, 'dist', 'ui');
    const uiFiles = m.uiFiles || [m.ui.split('/').pop() || 'app.js'];
    // Prefer version from package.json (always up-to-date) over manifest
    let version = m.version;
    try {
      const pkgPath = join(p.packageDir, 'package.json');
      if (existsSync(pkgPath)) {
        version = JSON.parse(readFileSync(pkgPath, 'utf-8')).version || version;
      }
    } catch {
      /* use manifest version */
    }
    return {
      id: m.id,
      name: m.name,
      icon: m.icon,
      version,
      description: m.description || '',
      position: m.position ?? 99,
      cssUrl: m.css ? pathToFileURL(join(uiDir, 'styles.css')).href : null,
      scriptUrls: uiFiles.map((f) => pathToFileURL(join(uiDir, f)).href),
    };
  });
}

async function initPlugins(plugins: LoadedPlugin[], mainWindow: BrowserWindow): Promise<void> {
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

// Cleanup
function destroyPlugins(plugins: LoadedPlugin[]): void {
  for (const plugin of plugins) {
    const mod = plugin.mainModule as Record<string, unknown> | undefined;
    if (mod && typeof mod.destroyMain === 'function') {
      try {
        (mod.destroyMain as () => void)();
      } catch {
        /* ignore */
      }
    }
  }
}

// IPC: send plugin info to renderer
function setupPluginIPC(plugins: LoadedPlugin[]): void {
  const infoList = getPluginInfoList(plugins);

  ipcMain.handle('plugins:list', () => infoList);

  ipcMain.handle('plugins:getConfig', (_event, pluginId: string) => {
    const plugin = plugins.find((p) => p.manifest.id === pluginId);
    if (!plugin) return null;
    const portMap: Record<string, number> = {
      'agent-comm': 3421,
      'agent-tasks': 3422,
      'agent-knowledge': 3423,
      'agent-discover': 3424,
    };
    const port = portMap[pluginId];
    return port
      ? {
          baseUrl: `http://localhost:${port}`,
          wsUrl: `localhost:${port}`,
        }
      : null;
  });
}

export {
  discoverPlugins,
  registerPluginProtocol,
  initPlugins,
  destroyPlugins,
  setupPluginIPC,
  LoadedPlugin,
  PluginManifest,
  PluginInfo,
};
