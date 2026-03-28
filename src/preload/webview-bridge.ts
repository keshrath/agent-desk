/**
 * Webview Bridge — preload script injected into dashboard webviews.
 *
 * Exposes `window.agentDeskBridge` to dashboard code, allowing dashboards
 * to interact with agent-desk terminals (focus, paste, list, create, subscribe).
 * Communication flows: webview -> ipcRenderer -> main process -> renderer.
 */
import { contextBridge, ipcRenderer } from 'electron';

export interface TerminalInfo {
  id: string;
  title: string;
  status: string;
  agentName?: string;
}

contextBridge.exposeInMainWorld('agentDeskBridge', {
  /** Switch to the terminal running the given agent */
  focusTerminal(agentName: string): Promise<boolean> {
    return ipcRenderer.invoke('webview:focus-terminal', agentName);
  },

  /** Switch to a terminal by its ID */
  focusTerminalById(terminalId: string): Promise<boolean> {
    return ipcRenderer.invoke('webview:focus-terminal-by-id', terminalId);
  },

  /** Paste text into the currently active terminal */
  pasteToTerminal(text: string): Promise<boolean> {
    return ipcRenderer.invoke('webview:paste-to-terminal', text);
  },

  /** List all terminals with metadata */
  getTerminals(): Promise<TerminalInfo[]> {
    return ipcRenderer.invoke('webview:get-terminals');
  },

  /** Spawn a new terminal */
  createTerminal(opts?: { cwd?: string; command?: string; args?: string[] }): Promise<string | null> {
    return ipcRenderer.invoke('webview:create-terminal', opts || {});
  },

  /** Subscribe to terminal state changes */
  onTerminalUpdate(callback: (terminals: TerminalInfo[]) => void): () => void {
    const listener = (_e: Electron.IpcRendererEvent, terminals: TerminalInfo[]) => callback(terminals);
    ipcRenderer.on('webview:terminal-updated', listener);
    return () => ipcRenderer.removeListener('webview:terminal-updated', listener);
  },
});
