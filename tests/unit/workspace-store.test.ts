import { describe, it, expect } from 'vitest';
import type { ConfigData } from '../../packages/core/src/config-store.js';
import type { Workspace } from '../../packages/core/src/transport/channels.js';
import {
  listWorkspaces,
  getWorkspace,
  saveWorkspace,
  deleteWorkspace,
  touchWorkspace,
  getRecentWorkspaces,
  mergeWorkspaceEnv,
} from '../../packages/core/src/workspace-store.js';

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: 'project-alpha',
    rootPath: '/tmp/alpha',
    color: '#6366f1',
    env: {},
    agents: [],
    pinned: false,
    lastOpened: 0,
    terminals: [],
    layout: null,
    ...overrides,
  };
}

function makeConfig(ws: Workspace[] = []): ConfigData {
  const workspaces: Record<string, Workspace> = {};
  for (const w of ws) workspaces[w.id] = w;
  return { version: 2, settings: {}, profiles: [], workspaces };
}

describe('listWorkspaces', () => {
  it('returns an empty array when no workspaces exist', () => {
    expect(listWorkspaces(makeConfig())).toEqual([]);
  });

  it('returns every workspace in the config map', () => {
    const ws1 = makeWorkspace({ id: 'a' });
    const ws2 = makeWorkspace({ id: 'b', name: 'project-beta' });
    const list = listWorkspaces(makeConfig([ws1, ws2]));
    expect(list).toHaveLength(2);
    expect(list.map((w) => w.id).sort()).toEqual(['a', 'b']);
  });
});

describe('getWorkspace', () => {
  it('returns null for missing id', () => {
    expect(getWorkspace(makeConfig(), 'nope')).toBeNull();
  });

  it('returns null for empty id', () => {
    const ws = makeWorkspace();
    expect(getWorkspace(makeConfig([ws]), '')).toBeNull();
  });

  it('returns the workspace when present', () => {
    const ws = makeWorkspace({ id: 'here' });
    expect(getWorkspace(makeConfig([ws]), 'here')).toEqual(ws);
  });
});

describe('saveWorkspace', () => {
  it('inserts a new workspace without mutating the input config', () => {
    const cfg = makeConfig();
    const ws = makeWorkspace({ id: 'new' });
    const next = saveWorkspace(cfg, ws);
    expect(cfg.workspaces).toEqual({});
    expect(next.workspaces.new).toEqual(ws);
  });

  it('updates an existing workspace by id', () => {
    const ws = makeWorkspace({ id: 'up', name: 'v1' });
    const cfg = makeConfig([ws]);
    const next = saveWorkspace(cfg, { ...ws, name: 'v2' });
    expect(next.workspaces.up.name).toBe('v2');
  });

  it('throws when id is missing', () => {
    expect(() => saveWorkspace(makeConfig(), { ...makeWorkspace(), id: '' })).toThrow(/id is required/);
  });

  it('normalizes garbage fields into safe defaults', () => {
    const dirty = {
      id: 'x',
      name: '',
      rootPath: 12 as unknown as string,
      color: '',
      env: null as unknown as Record<string, string>,
      agents: 'not-array' as unknown as string[],
      pinned: 'yes' as unknown as boolean,
      lastOpened: 'now' as unknown as number,
      terminals: 'bad' as unknown as Workspace['terminals'],
      layout: undefined as unknown,
    } as Workspace;
    const next = saveWorkspace(makeConfig(), dirty);
    const out = next.workspaces.x;
    expect(out.name).toBe('x');
    expect(out.rootPath).toBe('');
    expect(out.color).toBe('#6f42c1');
    expect(out.env).toEqual({});
    expect(out.agents).toEqual([]);
    expect(out.pinned).toBe(false);
    expect(out.lastOpened).toBe(0);
    expect(out.terminals).toEqual([]);
    expect(out.layout).toBeNull();
  });
});

describe('deleteWorkspace', () => {
  it('removes the entry and returns a new config', () => {
    const ws = makeWorkspace({ id: 'rm' });
    const cfg = makeConfig([ws]);
    const next = deleteWorkspace(cfg, 'rm');
    expect(next.workspaces).toEqual({});
    // input config is unchanged
    expect(cfg.workspaces.rm).toBeDefined();
  });

  it('is a no-op for unknown id', () => {
    const ws = makeWorkspace({ id: 'keep' });
    const cfg = makeConfig([ws]);
    const next = deleteWorkspace(cfg, 'nope');
    expect(next.workspaces.keep).toBeDefined();
  });
});

