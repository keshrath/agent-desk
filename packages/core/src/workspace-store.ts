// Workspace store — pure functions operating on ConfigData.
//
// The channel handlers in handlers/workspace-handlers.ts stay thin and delegate
// here. These helpers are side-effect-free on their own (no disk I/O); the
// handler is responsible for readConfig() / writeConfig() around them. This
// keeps the store unit-testable without touching the filesystem.

import type { ConfigData } from './config-store.js';
import type { Workspace } from './transport/channels.js';

/** Return every workspace in insertion order. */
export function listWorkspaces(cfg: ConfigData): Workspace[] {
  return Object.values(cfg.workspaces);
}

/** Look up a workspace by id. */
export function getWorkspace(cfg: ConfigData, id: string): Workspace | null {
  if (!id) return null;
  return cfg.workspaces[id] ?? null;
}

/**
 * Insert-or-update a workspace. Mutates the config map in place and returns
 * a shallow-cloned ConfigData so callers can pass the result straight to
 * writeConfig() without surprising referential updates.
 *
 * Validation: id must be a non-empty string. All other fields use the
 * migration-helper defaults (empty string / array / map / defaults) when
 * missing so a partial payload from the UI still produces a valid record.
 */
export function saveWorkspace(cfg: ConfigData, ws: Workspace): ConfigData {
  if (!ws || typeof ws.id !== 'string' || ws.id.length === 0) {
    throw new Error('saveWorkspace: workspace.id is required');
  }
  const next: ConfigData = {
    ...cfg,
    workspaces: { ...cfg.workspaces, [ws.id]: normalizeWorkspace(ws) },
  };
  return next;
}

/** Remove a workspace by id. Returns the new config. */
export function deleteWorkspace(cfg: ConfigData, id: string): ConfigData {
  if (!id || !(id in cfg.workspaces)) return cfg;
  const nextMap: Record<string, Workspace> = { ...cfg.workspaces };
  delete nextMap[id];
  return { ...cfg, workspaces: nextMap };
}

/**
 * Touch a workspace's lastOpened timestamp. Returns the new config. No-op if
 * the workspace does not exist.
 */
export function touchWorkspace(cfg: ConfigData, id: string, now: number = Date.now()): ConfigData {
  const ws = cfg.workspaces[id];
  if (!ws) return cfg;
  return {
    ...cfg,
    workspaces: { ...cfg.workspaces, [id]: { ...ws, lastOpened: now } },
  };
}

/**
 * Return workspaces sorted for the recent/switcher UI:
 *   1. pinned first (stable, by name)
 *   2. then by lastOpened descending (newest first)
 *   3. unopened (lastOpened === 0) fall to the bottom
 *
 * The optional `limit` caps the result length.
 */
export function getRecentWorkspaces(cfg: ConfigData, limit?: number): Workspace[] {
  const all = Object.values(cfg.workspaces);
  const sorted = all.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.lastOpened !== b.lastOpened) return b.lastOpened - a.lastOpened;
    return a.name.localeCompare(b.name);
  });
  if (typeof limit === 'number' && limit > 0) return sorted.slice(0, limit);
  return sorted;
}

/**
 * Merge a workspace's env record on top of `process.env` for terminal spawn.
 * Undefined / non-string keys in ws.env are dropped. Returns a plain record
 * the TerminalManager can pass to pty.spawn.
 */
export function mergeWorkspaceEnv(ws: Workspace, base: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === 'string') out[k] = v;
  }
  if (ws.env && typeof ws.env === 'object') {
    for (const [k, v] of Object.entries(ws.env)) {
      if (typeof v === 'string') out[k] = v;
    }
  }
  return out;
}

/**
 * Normalize a workspace record coming from the UI. Clamps types so a JSON
 * round-trip through config.json cannot produce an invalid shape.
 */
function normalizeWorkspace(ws: Workspace): Workspace {
  return {
    id: ws.id,
    name: typeof ws.name === 'string' && ws.name ? ws.name : ws.id,
    rootPath: typeof ws.rootPath === 'string' ? ws.rootPath : '',
    color: typeof ws.color === 'string' && ws.color ? ws.color : '#6f42c1',
    env: ws.env && typeof ws.env === 'object' ? { ...ws.env } : {},
    agents: Array.isArray(ws.agents) ? ws.agents.slice() : [],
    pinned: typeof ws.pinned === 'boolean' ? ws.pinned : false,
    lastOpened: typeof ws.lastOpened === 'number' ? ws.lastOpened : 0,
    terminals: Array.isArray(ws.terminals) ? ws.terminals.slice() : [],
    layout: ws.layout ?? null,
  };
}
