import { app, BrowserWindow, dialog, ipcMain, Tray, Menu, nativeImage, shell, Notification } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, watch } from 'fs';
import type { FSWatcher } from 'fs';
import { homedir } from 'os';
import { spawn } from 'child_process';
import http from 'http';
import { TerminalManager, HistoryEntry } from './terminal-manager.js';
import { startMonitoring, stopMonitoring, getSystemStats, onStatsUpdate } from './system-monitor.js';
import { setupCrashHandlers, writeCrashLog, hasRecentCrashLogs, CRASH_LOG_DIR } from './crash-reporter.js';

setupCrashHandlers();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Live reload in development — watches renderer files
try {
  require('electron-reload')(join(__dirname, '../../src/renderer'), {
    electron: join(__dirname, '../../node_modules/.bin/electron'),
  });
} catch {
  // electron-reload not available in production builds
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let saveInterval: ReturnType<typeof setInterval> | null = null;
let trayTooltipInterval: ReturnType<typeof setInterval> | null = null;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let updateCheckInterval: ReturnType<typeof setInterval> | null = null;
let configWatcher: FSWatcher | null = null;
const terminalManager = new TerminalManager();

// ---------------------------------------------------------------------------
// Dashboard Health Check State
// ---------------------------------------------------------------------------

type ServiceStatus = 'up' | 'down' | 'unknown';

interface DashboardStatus {
  comm: ServiceStatus;
  tasks: ServiceStatus;
  knowledge: ServiceStatus;
}

const dashboardStatus: DashboardStatus = {
  comm: 'unknown',
  tasks: 'unknown',
  knowledge: 'unknown',
};

const SERVICE_KEY_MAP: Record<string, keyof DashboardStatus> = {
  'agent-comm': 'comm',
  'agent-tasks': 'tasks',
  'agent-knowledge': 'knowledge',
};

// ---------------------------------------------------------------------------
// Config File (~/.agent-desk/config.json) — F6
// ---------------------------------------------------------------------------

const CONFIG_DIR = join(homedir(), '.agent-desk');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface ConfigData {
  version: number;
  settings: Record<string, unknown>;
  profiles: Array<Record<string, unknown>>;
  workspaces: Record<string, unknown>;
}

const DEFAULT_CONFIG: ConfigData = {
  version: 1,
  settings: {},
  profiles: [],
  workspaces: {},
};

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

function readConfig(): ConfigData {
  ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(data: ConfigData): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

let _configWriteInProgress = false;

function watchConfig(): void {
  if (configWatcher) return;
  ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  }
  try {
    configWatcher = watch(CONFIG_FILE, { persistent: false }, (eventType) => {
      if (eventType === 'change' && !_configWriteInProgress && mainWindow) {
        try {
          const data = readConfig();
          mainWindow.webContents.send('config:changed', data);
        } catch {
          // file may be mid-write
        }
      }
    });
  } catch {
    // watch not supported on this platform/fs
  }
}

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

// Resolve bundled MCP server directory, falling back to user's local install
function findPackageDir(name: string, fallback: string): string {
  const candidates = [
    join(__dirname, '..', 'node_modules', name),
    join(__dirname, '..', '..', 'node_modules', name),
    join(process.resourcesPath || '', 'app', 'node_modules', name),
    join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules', name),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'package.json'))) return dir;
  }
  return fallback;
}

// Dashboard services to auto-start
const DASHBOARDS = [
  {
    name: 'agent-comm',
    port: 3421,
    dir: findPackageDir('agent-comm', join(homedir(), '.claude', 'mcp-servers', 'agent-comm')),
    start: 'node dist/server.js',
  },
  {
    name: 'agent-tasks',
    port: 3422,
    dir: findPackageDir('agent-tasks', join(homedir(), '.claude', 'mcp-servers', 'agent-tasks')),
    start: 'node dist/server.js',
  },
  {
    name: 'agent-knowledge',
    port: 3423,
    dir: findPackageDir('agent-knowledge', join(homedir(), '.claude', 'mcp-servers', 'agent-knowledge')),
    start: 'node dist/dashboard.js',
  },
];

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: '/', timeout: 2000 }, () => resolve(true));
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureDashboards(): Promise<void> {
  for (const dash of DASHBOARDS) {
    if (!existsSync(dash.dir)) {
      process.stderr.write(`[agent-desk] ${dash.name}: directory not found at ${dash.dir}, skipping\n`);
      continue;
    }
    const running = await checkPort(dash.port);
    if (running) {
      process.stderr.write(`[agent-desk] ${dash.name}: already running on port ${dash.port}\n`);
      continue;
    }
    try {
      const [cmd, ...args] = dash.start.split(' ');
      const child = spawn(cmd, args, {
        cwd: dash.dir,
        stdio: 'ignore',
        detached: true,
        shell: true,
        windowsHide: true,
        env: { ...process.env },
      });
      child.unref();
      process.stderr.write(`[agent-desk] ${dash.name}: started on port ${dash.port} (pid ${child.pid})\n`);
    } catch (err) {
      process.stderr.write(`[agent-desk] ${dash.name}: failed to start — ${err}\n`);
    }
  }
}

