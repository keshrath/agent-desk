// Workspace handlers — project-centric workspace records (task #93a).
//
// Thin wrappers around workspace-store.ts: read/mutate/write the ConfigData,
// and (for workspace:open) spawn terminals through the TerminalManager with
// the workspace's rootPath + merged env.

import type { RequestHandlers } from '../transport/router.js';
import type { TerminalManager } from '../terminal-manager.js';
import type { Workspace } from '../transport/channels.js';
import { readConfig, writeConfig } from '../config-store.js';
import {
  listWorkspaces,
  getWorkspace,
  saveWorkspace as storeSaveWorkspace,
  deleteWorkspace as storeDeleteWorkspace,
  touchWorkspace,
  getRecentWorkspaces,
  mergeWorkspaceEnv,
} from '../workspace-store.js';

export interface WorkspaceHandlerDeps {
  terminals: TerminalManager;
}

type WorkspaceChannels =
  | 'workspace:list'
  | 'workspace:get'
  | 'workspace:save'
  | 'workspace:delete'
  | 'workspace:open'
  | 'workspace:recent';

export function buildWorkspaceHandlers(deps: WorkspaceHandlerDeps): Pick<RequestHandlers, WorkspaceChannels> {
  const { terminals } = deps;

  return {
    'workspace:list': () => listWorkspaces(readConfig()),

    'workspace:get': (id: string) => getWorkspace(readConfig(), id),

    'workspace:save': (ws: Workspace) => {
      try {
        const next = storeSaveWorkspace(readConfig(), ws);
        writeConfig(next);
        return true;
      } catch {
        return false;
      }
    },

    'workspace:delete': (id: string) => {
      const cfg = readConfig();
      if (!(id in cfg.workspaces)) return false;
      writeConfig(storeDeleteWorkspace(cfg, id));
      return true;
    },

    'workspace:open': (id: string) => {
      const cfg = readConfig();
      const ws = getWorkspace(cfg, id);
      if (!ws) return { openedTerminals: [] };

      const openedTerminals: string[] = [];
      const cwd = ws.rootPath && ws.rootPath.length > 0 ? ws.rootPath : undefined;
      const env = mergeWorkspaceEnv(ws);

      // Spawn a terminal for each agent profile attached to the workspace.
      // We pass the profile name as the `command` so the TerminalManager's
      // existing default-shell fallback takes over when a profile isn't a
      // real binary — the UI layer resolves profile→command on its side via
      // createTerminalFromProfile, but here in core we just spawn a shell in
      // the workspace root so the user sees the project open immediately.
      const agents = Array.isArray(ws.agents) && ws.agents.length > 0 ? ws.agents : [''];
      for (const _profile of agents) {
        void _profile;
        try {
          const term = terminals.spawn(cwd, undefined, undefined, undefined, undefined, env);
          openedTerminals.push(term.id);
        } catch {
          // best-effort: skip agents that fail to spawn (e.g. missing shell)
        }
      }

      // Bump lastOpened so the recent list reflects the click.
      writeConfig(touchWorkspace(cfg, id));

      return { openedTerminals };
    },

    'workspace:recent': (limit?: number) => getRecentWorkspaces(readConfig(), limit),
  };
}
