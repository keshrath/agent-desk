import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('agentDesk', {
  // Terminal API
  terminal: {
    create: (opts?: {
      cwd?: string;
      command?: string;
      args?: string[];
      cols?: number;
      rows?: number;
      env?: Record<string, string>;
    }) => ipcRenderer.invoke('terminal:create', opts || {}),
    write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    kill: (id: string) => ipcRenderer.invoke('terminal:kill', id),
    signal: (id: string, signal: string) => ipcRenderer.invoke('terminal:signal', id, signal),
    restart: (id: string) => ipcRenderer.invoke('terminal:restart', id),
    popout: (opts: { terminalId: string; title: string }) => ipcRenderer.invoke('terminal:popout', opts),
    list: () => ipcRenderer.invoke('terminal:list'),
    subscribe: (id: string) => ipcRenderer.send('terminal:subscribe', id),
    unsubscribe: (id: string) => ipcRenderer.send('terminal:unsubscribe', id),
    onData: (callback: (id: string, data: string) => void) => {
      const listener = (_e: unknown, id: string, data: string) => callback(id, data);
      ipcRenderer.on('terminal:data', listener);
      return () => ipcRenderer.removeListener('terminal:data', listener);
    },
    onExit: (callback: (id: string, exitCode: number) => void) => {
      const listener = (_e: unknown, id: string, exitCode: number) => callback(id, exitCode);
      ipcRenderer.on('terminal:exit', listener);
      return () => ipcRenderer.removeListener('terminal:exit', listener);
    },
  },

  // Session persistence
  session: {
    save: () => ipcRenderer.invoke('session:save'),
    load: () => ipcRenderer.invoke('session:load'),
    getBuffer: (id: string) => ipcRenderer.invoke('session:getBuffer', id),
    autoSave: () => ipcRenderer.invoke('session:autoSave'),
    replayBuffer: (id: string) => ipcRenderer.invoke('session:replayBuffer', id),
    setAgentInfo: (id: string, agentName: string | null, profileName: string | null) =>
      ipcRenderer.invoke('session:setAgentInfo', id, agentName, profileName),
    saveLayout: (layout: unknown) => ipcRenderer.invoke('session:saveLayout', layout),
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    flashFrame: () => ipcRenderer.send('window:flashFrame'),
  },

  // Desktop notifications
  notify: (title: string, body: string) => ipcRenderer.send('app:notify', title, body),

  // Actions from main process
  onAction: (callback: (action: string) => void) => {
    ipcRenderer.on('action:new-terminal', () => callback('new-terminal'));
    return () => ipcRenderer.removeAllListeners('action:new-terminal');
  },

  onOpenCwd: (callback: (cwd: string | null, command: string | null) => void) => {
    const listener = (_e: unknown, cwd: string | null, command: string | null) => callback(cwd, command);
    ipcRenderer.on('action:open-cwd', listener);
    return () => ipcRenderer.removeListener('action:open-cwd', listener);
  },

  // Dialogs
  dialog: {
    saveFile: (options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) =>
      ipcRenderer.invoke('dialog:saveFile', options || {}),
    openDirectory: (options?: { defaultPath?: string }) => ipcRenderer.invoke('dialog:openDirectory', options || {}),
  },

  // File operations
  file: {
    write: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
    stat: (path: string) => ipcRenderer.invoke('file:stat', path),
    dirname: (path: string) => ipcRenderer.invoke('file:dirname', path),
  },

  // Config file (F6)
  config: {
    read: () => ipcRenderer.invoke('config:read'),
    write: (data: Record<string, unknown>) => ipcRenderer.invoke('config:write', data),
    getPath: () => ipcRenderer.invoke('config:getPath'),
    onChange: (callback: (data: Record<string, unknown>) => void) => {
      const listener = (_e: unknown, data: Record<string, unknown>) => callback(data);
      ipcRenderer.on('config:changed', listener);
      return () => ipcRenderer.removeListener('config:changed', listener);
    },
  },

  // App settings
  setLoginItem: (enabled: boolean) => ipcRenderer.send('app:setLoginItem', enabled),

  // Keybindings (F5)
  keybindings: {
    read: () => ipcRenderer.invoke('keybindings:read'),
    write: (data: Record<string, string | null>) => ipcRenderer.invoke('keybindings:write', data),
  },

  // Command History (F13)
  history: {
    get: (limit?: number, search?: string) => ipcRenderer.invoke('history:get', limit, search),
    clear: () => ipcRenderer.invoke('history:clear'),
    onNew: (callback: (entry: unknown) => void) => {
      const listener = (_e: unknown, entry: unknown) => callback(entry);
      ipcRenderer.on('history:new', listener);
      return () => ipcRenderer.removeListener('history:new', listener);
    },
  },

  // Dashboard health status
  dashboard: {
    getStatus: () => ipcRenderer.invoke('dashboard:get-status'),
    onStatusChanged: (callback: (status: { comm: string; tasks: string; knowledge: string }) => void) => {
      const listener = (_e: unknown, status: { comm: string; tasks: string; knowledge: string }) => callback(status);
      ipcRenderer.on('dashboard:status-changed', listener);
      return () => ipcRenderer.removeListener('dashboard:status-changed', listener);
    },
  },

  // System Monitor
  system: {
    getStats: () => ipcRenderer.invoke('system:stats'),
    startMonitoring: () => ipcRenderer.invoke('system:start-monitoring'),
    stopMonitoring: () => ipcRenderer.invoke('system:stop-monitoring'),
    onStatsUpdate: (callback: (stats: unknown) => void) => {
      const listener = (_e: unknown, stats: unknown) => callback(stats);
      ipcRenderer.on('system:stats-update', listener);
      return () => ipcRenderer.removeListener('system:stats-update', listener);
    },
  },

  // App Updates
  app: {
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
    onUpdateStatus: (callback: (status: { type: string; message: string }) => void) => {
      const listener = (_e: unknown, status: { type: string; message: string }) => callback(status);
      ipcRenderer.on('app:updateStatus', listener);
      return () => ipcRenderer.removeListener('app:updateStatus', listener);
    },
    onCrashDetected: (callback: (dir: string) => void) => {
      const listener = (_e: unknown, dir: string) => callback(dir);
      ipcRenderer.on('app:crashDetected', listener);
      return () => ipcRenderer.removeListener('app:crashDetected', listener);
    },
    reportError: (errorData: { message: string; stack?: string; source: string }) =>
      ipcRenderer.invoke('app:reportError', errorData),
    getCrashLogDir: () => ipcRenderer.invoke('app:getCrashLogDir'),
  },

  // Shell
  openExternal: (url: string) => ipcRenderer.send('shell:openExternal', url),
  openPath: (dirPath: string) => ipcRenderer.send('shell:openPath', dirPath),

  // Webview bridge (F14)
  webview: {
    /** Get the absolute path to the webview bridge preload script */
    getPreloadPath: () => ipcRenderer.invoke('webview:get-preload-path'),
    /** Broadcast terminal state to all webviews (called from renderer) */
    broadcastTerminalUpdate: (terminals: Array<{ id: string; title: string; status: string; agentName?: string }>) =>
      ipcRenderer.send('webview:broadcast-terminal-update', terminals),
    /** Listen for terminal updates relayed from main (for webviews in renderer) */
    onTerminalUpdate: (
      callback: (terminals: Array<{ id: string; title: string; status: string; agentName?: string }>) => void,
    ) => {
      const listener = (
        _e: unknown,
        terminals: Array<{ id: string; title: string; status: string; agentName?: string }>,
      ) => callback(terminals);
      ipcRenderer.on('webview:terminal-updated', listener);
      return () => ipcRenderer.removeListener('webview:terminal-updated', listener);
    },
  },
});
