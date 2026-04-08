import { app, BrowserWindow, dialog, ipcMain, Tray, Menu, nativeImage, shell, Notification } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { existsSync, statSync } from 'fs';
import {
  TerminalManager,
  type HistoryEntry,
  startMonitoring,
  stopMonitoring,
  getSystemStats,
  onStatsUpdate,
  setAppVersion,
  setupCrashHandlers,
  writeCrashLog,
  hasRecentCrashLogs,
  CRASH_LOG_DIR,
  autoConfigureMcpServers,
  detectInstalledTools,
  CONFIG_FILE,
  readConfig,
  writeConfig,
  watchConfig,
  type ConfigData,
  readKeybindings,
  writeKeybindings,
  HistoryStore,
  saveSession as coreSaveSession,
  loadSession,
  getSavedBuffer,
  fileStat,
  fileDirname,
  fileWrite,
} from '@agent-desk/core';
import { discoverPlugins, registerPluginProtocol, setupPluginIPC, type LoadedPlugin } from './plugin-electron.js';

// Native dashboard data access
import { createContext as createCommContext, type AppContext as CommContext } from 'agent-comm/dist/lib.js';
import { createContext as createTasksContext, type AppContext as TasksContext } from 'agent-tasks/dist/lib.js';
import { createContext as createDiscoverContext, type AppContext as DiscoverContext } from 'agent-discover/dist/lib.js';
import {
  getConfig as getKnowledgeConfig,
  listEntries,
  readEntry,
  searchKnowledge,
  listSessions,
  getSessionSummary,
} from 'agent-knowledge/dist/lib.js';

setAppVersion(app.getVersion());
setupCrashHandlers();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Native dashboard contexts (lazy-initialized)
// ---------------------------------------------------------------------------

let commCtx: CommContext | null = null;
let tasksCtx: TasksContext | null = null;
let discoverCtx: DiscoverContext | null = null;

let nativeDataIntervals: ReturnType<typeof setInterval>[] = [];

function initNativeContexts(): void {
  try {
    commCtx = createCommContext();
    process.stderr.write('[agent-desk] native comm context initialized\n');
  } catch (err) {
    process.stderr.write(`[agent-desk] comm context failed: ${err}\n`);
  }
  try {
    tasksCtx = createTasksContext();
    process.stderr.write('[agent-desk] native tasks context initialized\n');
  } catch (err) {
    process.stderr.write(`[agent-desk] tasks context failed: ${err}\n`);
  }
  try {
    discoverCtx = createDiscoverContext();
    process.stderr.write('[agent-desk] native discover context initialized\n');
  } catch (err) {
    process.stderr.write(`[agent-desk] discover context failed: ${err}\n`);
  }
}

function closeNativeContexts(): void {
  for (const iv of nativeDataIntervals) clearInterval(iv);
  nativeDataIntervals = [];
  commCtx?.close();
  commCtx = null;
  tasksCtx?.close();
  tasksCtx = null;
  discoverCtx?.close();
  discoverCtx = null;
}

function startNativeDataPolling(): void {
  // Comm polling — every 2s
  nativeDataIntervals.push(
    setInterval(() => {
      if (!mainWindow || !commCtx) return;
      try {
        const agents = commCtx.agents.list();
        const channels = commCtx.channels.list();
        const messages = commCtx.messages.list({ limit: 100 });
        const stateEntries = commCtx.state.list();
        const feed = commCtx.feed.recent(100);
        mainWindow.webContents.send('comm:update', { agents, channels, messages, state: stateEntries, feed });
      } catch {
        /* context may be closing */
      }
    }, 2000),
  );

  // Tasks polling — every 2s
  nativeDataIntervals.push(
    setInterval(() => {
      if (!mainWindow || !tasksCtx) return;
      try {
        const tasks = tasksCtx.tasks.list({});
        mainWindow.webContents.send('tasks:update', { tasks });
      } catch {
        /* context may be closing */
      }
    }, 2000),
  );

  // Knowledge polling — every 5s
  nativeDataIntervals.push(
    setInterval(() => {
      if (!mainWindow) return;
      try {
        const config = getKnowledgeConfig();
        const entries = listEntries(config.memoryDir);
        mainWindow.webContents.send('knowledge:update', { entries });
      } catch {
        /* knowledge dir may not exist */
      }
    }, 5000),
  );

  // Discover polling — every 2s
  nativeDataIntervals.push(
    setInterval(() => {
      if (!mainWindow || !discoverCtx) return;
      try {
        const servers = discoverCtx.registry.list();
        mainWindow.webContents.send('discover:update', { servers });
      } catch {
        /* context may be closing */
      }
    }, 2000),
  );
}