async function checkDashboardHealth(): Promise<void> {
  for (const dash of DASHBOARDS) {
    const key = SERVICE_KEY_MAP[dash.name];
    if (!key) continue;

    const dirExists = existsSync(dash.dir);
    if (!dirExists) {
      // Service not installed — keep as unknown, don't flag as down
      if (dashboardStatus[key] !== 'unknown') {
        dashboardStatus[key] = 'unknown';
        broadcastDashboardStatus();
      }
      continue;
    }

    const running = await checkPort(dash.port);
    const prev = dashboardStatus[key];
    const next: ServiceStatus = running ? 'up' : 'down';

    if (next === 'down') {
      // Attempt restart
      try {
        const [cmd, ...args] = dash.start.split(' ');
        const child = spawn(cmd, args, {
          cwd: dash.dir,
          stdio: 'ignore',
          detached: true,
          shell: true,
          windowsHide: true,
          env: { ...process.env },
        });
        child.unref();
        process.stderr.write(`[agent-desk] health: restarting ${dash.name} on port ${dash.port}\n`);
      } catch (err) {
        process.stderr.write(`[agent-desk] health: failed to restart ${dash.name} — ${err}\n`);
      }
    }

    dashboardStatus[key] = next;
    if (prev !== next) {
      process.stderr.write(`[agent-desk] health: ${dash.name} ${prev} -> ${next}\n`);
      broadcastDashboardStatus();
    }
  }
}

function broadcastDashboardStatus(): void {
  if (mainWindow) {
    try {
      mainWindow.webContents.send('dashboard:status-changed', { ...dashboardStatus });
    } catch {
      /* window may be closed */
    }
  }
}

function startHealthChecks(): void {
  // Run initial check after a short delay (let services from ensureDashboards start)
  setTimeout(async () => {
    await checkDashboardHealth();
  }, 5000);

  // Then every 30 seconds
  healthCheckInterval = setInterval(() => {
    checkDashboardHealth();
  }, 30000);
}

// Session persistence
const SESSION_DIR = join(homedir(), '.agent-desk');
const SESSION_FILE = join(SESSION_DIR, 'sessions.json');
const BUFFER_DIR = join(SESSION_DIR, 'buffers');

interface SessionTerminalData {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  title: string;
  createdAt: string;
  status: string;
  exitCode?: number | null;
  agentName?: string | null;
  profileName?: string | null;
}

interface SessionData {
  version?: number;
  savedAt?: string;
  terminals: SessionTerminalData[];
  activeTerminalId?: string;
  windowBounds?: { x: number; y: number; width: number; height: number };
  activeView?: string;
  layout?: unknown;
}

function ensureSessionDir(): void {
  if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true });
  if (!existsSync(BUFFER_DIR)) mkdirSync(BUFFER_DIR, { recursive: true });
}

// Layout state saved from renderer via IPC
let _savedLayout: unknown = null;

function saveSession(): void {
  try {
    ensureSessionDir();
    const allTerminals = terminalManager.list();
    const runningTerminals = allTerminals.filter((t) => t.status === 'running');
    const terminals: SessionTerminalData[] = runningTerminals.map((t) => ({
      id: t.id,
      command: t.command,
      args: t.args,
      cwd: t.cwd,
      title: t.title,
      createdAt: t.createdAt,
      status: t.status,
      exitCode: t.exitCode,
      agentName: t.agentName,
      profileName: t.profileName,
    }));

    const bounds = mainWindow?.getBounds();
    const session: SessionData = {
      version: 2,
      savedAt: new Date().toISOString(),
      terminals,
      windowBounds: bounds,
      layout: _savedLayout,
    };

    writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));

    // Save output buffers for running terminals only
    const activeIds = new Set(runningTerminals.map((t) => t.id));
    for (const t of runningTerminals) {
      const buffer = terminalManager.getBuffer(t.id);
      if (buffer) {
        const bufContent = buffer.length > 100_000 ? buffer.slice(-100_000) : buffer;
        writeFileSync(join(BUFFER_DIR, `${t.id}.buf`), bufContent, 'utf-8');
      }
    }

    // Clean up stale buffer files
    try {
      const bufFiles = readdirSync(BUFFER_DIR);
      for (const f of bufFiles) {
        const id = f.replace(/\.buf$/, '');
        if (!activeIds.has(id)) {
          unlinkSync(join(BUFFER_DIR, f));
        }
      }
    } catch {
      /* buffer dir may not exist */
    }
  } catch (err) {
    console.error('Failed to save session:', err);
  }
}

