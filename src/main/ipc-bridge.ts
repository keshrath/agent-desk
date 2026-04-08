// Wires an @agent-desk/core Router to Electron's ipcMain.
//
// For every channel in the router's request map this registers an
// `ipcMain.handle(channel, …)` that dispatches into router.request(channel, …).
// For every command channel it registers `ipcMain.on(channel, …)`.
//
// Push events are wired separately by the host (it owns the BrowserWindow
// and decides when to forward router.on('foo') → win.webContents.send('foo')).

import { ipcMain, type BrowserWindow } from 'electron';
import type { Router, PushChannel, PushChannelMap } from '@agent-desk/core';

export interface MountIpcBridgeOptions {
  router: Router;
  /** Push channels we should forward to the given window's webContents. */
  pushChannels: PushChannel[];
  getWindow: () => BrowserWindow | null;
}

export function mountIpcBridge(opts: MountIpcBridgeOptions): () => void {
  const { router, pushChannels, getWindow } = opts;
  const r = router as unknown as {
    request: (ch: string, ...args: unknown[]) => Promise<unknown>;
    command: (ch: string, ...args: unknown[]) => void;
  };

  for (const ch of router.requestChannels) {
    ipcMain.handle(ch, (_e, ...args) => r.request(ch, ...args));
  }
  for (const ch of router.commandChannels) {
    ipcMain.on(ch, (_e, ...args) => r.command(ch, ...args));
  }

  const unsubs: Array<() => void> = [];
  for (const ch of pushChannels) {
    const off = router.on(ch, ((...args: unknown[]) => {
      const win = getWindow();
      if (!win) return;
      try {
        win.webContents.send(ch, ...args);
      } catch {
        /* window may be closed */
      }
    }) as (...a: PushChannelMap[typeof ch]) => void);
    unsubs.push(off);
  }

  return () => {
    for (const ch of router.requestChannels) ipcMain.removeHandler(ch);
    for (const ch of router.commandChannels) ipcMain.removeAllListeners(ch);
    for (const off of unsubs) off();
  };
}
