// Unit tests for the workspace migration path in @agent-desk/core/config-store.
// Covers both the pure helpers (migrateWorkspace, migrateWorkspaces) and the
// readConfig() integration — legacy `{ terminals, layout }` records must lift
// into the v2 Workspace shape with stable IDs, default color, and no data
// loss.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-desk-ws-migration-'));
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

describe('migrateWorkspace', () => {
  it('lifts a legacy layout-only record into a full Workspace with uuid id', async () => {
    const { migrateWorkspace } = await import('../../packages/core/src/config-store.js');
    const ws = migrateWorkspace('dev-setup', {
      terminals: [{ panelId: 'p1', command: 'bash', args: [], cwd: '/tmp', title: 't', profile: '', icon: '' }],
      layout: { some: 'layout' },
    });
    expect(ws.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(ws.name).toBe('dev-setup');
    expect(ws.rootPath).toBe('');
    expect(ws.color).toBe('#6f42c1');
    expect(ws.env).toEqual({});
    expect(ws.agents).toEqual([]);
    expect(ws.pinned).toBe(false);
    expect(ws.lastOpened).toBe(0);
    expect(ws.terminals).toHaveLength(1);
    expect(ws.layout).toEqual({ some: 'layout' });
  });

  it('preserves a v2 record with an existing id', async () => {
    const { migrateWorkspace } = await import('../../packages/core/src/config-store.js');
    const input = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'existing',
      rootPath: 'C:/projects/foo',
      color: '#ff00aa',
      env: { NODE_ENV: 'dev' },
      agents: ['claude', 'aider'],
      pinned: true,
      lastOpened: 1712000000000,
      terminals: [],
      layout: null,
    };
    const ws = migrateWorkspace('ignored-key', input);
    expect(ws.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(ws.name).toBe('existing');
    expect(ws.rootPath).toBe('C:/projects/foo');
    expect(ws.color).toBe('#ff00aa');
    expect(ws.env).toEqual({ NODE_ENV: 'dev' });
    expect(ws.agents).toEqual(['claude', 'aider']);
    expect(ws.pinned).toBe(true);
    expect(ws.lastOpened).toBe(1712000000000);
  });

  it('tolerates null/undefined and garbage field types', async () => {
    const { migrateWorkspace } = await import('../../packages/core/src/config-store.js');
    const ws = migrateWorkspace('bad', {
      env: 'not-an-object',
      agents: 'not-an-array',
      pinned: 'not-a-bool',
      lastOpened: 'not-a-number',
      terminals: null,
    });
    expect(ws.env).toEqual({});
    expect(ws.agents).toEqual([]);
    expect(ws.pinned).toBe(false);
    expect(ws.lastOpened).toBe(0);
    expect(ws.terminals).toEqual([]);
  });

  it('uses the map key as a name fallback when no name field is present', async () => {
    const { migrateWorkspace } = await import('../../packages/core/src/config-store.js');
    const ws = migrateWorkspace('my-project', {});
    expect(ws.name).toBe('my-project');
  });
});

describe('migrateWorkspaces', () => {
  it('returns an empty object for undefined / non-object input', async () => {
    const { migrateWorkspaces } = await import('../../packages/core/src/config-store.js');
    expect(migrateWorkspaces(undefined)).toEqual({});
    expect(migrateWorkspaces(null as unknown as Record<string, unknown>)).toEqual({});
  });

  it('re-keys legacy name-keyed records by their new uuid id', async () => {
    const { migrateWorkspaces } = await import('../../packages/core/src/config-store.js');
    const out = migrateWorkspaces({
      'dev-setup': { terminals: [], layout: null },
      'prod-check': { terminals: [], layout: null },
    });
    const ids = Object.keys(out);
    expect(ids).toHaveLength(2);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
    const names = Object.values(out)
      .map((w) => w.name)
      .sort();
    expect(names).toEqual(['dev-setup', 'prod-check']);
  });

  it('preserves id-keying for already-migrated v2 records', async () => {
    const { migrateWorkspaces } = await import('../../packages/core/src/config-store.js');
    const id = '22222222-2222-2222-2222-222222222222';
    const out = migrateWorkspaces({
      [id]: {
        id,
        name: 'alpha',
        rootPath: '/x',
        color: '#abc',
        env: {},
        agents: [],
        pinned: false,
        lastOpened: 0,
        terminals: [],
        layout: null,
      },
    });
    expect(out[id]).toBeDefined();
    expect(out[id].name).toBe('alpha');
  });
});

describe('readConfig() integrates migration', () => {
  it('lifts legacy workspaces on first read', async () => {
    const { readConfig, CONFIG_FILE } = await import('../../packages/core/src/config-store.js');
    readConfig(); // create the file
    writeFileSync(
      CONFIG_FILE,
      JSON.stringify({
        version: 1,
        settings: { theme: 'dark' },
        profiles: [],
        workspaces: {
          main: { terminals: [], layout: { grid: true } },
        },
      }),
      'utf-8',
    );
    const cfg = readConfig();
    const workspaces = Object.values(cfg.workspaces);
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].name).toBe('main');
    expect(workspaces[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(workspaces[0].layout).toEqual({ grid: true });
  });

  it('empty-workspaces input stays empty', async () => {
    const { readConfig, CONFIG_FILE } = await import('../../packages/core/src/config-store.js');
    readConfig();
    writeFileSync(CONFIG_FILE, JSON.stringify({ version: 2, settings: {}, profiles: [], workspaces: {} }), 'utf-8');
    const cfg = readConfig();
    expect(cfg.workspaces).toEqual({});
  });
});
