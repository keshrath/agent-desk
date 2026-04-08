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
  onStatsUpdate,
  setAppVersion,
  setupCrashHandlers,
  hasRecentCrashLogs,
  watchConfig,
  HistoryStore,
  saveSession as coreSaveSession,
  loadSession,
  getSystemStats,
  AgentBridges,
  createRouter,
  type PushChannel,
} from '@agent-desk/core';
import { mountIpcBridge } from './ipc-bridge.js';
import { buildDesktopRequestHandlers, buildDesktopCommandHandlers } from './desktop-handlers.js';
import { discoverPlugins, registerPluginProtocol, setupPluginIPC, type LoadedPlugin } from './plugin-electron.js';

setAppVersion(app.getVersion());
setupCrashHandlers();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// All four agent SDK contexts + their polling loops live in @agent-desk/core
// AgentBridges. The desktop bootstrap instantiates one and wires its push
// emissions through the router into mainWindow.webContents.send.
const bridges = new AgentBridges();

// Live reload in development — watches renderer files
try {
  require('electron-reload')(join(__dirname, '../../../../packages/ui/src/renderer'), {
    electron: join(__dirname, '../../../../node_modules/.bin/electron'),
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
    icon: join(__dirname, '../../../../resources/icon.png'),
    backgroundColor: '#1a1d23',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(join(__dirname, '../../../../packages/ui/src/renderer/index.html'));

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
  const iconPath = join(__dirname, '../../../../resources/icon.png');
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

// Track approved file:write paths (set by dialog:saveFile, consumed by file:write)
const approvedWritePaths = new Set<string>();

let unmountIpcBridge: (() => void) | null = null;

function setupIPC(): void {
  // ---------------------------------------------------------------------------
  // Router-based handlers — every channel in the @agent-desk/core contract
  // is wired through createRouter() + mountIpcBridge. This is the same
  // dispatch path the @agent-desk/server WS transport uses, so the desktop
  // and the web target share their handler bodies.
  // ---------------------------------------------------------------------------

  const handlerDeps = {
    terminals: terminalManager,
    history: historyStore,
    bridges,
    plugins: loadedPlugins,
    getMainWindow: () => mainWindow,
    getSavedLayout: () => _savedLayout,
    setSavedLayout: (layout: unknown) => {
      _savedLayout = layout;
    },
    approvedWritePaths,
  };

  const router = createRouter({
    requestHandlers: buildDesktopRequestHandlers(handlerDeps),
    commandHandlers: buildDesktopCommandHandlers(handlerDeps),
  });

  // Push channels that core emits and we want forwarded to the renderer.
  // Renderer-side listeners come from the preload script.
  const pushChannels: PushChannel[] = [
    'comm:update',
    'tasks:update',
    'knowledge:update',
    'discover:update',
    'config:changed',
    'history:new',
    'system:stats-update',
  ];

  unmountIpcBridge = mountIpcBridge({
    router,
    pushChannels,
    getWindow: () => mainWindow,
  });

  // Wire core push sources into the router's emit bus.
  bridges.startPolling((channel, payload) => {
    router.emit(channel as PushChannel, payload as never);
  });
  watchConfig((data) => router.emit('config:changed', data));
  terminalManager.onHistoryEntry((entry: HistoryEntry) => {
    historyStore.add(entry);
    router.emit('history:new', entry);
  });
  startMonitoring();
  onStatsUpdate((stats) => router.emit('system:stats-update', stats));

  // ---------------------------------------------------------------------------
  // Electron-only IPC channels — NOT in the @agent-desk/core contract.
  // These stay as direct ipcMain handlers because they touch BrowserWindow,
  // dialog, shell, Notification, app, autoUpdater — none of which exist on
  // the web target.
  // ---------------------------------------------------------------------------

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

  // Pop-out terminal into its own window
  ipcMain.handle('terminal:popout', (_e, opts: { terminalId: string; title: string; cols?: number; rows?: number }) => {
    const popWin = new BrowserWindow({
      width: 800,
      height: 500,
      title: opts.title || 'Terminal',
      icon: join(__dirname, '../../../../resources/icon.png'),
      backgroundColor: '#1a1d23',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    const termId = encodeURIComponent(opts.terminalId);
    const title = encodeURIComponent(opts.title || 'Terminal');
    popWin.loadFile(join(__dirname, '../../../../packages/ui/src/renderer/popout.html'), {
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

  // ---------------------------------------------------------------------------
  // (history, comm, tasks, knowledge, discover, system, mcp, crash handlers
  //  removed — all handled via createRouter() / mountIpcBridge above.)
  // ---------------------------------------------------------------------------
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
  bridges.init();

  loadedPlugins = discoverPlugins(join(__dirname, '..', '..', '..', '..', 'node_modules'));
  setupPluginIPC(loadedPlugins);
  if (loadedPlugins.length > 0) {
    registerPluginProtocol(loadedPlugins);
  }

  setupIPC();
  mainWindow = createWindow();
  createTray();
  // Note: config watcher and history/system stats listeners are wired
  // inside setupIPC() — they emit through the router so the renderer
  // receives them via the same push channels the WS server uses.
  stopConfigWatcher = () => {}; // disposed implicitly when bridges.close() runs

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
  bridges.close();
  unmountIpcBridge?.();
  unmountIpcBridge = null;
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
