// User config store: ~/.agent-desk/config.json (or AGENT_DESK_USER_DATA override).
// Read/write/watch with a change-event callback the host wires into its push transport.

import { existsSync, mkdirSync, readFileSync, writeFileSync, watch, type FSWatcher } from 'fs';
import { dirname } from 'path';
import { userData } from './platform/paths.js';

export interface ConfigData {
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
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
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
