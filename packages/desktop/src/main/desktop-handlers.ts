// Desktop-specific handler overrides spread on top of the @agent-desk/core
// defaults. These override channels where the desktop has more context than
// the headless core can provide:
//
//   - session:save / session:autoSave inject the live BrowserWindow bounds
//     and the renderer-saved layout into the saved session blob
//   - session:saveLayout stashes the layout in a host-owned closure
//   - file:write enforces a path-approval allowlist populated by dialog:saveFile
//   - terminal:create wraps spawn errors in a friendlier message
//   - terminal:subscribe wires the pty data callbacks into the main window's
//     webContents.send (the core default is a no-op because the host owns the
//     transport)
//
// Keeping these in their own module makes the main bootstrap (index.ts) skinny
// and the desktop-specific overrides discoverable.

import type { BrowserWindow } from 'electron';
import {
  type RequestHandlers,
  type CommandHandlers,
  type TerminalManager,
  type HistoryStore,
  type AgentBridges,
  type LoadedPlugin,
  saveSession as coreSaveSession,
  fileWrite,
  buildDefaultRequestHandlers,
  buildDefaultCommandHandlers,
} from '@agent-desk/core';

export interface DesktopHandlersDeps {
  terminals: TerminalManager;
  history: HistoryStore;
  bridges: AgentBridges;
  plugins: LoadedPlugin[];
  /** Lazy main window getter — created after handlers are built. */
  getMainWindow: () => BrowserWindow | null;
  /** Renderer-saved layout reader — captured by reference. */
  getSavedLayout: () => unknown;
  /** Renderer-saved layout writer — called by session:saveLayout. */
  setSavedLayout: (layout: unknown) => void;
  /** Path-approval allowlist populated by dialog:saveFile. */
  approvedWritePaths: Set<string>;
}

export function buildDesktopRequestHandlers(deps: DesktopHandlersDeps): RequestHandlers {
  const { terminals, history, bridges, plugins, getMainWindow, getSavedLayout, setSavedLayout, approvedWritePaths } =
    deps;

  return {
    ...buildDefaultRequestHandlers({ terminals, history, bridges, plugins }),

    'session:save': () => {
      coreSaveSession(terminals, {
        windowBounds: getMainWindow()?.getBounds(),
        layout: getSavedLayout(),
      });
    },
    'session:autoSave': () => {
      coreSaveSession(terminals, {
        windowBounds: getMainWindow()?.getBounds(),
        layout: getSavedLayout(),
      });
    },
    'session:saveLayout': (layout) => {
      setSavedLayout(layout);
      return true;
    },

    'file:write': (filePath, content) => {
      if (!approvedWritePaths.has(filePath)) {
        return { ok: false, error: 'File write denied: path not approved via save dialog' };
      }
      approvedWritePaths.delete(filePath);
      try {
        fileWrite(filePath, content);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },

    'terminal:create': (opts) => {
      try {
        const term = terminals.spawn(opts.cwd, opts.command, opts.args, opts.cols, opts.rows, opts.env);
        return { id: term.id, cwd: term.cwd, command: term.command, args: term.args, title: term.title };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to spawn terminal: ${msg}`);
      }
    },
  };
}

export function buildDesktopCommandHandlers(deps: DesktopHandlersDeps): CommandHandlers {
  const { terminals, history, bridges, plugins, getMainWindow } = deps;

  return {
    ...buildDefaultCommandHandlers({ terminals, history, bridges, plugins }),

    'terminal:subscribe': (id) => {
      terminals.subscribe(id, {
        send: (data: string) => {
          try {
            getMainWindow()?.webContents.send('terminal:data', id, data);
          } catch {
            /* window may be destroyed */
          }
        },
        sendExit: (exitCode: number) => {
          try {
            getMainWindow()?.webContents.send('terminal:exit', id, exitCode);
          } catch {
            /* window may be destroyed */
          }
        },
      });
    },
  };
}
