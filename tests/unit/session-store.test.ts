// Unit tests for @agent-desk/core/session-store. The session store snapshots
// the running terminal set + their output buffers. We use a stub TerminalManager
// instead of a real one because spawning ptys in unit tests is flaky on Windows.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { TerminalManager } from '../../packages/core/src/terminal-manager.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-desk-session-'));
  process.env.AGENT_DESK_USER_DATA = tmpDir;
  vi.resetModules();
});

afterEach(() => {
  delete process.env.AGENT_DESK_USER_DATA;
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

function makeStubTerminalManager(terminals: Array<{ id: string; buffer?: string; status?: string }>): TerminalManager {
  return {
    list: () =>
      terminals.map((t) => ({
        id: t.id,
        cwd: '/tmp',
        command: 'bash',
        args: [],
        status: t.status ?? 'running',
        exitCode: null,
        createdAt: new Date().toISOString(),
        title: `term-${t.id}`,
        agentName: null,
        profileName: null,
      })),
    getBuffer: (id: string) => terminals.find((t) => t.id === id)?.buffer ?? '',
  } as unknown as TerminalManager;
}

describe('session-store', () => {
  it('loadSession() returns null when no file exists', async () => {
    const { loadSession } = await import('../../packages/core/src/session-store.js');
    expect(loadSession()).toBe(null);
  });

  it('saveSession() writes the session blob and per-terminal buffer files', async () => {
    const { saveSession, loadSession, SESSION_FILE, BUFFER_DIR } =
      await import('../../packages/core/src/session-store.js');
    const tm = makeStubTerminalManager([
      { id: 'a', buffer: 'output-a' },
      { id: 'b', buffer: 'output-b' },
    ]);
    saveSession(tm, { windowBounds: { x: 10, y: 20, width: 800, height: 600 }, layout: { kind: 'grid' } });
    expect(existsSync(SESSION_FILE)).toBe(true);
    expect(readFileSync(join(BUFFER_DIR, 'a.buf'), 'utf-8')).toBe('output-a');
    expect(readFileSync(join(BUFFER_DIR, 'b.buf'), 'utf-8')).toBe('output-b');

    const session = loadSession();
    expect(session).not.toBe(null);
    expect(session!.terminals).toHaveLength(2);
    expect(session!.windowBounds).toEqual({ x: 10, y: 20, width: 800, height: 600 });
    expect(session!.layout).toEqual({ kind: 'grid' });
  });

  it('saveSession() skips exited terminals', async () => {
    const { saveSession, loadSession } = await import('../../packages/core/src/session-store.js');
    const tm = makeStubTerminalManager([
      { id: 'alive', buffer: 'live', status: 'running' },
      { id: 'dead', buffer: 'gone', status: 'exited' },
    ]);
    saveSession(tm, {});
    const session = loadSession();
    expect(session!.terminals).toHaveLength(1);
    expect(session!.terminals[0].id).toBe('alive');
  });

  it('saveSession() removes stale buffer files for terminals no longer running', async () => {
    const { saveSession, BUFFER_DIR } = await import('../../packages/core/src/session-store.js');

    const stalePath = join(BUFFER_DIR, 'stale.buf');
    const tm1 = makeStubTerminalManager([{ id: 'stale', buffer: 'will-be-cleaned' }]);
    saveSession(tm1, {});
    expect(existsSync(stalePath)).toBe(true);

    const tm2 = makeStubTerminalManager([{ id: 'fresh', buffer: 'new' }]);
    saveSession(tm2, {});
    expect(existsSync(stalePath)).toBe(false);
    expect(existsSync(join(BUFFER_DIR, 'fresh.buf'))).toBe(true);
  });

  it('getSavedBuffer() returns the buffer for a saved terminal', async () => {
    const { saveSession, getSavedBuffer } = await import('../../packages/core/src/session-store.js');
    const tm = makeStubTerminalManager([{ id: 'abc', buffer: 'scrollback content' }]);
    saveSession(tm, {});
    expect(getSavedBuffer('abc')).toBe('scrollback content');
  });

  it('getSavedBuffer() rejects path-traversal ids', async () => {
    const { getSavedBuffer } = await import('../../packages/core/src/session-store.js');
    expect(getSavedBuffer('../etc/passwd')).toBe(null);
    expect(getSavedBuffer('')).toBe(null);
  });

  it('loadSession() returns null when the file is malformed', async () => {
    const { loadSession, SESSION_FILE } = await import('../../packages/core/src/session-store.js');
    writeFileSync(SESSION_FILE, 'definitely not json', 'utf-8');
    expect(loadSession()).toBe(null);
  });
});
