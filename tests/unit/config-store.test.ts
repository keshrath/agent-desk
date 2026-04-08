// Unit tests for @agent-desk/core/config-store. Each test re-imports the
// module after pointing AGENT_DESK_USER_DATA at a fresh tmp dir, so the
// CONFIG_FILE constant captures the override.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
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
    expect(cfg.version).toBe(1);
    expect(cfg.settings).toEqual({});
    expect(cfg.profiles).toEqual([]);
    expect(cfg.workspaces).toEqual({});
    expect(existsSync(CONFIG_FILE)).toBe(true);
  });

  it('writeConfig() persists and readConfig() reads it back', async () => {
    const { readConfig, writeConfig } = await import('../../packages/core/src/config-store.js');
    writeConfig({
      version: 1,
      settings: { theme: 'dark', fontSize: 14 },
      profiles: [{ name: 'work' }],
      workspaces: { main: { layout: 'grid' } },
    });
    const cfg = readConfig();
    expect(cfg.settings.theme).toBe('dark');
    expect(cfg.settings.fontSize).toBe(14);
    expect(cfg.profiles).toHaveLength(1);
    expect(cfg.workspaces.main).toEqual({ layout: 'grid' });
  });

  it('readConfig() returns defaults when the file is malformed JSON', async () => {
    const { readConfig, CONFIG_FILE } = await import('../../packages/core/src/config-store.js');
    readConfig();
    writeFileSync(CONFIG_FILE, '{ this is not json', 'utf-8');
    const cfg = readConfig();
    expect(cfg.version).toBe(1);
    expect(cfg.settings).toEqual({});
  });

  it('readConfig() merges defaults with partial existing data', async () => {
    const { readConfig, CONFIG_FILE } = await import('../../packages/core/src/config-store.js');
    readConfig();
    writeFileSync(CONFIG_FILE, JSON.stringify({ settings: { theme: 'light' } }), 'utf-8');
    const cfg = readConfig();
    expect(cfg.version).toBe(1);
    expect(cfg.settings.theme).toBe('light');
    expect(cfg.profiles).toEqual([]);
  });

  it('CONFIG_FILE points inside AGENT_DESK_USER_DATA when env is set', async () => {
    const { CONFIG_FILE } = await import('../../packages/core/src/config-store.js');
    expect(CONFIG_FILE.startsWith(tmpDir)).toBe(true);
    expect(CONFIG_FILE.endsWith('config.json')).toBe(true);
  });
});
