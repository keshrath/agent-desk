// User config store: ~/.agent-desk/config.json (or AGENT_DESK_USER_DATA override).
// Read/write/watch with a change-event callback the host wires into its push transport.

import { existsSync, mkdirSync, readFileSync, writeFileSync, watch, type FSWatcher } from 'fs';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import { userData } from './platform/paths.js';
import type { Workspace } from './transport/channels.js';

export interface ConfigData {
  version: number;
  settings: Record<string, unknown>;
  profiles: Array<Record<string, unknown>>;
  workspaces: Record<string, Workspace>;
}

const DEFAULT_CONFIG: ConfigData = {
  version: 2,
  settings: {},
  profiles: [],
  workspaces: {},
};

const WORKSPACE_DEFAULT_COLOR = '#6f42c1';

/**
 * Migrate a single workspace record from any legacy shape to the current
 * Workspace type. Idempotent: called on every read, persisted on first write.
 *
 * Legacy shapes seen in the wild:
 *   v1: { terminals: [...], layout: {...} }    // layout-only, name was the key
 *   pre-id: missing id/rootPath/color/env/agents/pinned/lastOpened
 */
export function migrateWorkspace(key: string, raw: unknown): Workspace {
  const r = (raw ?? {}) as Partial<Workspace> & Record<string, unknown>;
  return {
    id: typeof r.id === 'string' && r.id ? r.id : randomUUID(),
    name: typeof r.name === 'string' && r.name ? r.name : key,
    rootPath: typeof r.rootPath === 'string' ? r.rootPath : '',
    color: typeof r.color === 'string' && r.color ? r.color : WORKSPACE_DEFAULT_COLOR,
    env: r.env && typeof r.env === 'object' ? (r.env as Record<string, string>) : {},
    agents: Array.isArray(r.agents) ? (r.agents as string[]) : [],
    pinned: typeof r.pinned === 'boolean' ? r.pinned : false,
    lastOpened: typeof r.lastOpened === 'number' ? r.lastOpened : 0,
    terminals: Array.isArray(r.terminals) ? (r.terminals as Workspace['terminals']) : [],
    layout: r.layout ?? null,
  };
}

/**
 * Migrate all workspaces in a config record. Pure function — returns a new
 * object if any entry changed shape, otherwise returns the input unchanged
 * (referential equality preserved so callers can skip a write).
 */
export function migrateWorkspaces(raw: Record<string, unknown> | undefined): Record<string, Workspace> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, Workspace> = {};
  for (const [key, value] of Object.entries(raw)) {
    const migrated = migrateWorkspace(key, value);
    out[migrated.id] = migrated;
  }
  return out;
}

export const CONFIG_FILE = userData('config.json');

function ensureDir(): void {
  const dir = dirname(CONFIG_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function readConfig(): ConfigData {
  ensureDir();
  if (!existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ConfigData> & {
      workspaces?: Record<string, unknown>;
    };
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      workspaces: migrateWorkspaces(parsed.workspaces),
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

let writeInProgress = false;

export function writeConfig(data: ConfigData): void {
  ensureDir();
  writeInProgress = true;
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } finally {
    setTimeout(() => {
      writeInProgress = false;
    }, 100);
  }
}

let watcher: FSWatcher | null = null;

/**
 * Start watching the config file. The callback fires on external changes
 * (i.e. not the result of our own writeConfig). Returns a stop function.
 */
export function watchConfig(onChange: (data: ConfigData) => void): () => void {
  if (watcher) return () => {};
  ensureDir();
  if (!existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  }
  try {
    watcher = watch(CONFIG_FILE, { persistent: false }, (eventType) => {
      if (eventType === 'change' && !writeInProgress) {
        try {
          onChange(readConfig());
        } catch {
          // file may be mid-write
        }
      }
    });
  } catch {
    // watch not supported on this platform/fs
  }
  return () => {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
  };
}