describe('touchWorkspace', () => {
  it('bumps lastOpened to the provided now', () => {
    const ws = makeWorkspace({ id: 't', lastOpened: 0 });
    const next = touchWorkspace(makeConfig([ws]), 't', 123456);
    expect(next.workspaces.t.lastOpened).toBe(123456);
  });

  it('is a no-op for unknown id', () => {
    const cfg = makeConfig();
    expect(touchWorkspace(cfg, 'nope', 99)).toBe(cfg);
  });

  it('uses Date.now() when no time is provided', () => {
    const ws = makeWorkspace({ id: 'n', lastOpened: 0 });
    const before = Date.now();
    const next = touchWorkspace(makeConfig([ws]), 'n');
    const after = Date.now();
    expect(next.workspaces.n.lastOpened).toBeGreaterThanOrEqual(before);
    expect(next.workspaces.n.lastOpened).toBeLessThanOrEqual(after);
  });
});

describe('getRecentWorkspaces', () => {
  it('returns pinned first, then by lastOpened desc', () => {
    const a = makeWorkspace({ id: 'a', name: 'alpha', pinned: false, lastOpened: 100 });
    const b = makeWorkspace({ id: 'b', name: 'beta', pinned: true, lastOpened: 50 });
    const c = makeWorkspace({ id: 'c', name: 'gamma', pinned: false, lastOpened: 200 });
    const d = makeWorkspace({ id: 'd', name: 'delta', pinned: false, lastOpened: 0 });
    const cfg = makeConfig([a, b, c, d]);
    const sorted = getRecentWorkspaces(cfg);
    expect(sorted.map((w) => w.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('honors the limit argument', () => {
    const list: Workspace[] = [];
    for (let i = 0; i < 5; i++) {
      list.push(makeWorkspace({ id: String(i), name: 'w' + i, lastOpened: 1000 - i }));
    }
    const sorted = getRecentWorkspaces(makeConfig(list), 3);
    expect(sorted).toHaveLength(3);
    expect(sorted.map((w) => w.id)).toEqual(['0', '1', '2']);
  });

  it('limit ≤ 0 is ignored (returns full list)', () => {
    const a = makeWorkspace({ id: 'a' });
    const b = makeWorkspace({ id: 'b' });
    expect(getRecentWorkspaces(makeConfig([a, b]), 0)).toHaveLength(2);
  });

  it('breaks ties on equal lastOpened by name ascending', () => {
    const a = makeWorkspace({ id: 'a', name: 'beta', lastOpened: 100 });
    const b = makeWorkspace({ id: 'b', name: 'alpha', lastOpened: 100 });
    const sorted = getRecentWorkspaces(makeConfig([a, b]));
    expect(sorted.map((w) => w.name)).toEqual(['alpha', 'beta']);
  });
});

describe('mergeWorkspaceEnv', () => {
  it('returns base env when workspace has no env', () => {
    const ws = makeWorkspace();
    const out = mergeWorkspaceEnv(ws, { PATH: '/bin', HOME: '/u' });
    expect(out.PATH).toBe('/bin');
    expect(out.HOME).toBe('/u');
  });

  it('workspace env overrides base env for the same key', () => {
    const ws = makeWorkspace({ env: { PATH: '/custom/bin', NODE_ENV: 'dev' } });
    const out = mergeWorkspaceEnv(ws, { PATH: '/bin', HOME: '/u' });
    expect(out.PATH).toBe('/custom/bin');
    expect(out.HOME).toBe('/u');
    expect(out.NODE_ENV).toBe('dev');
  });

  it('drops non-string base env entries', () => {
    const ws = makeWorkspace();
    const out = mergeWorkspaceEnv(ws, {
      PATH: '/bin',
      EMPTY: undefined,
      SOMETHING: 42 as unknown as string,
    } as unknown as NodeJS.ProcessEnv);
    expect(out.PATH).toBe('/bin');
    expect(out.EMPTY).toBeUndefined();
    expect(out.SOMETHING).toBeUndefined();
  });

  it('drops non-string workspace env values', () => {
    const ws = makeWorkspace({
      env: { GOOD: 'yes', BAD: 1 as unknown as string },
    });
    const out = mergeWorkspaceEnv(ws, {});
    expect(out.GOOD).toBe('yes');
    expect(out.BAD).toBeUndefined();
  });
});
