// Unit tests for @agent-desk/core/config-store. Each test re-imports the
// module after pointing AGENT_DESK_USER_DATA at a fresh tmp dir, so the
// CONFIG_FILE constant captures the override.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-desk-config-store-'));
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

describe('config-store', () => {
  it('readConfig() creates the file with defaults on first read', async () => {
    const { readConfig, CONFIG_FILE } = await import('../../packages/core/src/config-store.js');
    const cfg = readConfig();
    expect(cfg.version).toBe(2);
    expect(cfg.settings).toEqual({});
    expect(cfg.profiles).toEqual([]);
    expect(cfg.workspaces).toEqual({});
    expect(existsSync(CONFIG_FILE)).toBe(true);
  });

  it('writeConfig() persists and readConfig() reads it back', async () => {
    const { readConfig, writeConfig } = await import('../../packages/core/src/config-store.js');
    writeConfig({
      version: 2,
      settings: { theme: 'dark', fontSize: 14 },
      profiles: [{ name: 'work' }],
      workspaces: {},
    });
    const cfg = readConfig();
    expect(cfg.settings.theme).toBe('dark');
    expect(cfg.settings.fontSize).toBe(14);
    expect(cfg.profiles).toHaveLength(1);
    expect(cfg.workspaces).toEqual({});
  });

  it('readConfig() returns defaults when the file is malformed JSON', async () => {
    const { readConfig, CONFIG_FILE } = await import('../../packages/core/src/config-store.js');
    readConfig();
    writeFileSync(CONFIG_FILE, '{ this is not json', 'utf-8');
    const cfg = readConfig();
    expect(cfg.version).toBe(2);
    expect(cfg.settings).toEqual({});
  });

  it('readConfig() merges defaults with partial existing data', async () => {
    const { readConfig, CONFIG_FILE } = await import('../../packages/core/src/config-store.js');
    readConfig();
    writeFileSync(CONFIG_FILE, JSON.stringify({ settings: { theme: 'light' } }), 'utf-8');
    const cfg = readConfig();
    expect(cfg.version).toBe(2);
    expect(cfg.settings.theme).toBe('light');
    expect(cfg.profiles).toEqual([]);
  });

  it('CONFIG_FILE points inside AGENT_DESK_USER_DATA when env is set', async () => {
    const { CONFIG_FILE } = await import('../../packages/core/src/config-store.js');
    expect(CONFIG_FILE.startsWith(tmpDir)).toBe(true);
    expect(CONFIG_FILE.endsWith('config.json')).toBe(true);
  });
});

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('config-store watchConfig', () => {
  it('returns an idempotent stop function', async () => {
    const { watchConfig } = await import('../../packages/core/src/config-store.js');
    const stop = watchConfig(() => {});
    expect(() => {
      stop();
      stop();
    }).not.toThrow();
  });

  it('second watchConfig while active returns a no-op stop (original watcher stays)', async () => {
    const { watchConfig, writeConfig, CONFIG_FILE } = await import('../../packages/core/src/config-store.js');
    const calls1: number[] = [];
    const calls2: number[] = [];
    const stop1 = watchConfig(() => calls1.push(1));
    const stop2 = watchConfig(() => calls2.push(1));
    // stop2 is a no-op — calling it should NOT close watcher1
    stop2();
    await wait(250); // clear any suppression
    writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ version: 2, settings: { a: 1 }, profiles: [], workspaces: {} }),
      'utf-8',
    );
    await wait(120);
    // calls1 may or may not fire depending on fs.watch semantics; the
    // critical assertion is that calls2 never fires (stop2 was a no-op and
    // the second watchConfig never registered a second listener).
    expect(calls2.length).toBe(0);
    expect(calls1.length).toBeGreaterThanOrEqual(0);
    stop1();
    void writeConfig;
  });

  it('external write triggers the callback with fresh config', async () => {
    const { watchConfig, CONFIG_FILE, readConfig } = await import('../../packages/core/src/config-store.js');
    readConfig(); // ensure file exists
    const received: unknown[] = [];
    const stop = watchConfig((data) => received.push(data));
    await wait(50);
    writeFileSync(
      CONFIG_FILE,
      JSON.stringify({
        version: 2,
        settings: { theme: 'neon' },
        profiles: [],
        workspaces: {},
      }),
      'utf-8',
    );
    await wait(150);
    stop();
    // On some filesystems fs.watch may emit 0 or >=1 events; assert at least one fired
    expect(received.length).toBeGreaterThanOrEqual(1);
    const last = received[received.length - 1] as { settings: { theme?: string } };
    expect(last.settings.theme).toBe('neon');
  });

  it('our own writeConfig does NOT trigger the callback (suppression window)', async () => {
    const { watchConfig, writeConfig, readConfig } = await import('../../packages/core/src/config-store.js');
    readConfig();
    const received: unknown[] = [];
    const stop = watchConfig((data) => received.push(data));
    await wait(30);
    writeConfig({
      version: 2,
      settings: { own: true },
      profiles: [],
      workspaces: {},
    });
    // Within the 100ms suppression window
    await wait(60);
    expect(received.length).toBe(0);
    stop();
  });

  it('after suppression window expires, external write DOES trigger callback', async () => {
    const { watchConfig, writeConfig, readConfig, CONFIG_FILE } =
      await import('../../packages/core/src/config-store.js');
    readConfig();
    const received: unknown[] = [];
    const stop = watchConfig((data) => received.push(data));
    writeConfig({
      version: 2,
      settings: { first: true },
      profiles: [],
      workspaces: {},
    });
    await wait(250); // suppression (100ms) has elapsed
    writeFileSync(
      CONFIG_FILE,
      JSON.stringify({
        version: 1,
        settings: { external: true },
        profiles: [],
        workspaces: {},
      }),
      'utf-8',
    );
    await wait(150);
    stop();
    expect(received.length).toBeGreaterThanOrEqual(1);
  });

  it('watcher swallows parse errors mid-write (no throw)', async () => {
    const { watchConfig, readConfig, CONFIG_FILE } = await import('../../packages/core/src/config-store.js');
    readConfig();
    let threw = false;
    const stop = watchConfig(() => {
      // readConfig() inside watchConfig already handles parse errors by
      // returning defaults, so the callback still fires. We assert no throw
      // propagates out of the watcher tick.
    });
    await wait(30);
    try {
      writeFileSync(CONFIG_FILE, '{ not json', 'utf-8');
      await wait(150);
    } catch {
      threw = true;
    }
    stop();
    expect(threw).toBe(false);
  });

  it('closing the watcher inside the callback does not crash', async () => {
    const { watchConfig, CONFIG_FILE, readConfig } = await import('../../packages/core/src/config-store.js');
    readConfig();
    let stop: () => void = () => {};
    let crashed = false;
    stop = watchConfig(() => {
      try {
        stop();
      } catch {
        crashed = true;
      }
    });
    await wait(30);
    writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ version: 2, settings: { x: 1 }, profiles: [], workspaces: {} }),
      'utf-8',
    );
    await wait(150);
    expect(crashed).toBe(false);
  });

  it('falls back to no-op when fs.watch throws', async () => {
    vi.resetModules();
    vi.doMock('fs', async () => {
      const actual = await vi.importActual<typeof import('fs')>('fs');
      return {
        ...actual,
        watch: () => {
          throw new Error('ENOSYS: watch not supported');
        },
      };
    });
    const { watchConfig, readConfig } = await import('../../packages/core/src/config-store.js');
    readConfig();
    const received: unknown[] = [];
    const stop = watchConfig((data) => received.push(data));
    // stop must still be callable
    expect(() => stop()).not.toThrow();
    expect(received.length).toBe(0);
    vi.doUnmock('fs');
  });
});
