// @agent-desk/desktop preload — exposes `window.agentDesk` via Electron's
// contextBridge. The bucket structure comes from API_SHAPE in @agent-desk/core
// so this file stays one declarative thing per channel; adding a new channel
// in the future means: tick the contract + handler in core, tick api-shape.ts,
// done. No edits to this file.

import { contextBridge, ipcRenderer } from 'electron';
import { buildAgentDeskApi, type ApiTransport, type LocalOnlyBinding } from '@agent-desk/core';

const transport: ApiTransport = {
  request(channel, args) {
    return ipcRenderer.invoke(channel, ...args);
  },
  command(channel, args) {
    ipcRenderer.send(channel, ...args);
  },
  subscribe(channel, callback) {
    const listener = (_e: unknown, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  localOnly(tag, args) {
    return desktopLocalOnly(tag, args);
  },
};

function desktopLocalOnly(tag: LocalOnlyBinding['tag'], args: unknown[]): unknown {
  switch (tag) {
    case 'window.minimize':
      ipcRenderer.send('window:minimize');
      return;
    case 'window.maximize':
      ipcRenderer.send('window:maximize');
      return;
    case 'window.close':
      ipcRenderer.send('window:close');
      return;
    case 'window.flashFrame':
      ipcRenderer.send('window:flashFrame');
      return;
    case 'app.setLoginItem':
      ipcRenderer.send('app:setLoginItem', args[0]);
      return;
    case 'app.notify':
      ipcRenderer.send('app:notify', args[0], args[1]);
      return;
    case 'shell.openPath':
      ipcRenderer.send('shell:openPath', args[0]);
      return;
    case 'shell.openExternal':
      ipcRenderer.send('shell:openExternal', args[0]);
      return;
    case 'dialog.openDirectory':
      return ipcRenderer.invoke('dialog:openDirectory', args[0] || {});
    case 'dialog.saveFile':
      return ipcRenderer.invoke('dialog:saveFile', args[0] || {});
    case 'app.checkForUpdates':
      return ipcRenderer.invoke('app:checkForUpdates');
    case 'app.installUpdate':
      return ipcRenderer.invoke('app:installUpdate');
    case 'terminal.popout':
      return ipcRenderer.invoke('terminal:popout', args[0]);
    case 'app.onUpdateStatus':
      return subscribeOnce('app:updateStatus', args[0] as (...a: unknown[]) => void);
    case 'app.onCrashDetected':
      return subscribeOnce('app:crashDetected', args[0] as (...a: unknown[]) => void);
    case 'app.onAction':
      return subscribeOnce('action:new-terminal', args[0] as (...a: unknown[]) => void);
    case 'app.onOpenCwd':
      return subscribeOnce('action:open-cwd', args[0] as (...a: unknown[]) => void);
  }
}

function subscribeOnce(channel: string, callback: (...args: unknown[]) => void): () => void {
  const listener = (_e: unknown, ...args: unknown[]) => callback(...args);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const agentDesk = buildAgentDeskApi(transport);

contextBridge.exposeInMainWorld('agentDesk', agentDesk);
