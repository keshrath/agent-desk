// Session persistence: ~/.agent-desk/sessions.json + ~/.agent-desk/buffers/<id>.buf
// Captures the running terminal set, window bounds, and renderer-saved layout
// so the app can restore on next launch.

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { userData } from './platform/paths.js';
import type { TerminalManager } from './terminal-manager.js';

export const SESSION_DIR = userData();
export const SESSION_FILE = userData('sessions.json');
export const BUFFER_DIR = userData('buffers');

export interface SessionTerminalData {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  title: string;
  createdAt: string;
  status: string;
  exitCode?: number | null;
  agentName?: string | null;
  profileName?: string | null;
}

export interface SessionData {
  version?: number;
  savedAt?: string;
  terminals: SessionTerminalData[];
  activeTerminalId?: string;
  windowBounds?: { x: number; y: number; width: number; height: number };
  activeView?: string;
  layout?: unknown;
}

export interface SaveSessionInput {
  windowBounds?: { x: number; y: number; width: number; height: number };
  layout?: unknown;
}

function ensureDirs(): void {
  if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true });
  if (!existsSync(BUFFER_DIR)) mkdirSync(BUFFER_DIR, { recursive: true });
}

/**
 * Snapshot the running terminals + their output buffers to disk. The host
 * passes window bounds + layout because they live outside the core (Electron
 * BrowserWindow vs server-side noop).
 */
export function saveSession(terminalManager: TerminalManager, input: SaveSessionInput): void {
  try {
    ensureDirs();
    const allTerminals = terminalManager.list();
    const runningTerminals = allTerminals.filter((t) => t.status === 'running');
    const terminals: SessionTerminalData[] = runningTerminals.map((t) => ({
      id: t.id,
      command: t.command,
      args: t.args,
      cwd: t.cwd,
      title: t.title,
      createdAt: t.createdAt,
      status: t.status,
      exitCode: t.exitCode,
      agentName: t.agentName,
      profileName: t.profileName,
    }));

    const session: SessionData = {
      version: 2,
      savedAt: new Date().toISOString(),
      terminals,
      windowBounds: input.windowBounds,
      layout: input.layout,
    };

    writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));

    const activeIds = new Set(runningTerminals.map((t) => t.id));
    for (const t of runningTerminals) {
      const buffer = terminalManager.getBuffer(t.id);
      if (buffer) {
        const bufContent = buffer.length > 100_000 ? buffer.slice(-100_000) : buffer;
        writeFileSync(join(BUFFER_DIR, `${t.id}.buf`), bufContent, 'utf-8');
      }
    }

    // Clean up stale buffer files
    try {
      const bufFiles = readdirSync(BUFFER_DIR);
      for (const f of bufFiles) {
        const id = f.replace(/\.buf$/, '');
        if (!activeIds.has(id)) {
          unlinkSync(join(BUFFER_DIR, f));
        }
      }
    } catch {
      /* buffer dir may not exist */
    }
  } catch (err) {
    console.error('Failed to save session:', err);
  }
}

export function loadSession(): SessionData | null {
  if (!existsSync(SESSION_FILE)) return null;
  try {
    return JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

/** Read a saved scrollback buffer for a terminal id, or null if absent. */
export function getSavedBuffer(id: string): string | null {
  const safeId = id.replace(/[^a-zA-Z0-9-]/g, '');
  if (!safeId) return null;
  const bufFile = join(BUFFER_DIR, `${safeId}.buf`);
  if (!existsSync(bufFile)) return null;
  try {
    return readFileSync(bufFile, 'utf-8');
  } catch {
    return null;
  }
}