function loadSession(): SessionData | null {
  if (!existsSync(SESSION_FILE)) return null;
  try {
    return JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
  } catch {
    return null;
  }
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
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  win.loadFile(join(__dirname, '../../src/renderer/index.html'));

  let trayNotified = false;
  win.on('close', (e) => {
    saveSession();
    if (tray) {
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
  ipcMain.handle('session:getBuffer', (_e, id: string) => {
    const safeId = id.replace(/[^a-zA-Z0-9-]/g, '');
    if (!safeId) return null;
    const bufFile = join(BUFFER_DIR, `${safeId}.buf`);
    if (existsSync(bufFile)) {
      try {
        return readFileSync(bufFile, 'utf-8');
      } catch {
        return null;
      }
    }
    return null;
  });

  ipcMain.handle('session:autoSave', () => {
    saveSession();
    return true;
  });

  ipcMain.handle('session:replayBuffer', (_e, id: string) => {
    const safeId = id.replace(/[^a-zA-Z0-9-]/g, '');
    if (!safeId) return null;
    const bufFile = join(BUFFER_DIR, `${safeId}.buf`);
    if (!existsSync(bufFile)) return null;
    try {
      return readFileSync(bufFile, 'utf-8');
    } catch {
      return null;
    }
  });

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
    writeFileSync(filePath, content, 'utf-8');
    return true;
  });

  ipcMain.handle('file:stat', (_e, filePath: string) => {
    try {
      const s = statSync(filePath);
      return { isDirectory: s.isDirectory(), isFile: s.isFile(), size: s.size };
    } catch {
      return null;
    }
  });

  ipcMain.handle('file:dirname', (_e, filePath: string) => {
    return dirname(filePath);
  });

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
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    const termId = encodeURIComponent(opts.terminalId);
    const title = encodeURIComponent(opts.title || 'Terminal');
    popWin.loadFile(join(__dirname, '../../src/renderer/popout.html'), {
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

  // Config file management (F6)
  ipcMain.handle('config:read', () => readConfig());
  ipcMain.handle('config:write', (_e, data: ConfigData) => {
    _configWriteInProgress = true;
    try {
      writeConfig(data);
    } finally {
      setTimeout(() => {
        _configWriteInProgress = false;
      }, 100);
    }
  });
  ipcMain.handle('config:getPath', () => CONFIG_FILE);

  // Keybindings persistence (F5)
  const KEYBINDINGS_FILE = join(SESSION_DIR, 'keybindings.json');

  ipcMain.handle('keybindings:read', () => {
    ensureSessionDir();
    if (existsSync(KEYBINDINGS_FILE)) {
      try {
        return JSON.parse(readFileSync(KEYBINDINGS_FILE, 'utf-8'));
      } catch {
        return {};
      }
    }
    return {};
  });

  ipcMain.handle('keybindings:write', (_e, data: Record<string, string | null>) => {
    ensureSessionDir();
    writeFileSync(KEYBINDINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
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

  // --- Command History (F13) ---
  ipcMain.handle('history:get', (_e, limit?: number, search?: string) => {
    return getHistory(limit, search);
  });

  ipcMain.handle('history:clear', () => {
    commandHistory = [];
    saveHistory();
    return true;
  });

  // Listen for history entries from terminal manager
  terminalManager.onHistoryEntry((entry: HistoryEntry) => {
    addHistoryEntry(entry);
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
  // Dashboard Health Status
  // ---------------------------------------------------------------------------

  ipcMain.handle('dashboard:get-status', () => ({ ...dashboardStatus }));

  // ---------------------------------------------------------------------------
  // Webview Bridge — relay IPC between dashboard webviews and renderer (F14)
  // ---------------------------------------------------------------------------

  ipcMain.handle('webview:get-preload-path', () => {
    return join(__dirname, '../preload/webview-bridge.js');
  });

  // Forward focus-terminal request from webview -> renderer
  ipcMain.handle('webview:focus-terminal', async (_e, agentName: string) => {
    if (!mainWindow) return false;
    return await mainWindow.webContents.executeJavaScript(
      `window.__agentDeskBridge?.focusTerminal(${JSON.stringify(agentName)}) ?? false`,
    );
  });

  ipcMain.handle('webview:focus-terminal-by-id', async (_e, terminalId: string) => {
    if (!mainWindow) return false;
    return await mainWindow.webContents.executeJavaScript(
      `window.__agentDeskBridge?.focusTerminalById(${JSON.stringify(terminalId)}) ?? false`,
    );
  });

  ipcMain.handle('webview:paste-to-terminal', async (_e, text: string) => {
    if (!mainWindow) return false;
    return await mainWindow.webContents.executeJavaScript(
      `window.__agentDeskBridge?.pasteToTerminal(${JSON.stringify(text)}) ?? false`,
    );
  });

  ipcMain.handle('webview:get-terminals', async () => {
    if (!mainWindow) return [];
    return await mainWindow.webContents.executeJavaScript(`window.__agentDeskBridge?.getTerminals() ?? []`);
  });

  ipcMain.handle('webview:create-terminal', async (_e, opts: { cwd?: string; command?: string; args?: string[] }) => {
    if (!mainWindow) return null;
    return await mainWindow.webContents.executeJavaScript(
      `window.__agentDeskBridge?.createTerminal(${JSON.stringify(opts)}) ?? null`,
    );
  });

  // Renderer pushes terminal updates -> main broadcasts to all webviews
  ipcMain.on('webview:broadcast-terminal-update', (_e, terminals: unknown) => {
    if (!mainWindow) return;
    mainWindow.webContents.send('webview:terminal-updated', terminals);
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
}

// ---------------------------------------------------------------------------
// Command History Persistence (F13)
// ---------------------------------------------------------------------------

const HISTORY_FILE = join(SESSION_DIR, 'history.json');
const HISTORY_MAX = 10_000;

let commandHistory: HistoryEntry[] = [];
let historySaveTimer: ReturnType<typeof setTimeout> | null = null;

function loadHistory(): void {
  if (!existsSync(HISTORY_FILE)) return;
  try {
    commandHistory = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
    if (!Array.isArray(commandHistory)) commandHistory = [];
    // Trim to max
    if (commandHistory.length > HISTORY_MAX) {
      commandHistory = commandHistory.slice(-HISTORY_MAX);
    }
  } catch {
    commandHistory = [];
  }
}

function saveHistory(): void {
  ensureSessionDir();
  try {
    writeFileSync(HISTORY_FILE, JSON.stringify(commandHistory), 'utf-8');
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

function debouncedSaveHistory(): void {
  if (historySaveTimer) clearTimeout(historySaveTimer);
  historySaveTimer = setTimeout(saveHistory, 2000);
}

function addHistoryEntry(entry: HistoryEntry): void {
  commandHistory.push(entry);
  if (commandHistory.length > HISTORY_MAX) {
    commandHistory = commandHistory.slice(-HISTORY_MAX);
  }
  debouncedSaveHistory();
}

function getHistory(limit?: number, search?: string): HistoryEntry[] {
  let results = commandHistory;
  if (search) {
    const q = search.toLowerCase();
    results = results.filter((e) => e.command.toLowerCase().includes(q));
  }
  const reversed = results.slice().reverse();
  if (limit && limit > 0) {
    return reversed.slice(0, limit);
  }
  return reversed;
}

// ---------------------------------------------------------------------------
// Auto-Updater (electron-updater)
// ---------------------------------------------------------------------------

function setupAutoUpdater(): void {
  try {
    import('electron-updater').then(({ autoUpdater }) => {
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
  loadHistory();
  setupIPC();
  await ensureDashboards();
  mainWindow = createWindow();
  createTray();
  watchConfig();
  startHealthChecks();

  setupAutoUpdater();

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
  saveSession();
  stopMonitoring();
  if (saveInterval) {
    clearInterval(saveInterval);
    saveInterval = null;
  }
  if (trayTooltipInterval) {
    clearInterval(trayTooltipInterval);
    trayTooltipInterval = null;
  }
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
  if (configWatcher) {
    configWatcher.close();
    configWatcher = null;
  }
  terminalManager.cleanup();
});
