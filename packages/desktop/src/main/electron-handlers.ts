// Electron-only IPC handlers — channels NOT in the @agent-desk/core contract
// because they touch BrowserWindow / dialog / shell / Notification / app.
// These don't go through the router; they live as direct ipcMain.handle/.on.

import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from 'electron';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import type { TerminalManager } from '@agent-desk/core';

export interface ElectronHandlersDeps {
  getMainWindow: () => BrowserWindow | null;
  approvedWritePaths: Set<string>;
  terminals: TerminalManager;
  /** Absolute path to the resources directory (icon files etc.). */
  resourcesDir: string;
  /** Absolute path to packages/ui/src/renderer for popout.html lookups. */
  rendererDir: string;
  /** Absolute path to packages/desktop/dist/preload/index.js for popouts. */
  preloadPath: string;
}

export function mountElectronHandlers(deps: ElectronHandlersDeps): () => void {
  const { getMainWindow, approvedWritePaths, terminals, resourcesDir, rendererDir, preloadPath } = deps;

  // Window controls
  ipcMain.on('window:minimize', () => getMainWindow()?.minimize());
  ipcMain.on('window:maximize', () => {
    const win = getMainWindow();
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
  });
  ipcMain.on('window:close', () => getMainWindow()?.close());
  ipcMain.on('window:flashFrame', () => getMainWindow()?.flashFrame(true));

  // App settings
  ipcMain.on('app:setLoginItem', (_e, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
  });

  // Desktop notification
  ipcMain.on('app:notify', (_e, title: string, body: string) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  // Open directory dialog
  ipcMain.handle('dialog:openDirectory', async (_e, options: { defaultPath?: string }) => {
    const win = getMainWindow() || BrowserWindow.getFocusedWindow();
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
      const main = getMainWindow();
      if (!main) return null;
      const result = await dialog.showSaveDialog(main, {
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
  ipcMain.handle(
    'terminal:popout',
    (_e, opts: { terminalId: string; title: string; cols?: number; rows?: number }) => {
      const popWin = new BrowserWindow({
        width: 800,
        height: 500,
        title: opts.title || 'Terminal',
        icon: join(resourcesDir, 'icon.png'),
        backgroundColor: '#1a1d23',
        autoHideMenuBar: true,
        webPreferences: {
          preload: preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      });
      const termId = encodeURIComponent(opts.terminalId);
      const title = encodeURIComponent(opts.title || 'Terminal');
      popWin.loadFile(join(rendererDir, 'popout.html'), {
        query: { terminalId: termId, title: title },
      });
      terminals.subscribe(opts.terminalId, {
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
    },
  );

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

  return () => {
    for (const ch of [
      'window:minimize',
      'window:maximize',
      'window:close',
      'window:flashFrame',
      'app:setLoginItem',
      'app:notify',
      'shell:openPath',
      'shell:openExternal',
    ]) {
      ipcMain.removeAllListeners(ch);
    }
    for (const ch of ['dialog:openDirectory', 'dialog:saveFile', 'terminal:popout']) {
      ipcMain.removeHandler(ch);
    }
  };
}