// Live reload in development — watches renderer files
try {
  require('electron-reload')(join(__dirname, '../../packages/ui/src/renderer'), {
    electron: join(__dirname, '../../node_modules/.bin/electron'),
  });
} catch {
  // electron-reload not available in production builds
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let saveInterval: ReturnType<typeof setInterval> | null = null;
let trayTooltipInterval: ReturnType<typeof setInterval> | null = null;
let isQuitting = false;
let updateCheckInterval: ReturnType<typeof setInterval> | null = null;
let loadedPlugins: LoadedPlugin[] = [];
const terminalManager = new TerminalManager();

// Config file (~/.agent-desk/config.json) is now provided by @agent-desk/core.
// We keep a local stop-fn so we can dispose the watcher on quit.
let stopConfigWatcher: (() => void) | null = null;
const historyStore = new HistoryStore();

// ---------------------------------------------------------------------------
// CLI Launch Args & Single Instance
// ---------------------------------------------------------------------------

interface LaunchArgs {
  cwd: string | null;
  command: string | null;
}

function parseLaunchArgs(argv: string[]): LaunchArgs {
  let cwd: string | null = null;
  let command: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cwd' && argv[i + 1]) {
      cwd = argv[++i];
    } else if (argv[i] === '--command' && argv[i + 1]) {
      command = argv[++i];
    }
  }

  // Bare directory as last arg fallback
  if (!cwd) {
    const last = argv[argv.length - 1];
    if (last && !last.startsWith('-') && !last.includes('electron') && !last.endsWith('.js')) {
      try {
        if (existsSync(last) && statSync(last).isDirectory()) {
          cwd = last;
        }
      } catch {
        // not a valid path
      }
    }
  }

  return { cwd, command };
}

function openInRenderer(args: LaunchArgs): void {
  if (mainWindow) {
    mainWindow.webContents.send('action:open-cwd', args.cwd, args.command);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const args = parseLaunchArgs(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (args.cwd || args.command) {
        openInRenderer(args);
      }
    }
  });
}

// Session persistence is provided by @agent-desk/core. The desktop shell
// owns the renderer-saved layout (it lives in this process across saves).
let _savedLayout: unknown = null;
function saveSession(): void {
  coreSaveSession(terminalManager, {
    windowBounds: mainWindow?.getBounds(),
    layout: _savedLayout,
  });
}

