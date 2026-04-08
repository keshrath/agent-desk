// Unit tests for @agent-desk/core/history-store.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-desk-history-'));
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

function makeEntry(command: string) {
  return {
    command,
    terminalId: 't1',
    terminalTitle: 'Terminal 1',
    timestamp: Date.now(),
    cwd: '/tmp',
  };
}

describe('history-store', () => {
  it('starts empty and load() is a no-op when no file exists', async () => {
    const { HistoryStore } = await import('../../packages/core/src/history-store.js');
    const h = new HistoryStore();
    h.load();
    expect(h.get()).toEqual([]);
  });

  it('add() stores entries and get() returns them in reverse-chronological order', async () => {
    const { HistoryStore } = await import('../../packages/core/src/history-store.js');
    const h = new HistoryStore();
    h.add(makeEntry('first'));
    h.add(makeEntry('second'));
    h.add(makeEntry('third'));
    const all = h.get();
    expect(all).toHaveLength(3);
    expect(all[0].command).toBe('third');
    expect(all[2].command).toBe('first');
  });

  it('get(limit) caps the result', async () => {
    const { HistoryStore } = await import('../../packages/core/src/history-store.js');
    const h = new HistoryStore();
    for (let i = 0; i < 10; i++) h.add(makeEntry(`cmd${i}`));
    expect(h.get(3)).toHaveLength(3);
    expect(h.get(3)[0].command).toBe('cmd9');
  });

  it('get(undefined, search) filters by substring (case-insensitive)', async () => {
    const { HistoryStore } = await import('../../packages/core/src/history-store.js');
    const h = new HistoryStore();
    h.add(makeEntry('git status'));
    h.add(makeEntry('npm test'));
    h.add(makeEntry('Git Push'));
    const matches = h.get(undefined, 'git');
    expect(matches).toHaveLength(2);
  });

  it('clear() empties the store and persists', async () => {
    const { HistoryStore, HISTORY_FILE } = await import('../../packages/core/src/history-store.js');
    const h = new HistoryStore();
    h.add(makeEntry('cmd1'));
    h.clear();
    expect(h.get()).toEqual([]);
    expect(existsSync(HISTORY_FILE)).toBe(true);
  });

  it('save()/load() roundtrip preserves entries', async () => {
    const { HistoryStore } = await import('../../packages/core/src/history-store.js');
    const h1 = new HistoryStore();
    h1.add(makeEntry('persisted-1'));
    h1.add(makeEntry('persisted-2'));
    h1.save();

    const h2 = new HistoryStore();
    h2.load();
    expect(h2.get()).toHaveLength(2);
    expect(h2.get()[0].command).toBe('persisted-2');
  });
});