function createWindow(): BrowserWindow {
  const savedSession = loadSession();
  const bounds = savedSession?.windowBounds;

  const win = new BrowserWindow({
    width: bounds?.width || 1400,
    height: bounds?.height || 900,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 800,
    minHeight: 600,
    title: 'Agent Desk',
    icon: join(__dirname, '../../resources/icon.png'),
    backgroundColor: '#1a1d23',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../../packages/desktop/dist/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(join(__dirname, '../../packages/ui/src/renderer/index.html'));

  let trayNotified = false;
  win.on('close', (e) => {
    saveSession();
    if (tray && !isQuitting) {
      e.preventDefault();
      win.hide();
      if (!trayNotified && Notification.isSupported()) {
        new Notification({
          title: 'Agent Desk',
          body: 'Minimized to system tray. Right-click the tray icon to quit.',
        }).show();
        trayNotified = true;
      }
    }
  });

  // Auto-save session every 60 seconds (protects against crashes)
  saveInterval = setInterval(saveSession, 60000);

  return win;
}

function createTray(): void {
  const iconPath = join(__dirname, '../../resources/icon.png');
  let trayIcon: Electron.NativeImage;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Agent Desk');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Agent Desk', click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: 'New Terminal',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send('action:new-terminal');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        tray?.destroy();
        tray = null;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

function setupIPC(): void {
  // Terminal management
  ipcMain.handle(
    'terminal:create',
    (
      _e,
      opts: {
        cwd?: string;
        command?: string;
        args?: string[];
        cols?: number;
        rows?: number;
        env?: Record<string, string>;
      },
    ) => {
      try {
        const term = terminalManager.spawn(opts.cwd, opts.command, opts.args, opts.cols, opts.rows, opts.env);
        return { id: term.id, cwd: term.cwd, command: term.command, args: term.args };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to spawn terminal: ${msg}`);
      }
    },
  );

  ipcMain.handle('terminal:write', (_e, id: string, data: string) => {
    return terminalManager.write(id, data);
  });

  ipcMain.handle('terminal:resize', (_e, id: string, cols: number, rows: number) => {
    return terminalManager.resize(id, cols, rows);
  });

  ipcMain.handle('terminal:kill', (_e, id: string) => {
    return terminalManager.kill(id);
  });

  ipcMain.handle('terminal:signal', (_e, id: string, signal: string) => {
    return terminalManager.signal(id, signal);
  });

  ipcMain.handle('terminal:restart', (_e, id: string) => {
    return terminalManager.restart(id);
  });

  ipcMain.handle('terminal:list', () => {
    return terminalManager.list();
  });

  // Subscribe renderer to terminal output
  ipcMain.on('terminal:subscribe', (e, id: string) => {
    terminalManager.subscribe(id, {
      send: (data: string) => {
        try {
          e.sender.send('terminal:data', id, data);
        } catch {
          // Renderer may have been destroyed
        }
      },
      sendExit: (exitCode: number) => {
        try {
          e.sender.send('terminal:exit', id, exitCode);
        } catch {
          // Renderer may have been destroyed
        }
      },
    });
  });

  ipcMain.on('terminal:unsubscribe', (_e, id: string) => {
    terminalManager.unsubscribeAll(id);
  });

  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // Session persistence
  ipcMain.handle('session:save', () => saveSession());
  ipcMain.handle('session:load', () => loadSession());
  ipcMain.handle('session:getBuffer', (_e, id: string) => getSavedBuffer(id));

  ipcMain.handle('session:autoSave', () => {
    saveSession();
    return true;
  });

  ipcMain.handle('session:replayBuffer', (_e, id: string) => getSavedBuffer(id));

  ipcMain.handle('session:setAgentInfo', (_e, id: string, agentName: string | null, profileName: string | null) => {
    return terminalManager.setAgentInfo(id, agentName, profileName);
  });

  ipcMain.handle('session:saveLayout', (_e, layout: unknown) => {
    _savedLayout = layout;
    return true;
  });

  // App settings
  ipcMain.on('app:setLoginItem', (_e, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
  });

  // Window flash (for bell / notification)
  ipcMain.on('window:flashFrame', () => {
    mainWindow?.flashFrame(true);
  });

  // Desktop notification
  ipcMain.on('app:notify', (_e, title: string, body: string) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  // Open directory dialog
  ipcMain.handle('dialog:openDirectory', async (_e, options: { defaultPath?: string }) => {
    const win = mainWindow || BrowserWindow.getFocusedWindow();
    if (win) win.setAlwaysOnTop(false);
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: options?.defaultPath || undefined,
      title: 'Select Directory',
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  const approvedWritePaths = new Set<string>();

  ipcMain.handle(
    'dialog:saveFile',
    async (_e, options: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => {
      const result = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: options.defaultPath,
        filters: options.filters || [
          { name: 'Text Files', extensions: ['txt', 'log'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePath) return null;
      approvedWritePaths.add(result.filePath);
      return result.filePath;
    },
  );

  ipcMain.handle('file:write', async (_e, filePath: string, content: string) => {
    if (!approvedWritePaths.has(filePath)) {
      throw new Error('File write denied: path not approved via save dialog');
    }
    approvedWritePaths.delete(filePath);
    return fileWrite(filePath, content);
  });

  ipcMain.handle('file:stat', (_e, filePath: string) => fileStat(filePath));
  ipcMain.handle('file:dirname', (_e, filePath: string) => fileDirname(filePath));

  // Pop-out terminal into its own window
  ipcMain.handle('terminal:popout', (_e, opts: { terminalId: string; title: string; cols?: number; rows?: number }) => {
    const popWin = new BrowserWindow({
      width: 800,
      height: 500,
      title: opts.title || 'Terminal',
      icon: join(__dirname, '../../resources/icon.png'),
      backgroundColor: '#1a1d23',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../../packages/desktop/dist/preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    const termId = encodeURIComponent(opts.terminalId);
    const title = encodeURIComponent(opts.title || 'Terminal');
    popWin.loadFile(join(__dirname, '../../packages/ui/src/renderer/popout.html'), {
      query: { terminalId: termId, title: title },
    });
    terminalManager.subscribe(opts.terminalId, {
      send: (data: string) => {
        try {
          popWin.webContents.send('terminal:data', opts.terminalId, data);
        } catch {
          /* window closed */
        }
      },
      sendExit: (exitCode: number) => {
        try {
          popWin.webContents.send('terminal:exit', opts.terminalId, exitCode);
        } catch {
          /* window closed */
        }
      },
    });
    return { windowId: popWin.id };
  });

  // Config file management (F6) — backed by @agent-desk/core
  ipcMain.handle('config:read', () => readConfig());
  ipcMain.handle('config:write', (_e, data: ConfigData) => writeConfig(data));
  ipcMain.handle('config:getPath', () => CONFIG_FILE);

  // Keybindings persistence (F5) — backed by @agent-desk/core
  ipcMain.handle('keybindings:read', () => readKeybindings());
  ipcMain.handle('keybindings:write', (_e, data: Record<string, string | null>) => writeKeybindings(data));

  // Open path in system file manager
  ipcMain.on('shell:openPath', (_e, dirPath: string) => {
    try {
      if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
        shell.openPath(dirPath);
      }
    } catch {
      console.warn(`[agent-desk] Failed to open path: ${dirPath}`);
    }
  });

  // External links — only allow http/https URLs
  ipcMain.on('shell:openExternal', (_e, url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url);
      } else {
        console.warn(`[agent-desk] Blocked openExternal for non-http URL: ${url}`);
      }
    } catch {
      console.warn(`[agent-desk] Blocked openExternal for invalid URL: ${url}`);
    }
  });

  // --- Command History (F13) — backed by @agent-desk/core HistoryStore ---
  ipcMain.handle('history:get', (_e, limit?: number, search?: string) => historyStore.get(limit, search));
  ipcMain.handle('history:clear', () => historyStore.clear());

  // Listen for history entries from terminal manager
  terminalManager.onHistoryEntry((entry: HistoryEntry) => {
    historyStore.add(entry);
    // Notify renderer of new history entry
    if (mainWindow) {
      try {
        mainWindow.webContents.send('history:new', entry);
      } catch {
        /* window may be closed */
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Native Dashboard Data — agent-comm
  // ---------------------------------------------------------------------------

  ipcMain.handle('comm:state', () => {
    if (!commCtx) return null;
    return {
      agents: commCtx.agents.list(),
      channels: commCtx.channels.list(),
      messages: commCtx.messages.list({ limit: 100 }),
      state: commCtx.state.list(),
      feed: commCtx.feed.recent(100),
    };
  });

  ipcMain.handle('comm:agents', () => (commCtx ? commCtx.agents.list() : []));
  ipcMain.handle('comm:messages', (_e, limit?: number) =>
    commCtx ? commCtx.messages.list({ limit: limit ?? 100 }) : [],
  );
  ipcMain.handle('comm:channels', () => (commCtx ? commCtx.channels.list() : []));
  ipcMain.handle('comm:state-entries', () => (commCtx ? commCtx.state.list() : []));
  ipcMain.handle('comm:feed', (_e, limit?: number) => (commCtx ? commCtx.feed.recent(limit ?? 100) : []));

  // ---------------------------------------------------------------------------
  // Native Dashboard Data — agent-tasks
  // ---------------------------------------------------------------------------

  ipcMain.handle('tasks:state', () => {
    if (!tasksCtx) return null;
    return { tasks: tasksCtx.tasks.list({}) };
  });

  ipcMain.handle('tasks:list', (_e, filter?: Record<string, unknown>) => {
    if (!tasksCtx) return [];
    return tasksCtx.tasks.list(filter ?? {});
  });

  ipcMain.handle('tasks:get', (_e, id: number) => {
    if (!tasksCtx) return null;
    return tasksCtx.tasks.getById(id);
  });

  ipcMain.handle('tasks:search', (_e, query: string) => {
    if (!tasksCtx) return [];
    return tasksCtx.tasks.search(query);
  });

  // ---------------------------------------------------------------------------
  // Native Dashboard Data — agent-knowledge
  // ---------------------------------------------------------------------------

  ipcMain.handle('knowledge:entries', (_e, category?: string) => {
    try {
      const config = getKnowledgeConfig();
      const entries = listEntries(config.memoryDir, category);
      return entries;
    } catch {
      return [];
    }
  });

  ipcMain.handle('knowledge:read', (_e, category: string, name: string) => {
    try {
      const config = getKnowledgeConfig();
      const entryPath = name ? `${category}/${name}` : category;
      return readEntry(config.memoryDir, entryPath);
    } catch {
      return null;
    }
  });

  ipcMain.handle('knowledge:search', (_e, query: string) => {
    try {
      const config = getKnowledgeConfig();
      return searchKnowledge(config.memoryDir, query);
    } catch {
      return [];
    }
  });

  ipcMain.handle('knowledge:sessions', () => {
    try {
      return listSessions();
    } catch {
      return [];
    }
  });

  ipcMain.handle('knowledge:session', (_e, sessionId: string, project?: string) => {
    try {
      return getSessionSummary(sessionId, project);
    } catch {
      return null;
    }
  });

  // ---------------------------------------------------------------------------
  // Native Dashboard Data — agent-discover
  // ---------------------------------------------------------------------------

  ipcMain.handle('discover:state', () => {
    if (!discoverCtx) return null;
    return { servers: discoverCtx.registry.list() };
  });

  ipcMain.handle('discover:servers', () => (discoverCtx ? discoverCtx.registry.list() : []));

  ipcMain.handle('discover:server', (_e, id: number) => {
    if (!discoverCtx) return null;
    return discoverCtx.registry.getById(id);
  });

  ipcMain.handle('discover:browse', async (_e, query?: string) => {
    if (!discoverCtx) return { servers: [] };
    try {
      return await discoverCtx.marketplace.browse(query ?? '');
    } catch {
      return { servers: [] };
    }
  });

  ipcMain.handle('discover:activate', async (_e, id: number) => {
    if (!discoverCtx) return false;
    try {
      const server = discoverCtx.registry.getById(id);
      if (!server || !server.command) return false;
      await discoverCtx.proxy.activate({
        name: server.name,
        command: server.command,
        args: server.args,
        env: server.env,
      });
      discoverCtx.registry.setActive(server.name, true);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('discover:deactivate', async (_e, id: number) => {
    if (!discoverCtx) return false;
    try {
      const server = discoverCtx.registry.getById(id);
      if (!server) return false;
      await discoverCtx.proxy.deactivate(server.name);
      discoverCtx.registry.setActive(server.name, false);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('discover:delete', (_e, id: number) => {
    if (!discoverCtx) return false;
    try {
      const server = discoverCtx.registry.getById(id);
      if (!server) return false;
      discoverCtx.registry.unregister(server.name);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('discover:secrets', (_e, serverId: number) => {
    if (!discoverCtx) return [];
    try {
      return discoverCtx.secrets.list(serverId);
    } catch {
      return [];
    }
  });

  ipcMain.handle('discover:metrics', (_e, serverId?: number) => {
    if (!discoverCtx) return [];
    try {
      if (serverId) return discoverCtx.metrics.getServerMetrics(serverId);
      return discoverCtx.metrics.getOverview();
    } catch {
      return [];
    }
  });

  ipcMain.handle('discover:health', (_e, serverId: number) => {
    if (!discoverCtx) return null;
    try {
      return discoverCtx.health.getHealth(serverId);
    } catch {
      return null;
    }
  });

  // ---------------------------------------------------------------------------
  // System Monitor
  // ---------------------------------------------------------------------------

  ipcMain.handle('system:stats', () => getSystemStats());

  ipcMain.handle('system:start-monitoring', () => {
    startMonitoring();
    return true;
  });

  ipcMain.handle('system:stop-monitoring', () => {
    stopMonitoring();
    return true;
  });

  // ---------------------------------------------------------------------------
  // Crash Reporting
  // ---------------------------------------------------------------------------

  ipcMain.handle('app:reportError', (_e, errorData: { message: string; stack?: string; source: string }) => {
    const error = new Error(errorData.message);
    if (errorData.stack) error.stack = errorData.stack;
    writeCrashLog(error, 'renderer');
    return true;
  });

  ipcMain.handle('app:getCrashLogDir', () => CRASH_LOG_DIR);

  // ---------------------------------------------------------------------------
  // MCP Auto-Configuration
  // ---------------------------------------------------------------------------

  ipcMain.handle('mcp:detect-tools', () => detectInstalledTools());
  ipcMain.handle('mcp:auto-configure', () => autoConfigureMcpServers());
}

// History persistence is now provided by @agent-desk/core HistoryStore
// (instantiated as `historyStore` near the top of this file).

// ---------------------------------------------------------------------------
// Auto-Updater (electron-updater)
// ---------------------------------------------------------------------------

function setupAutoUpdater(): void {
  try {
    import('electron-updater').then((mod) => {
      const autoUpdater = mod?.autoUpdater;
      if (!autoUpdater?.setFeedURL) return;
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'keshrath',
        repo: 'agent-desk',
      } as Parameters<typeof autoUpdater.setFeedURL>[0]);

      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.on('update-available', (info) => {
        const version = info?.version || 'unknown';
        sendUpdateStatus('update-available', `Update available (v${version}). Downloading...`);
      });

      autoUpdater.on('update-downloaded', (info) => {
        const version = info?.version || 'unknown';
        sendUpdateStatus('update-downloaded', `Update v${version} ready. Restart to apply.`);
      });

      autoUpdater.on('error', (err) => {
        process.stderr.write(`[agent-desk] auto-updater error: ${err?.message || err}\n`);
      });

      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {});
      }, 10000);

      updateCheckInterval = setInterval(
        () => {
          autoUpdater.checkForUpdates().catch(() => {});
        },
        4 * 60 * 60 * 1000,
      );

      ipcMain.handle('app:checkForUpdates', () => {
        return autoUpdater.checkForUpdates().catch(() => null);
      });

      ipcMain.handle('app:installUpdate', () => {
        autoUpdater.quitAndInstall(false, true);
      });
    });
  } catch (err) {
    process.stderr.write(`[agent-desk] auto-updater init failed: ${err}\n`);
  }
}

function sendUpdateStatus(type: string, message: string): void {
  if (mainWindow) {
    try {
      mainWindow.webContents.send('app:updateStatus', { type, message });
    } catch {
      /* window may be closed */
    }
  }
}

app.whenReady().then(async () => {
  historyStore.load();
  initNativeContexts();

  loadedPlugins = discoverPlugins(join(__dirname, '..', '..', 'node_modules'));
  setupPluginIPC(loadedPlugins);
  if (loadedPlugins.length > 0) {
    registerPluginProtocol(loadedPlugins);
  }

  setupIPC();
  mainWindow = createWindow();
  createTray();
  stopConfigWatcher = watchConfig((data) => {
    mainWindow?.webContents.send('config:changed', data);
  });
  startNativeDataPolling();

  setupAutoUpdater();

  // MCP auto-configuration removed from startup — now handled by onboarding wizard

  const crashInfo = hasRecentCrashLogs();
  if (crashInfo.hasCrash && mainWindow) {
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        mainWindow?.webContents.send('app:crashDetected', crashInfo.dir);
      }, 2000);
    });
  }

  startMonitoring();
  onStatsUpdate((stats) => {
    if (mainWindow) {
      try {
        mainWindow.webContents.send('system:stats-update', stats);
      } catch {
        /* window may be closed */
      }
    }
  });

  function updateTrayTooltip(): void {
    if (!tray) return;
    const stats = getSystemStats();
    const ramGB = (stats.ram.used / (1024 * 1024 * 1024)).toFixed(1);
    const ramTotalGB = (stats.ram.total / (1024 * 1024 * 1024)).toFixed(0);
    const termCount = terminalManager.list().filter((t) => t.status === 'running').length;
    tray.setToolTip(
      `Agent Desk\nCPU: ${stats.cpu}% \u00B7 RAM: ${ramGB}/${ramTotalGB} GB\n${termCount} terminal${termCount !== 1 ? 's' : ''} running`,
    );
  }
  trayTooltipInterval = setInterval(updateTrayTooltip, 10000);
  setTimeout(updateTrayTooltip, 3000);

  // Handle startup CLI args
  const startupArgs = parseLaunchArgs(process.argv);
  if (startupArgs.cwd || startupArgs.command) {
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => openInRenderer(startupArgs), 500);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // On Windows/Linux, keep running in tray
    if (!tray) app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  saveSession();
  closeNativeContexts();
  stopMonitoring();
  if (saveInterval) {
    clearInterval(saveInterval);
    saveInterval = null;
  }
  if (trayTooltipInterval) {
    clearInterval(trayTooltipInterval);
    trayTooltipInterval = null;
  }
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
  if (stopConfigWatcher) {
    stopConfigWatcher();
    stopConfigWatcher = null;
  }
  terminalManager.cleanup();
});
