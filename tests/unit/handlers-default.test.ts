// Unit tests for @agent-desk/core/handlers-default.
// Exercises buildDefaultRequestHandlers + buildDefaultCommandHandlers
// directly with stubbed deps so handler-body typos surface in unit, not e2e.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { TerminalManager, HistoryStore, AgentBridges, LoadedPlugin } from '../../packages/core/src/index.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-desk-handlers-'));
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

function makeStubTerminals(): TerminalManager {
  const fakeTerm = {
    id: 'T1',
    cwd: '/tmp',
    command: 'bash',
    args: [],
    title: 'bash',
    status: 'running' as const,
    exitCode: null,
    createdAt: '2026-04-08T00:00:00Z',
    agentName: null,
    profileName: null,
  };
  return {
    spawn: vi.fn(() => fakeTerm),
    write: vi.fn(() => true),
    resize: vi.fn(() => true),
    kill: vi.fn(() => true),
    signal: vi.fn(() => true),
    restart: vi.fn(() => ({ id: 'T2', cwd: '/tmp', command: 'bash', args: [] })),
    list: vi.fn(() => [fakeTerm]),
    setAgentInfo: vi.fn(() => true),
    unsubscribeAll: vi.fn(),
    onHistoryEntry: vi.fn(),
    subscribe: vi.fn(),
  } as unknown as TerminalManager;
}

function makeStubHistory(): HistoryStore {
  const entries: Array<{ command: string }> = [];
  return {
    add: vi.fn((e) => entries.push(e)),
    get: vi.fn(() => entries.slice()),
    clear: vi.fn(() => {
      entries.length = 0;
      return true;
    }),
    load: vi.fn(),
    save: vi.fn(),
  } as unknown as HistoryStore;
}

function makeStubBridges(
  opts: { withCtx?: boolean; discoverServer?: unknown; failActivate?: boolean } = {},
): AgentBridges {
  const server = opts.discoverServer ?? { id: 7, name: 'srv', command: 'node', args: ['s.js'], env: {} };
  const ctx = opts.withCtx
    ? {
        agents: { list: () => [{ id: 'a1' }] },
        channels: { list: () => [{ id: 'c1' }] },
        messages: { list: (q: { limit?: number }) => [{ id: 'm1', limit: q?.limit }] },
        state: { list: () => [{ k: 'v' }] },
        feed: { recent: (n: number) => [{ ev: 'e', n }] },
        tasks: {
          list: (filter: unknown) => [{ id: 1, title: 'task', filter }],
          getById: (id: number) => ({ id }),
          search: (q: string) => [{ id: 1, q }],
        },
        registry: {
          list: () => [server],
          getById: () => server,
          setActive: vi.fn(),
          unregister: vi.fn(),
        },
        marketplace: {
          browse: vi.fn(async (q: string) => ({ servers: [{ id: 'm', q }], next_cursor: null })),
        },
        proxy: {
          activate: vi.fn(async () => {
            if (opts.failActivate) throw new Error('boom');
          }),
          deactivate: vi.fn(async () => {}),
        },
        secrets: { list: (sid: number) => [{ sid }] },
        metrics: {
          getServerMetrics: (sid: number) => [{ sid }],
          getOverview: () => [{ overview: true }],
        },
        health: { getHealth: (sid: number) => ({ sid, status: 'ok' }) },
      }
    : null;
  return {
    commCtx: ctx,
    tasksCtx: ctx,
    discoverCtx: ctx,
    init: vi.fn(),
    close: vi.fn(),
    startPolling: vi.fn(),
    status: () => ({ comm: 'ok', tasks: 'ok', discover: 'ok' }),
  } as unknown as AgentBridges;
}

describe('buildDefaultRequestHandlers — terminal', () => {
  it('terminal:create calls terminals.spawn with the right args + returns the right shape', async () => {
    const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
    const terminals = makeStubTerminals();
    const handlers = buildDefaultRequestHandlers({
      terminals,
      history: makeStubHistory(),
      bridges: makeStubBridges(),
      plugins: [],
    });
    const result = handlers['terminal:create']!({ cwd: '/tmp', command: 'bash' });
    expect((terminals.spawn as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      '/tmp',
      'bash',
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(result).toEqual({ id: 'T1', cwd: '/tmp', command: 'bash', args: [], title: 'bash' });
  });

  it('terminal:write delegates to terminals.write', async () => {
    const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
    const terminals = makeStubTerminals();
    const handlers = buildDefaultRequestHandlers({
      terminals,
      history: makeStubHistory(),
      bridges: makeStubBridges(),
      plugins: [],
    });
    expect(handlers['terminal:write']!('id-1', 'data')).toBe(true);
    expect(terminals.write).toHaveBeenCalledWith('id-1', 'data');
  });

  it('terminal:list returns the stub list output', async () => {
    const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
    const handlers = buildDefaultRequestHandlers({
      terminals: makeStubTerminals(),
      history: makeStubHistory(),
      bridges: makeStubBridges(),
      plugins: [],
    });
    const result = handlers['terminal:list']!();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});

describe('buildDefaultRequestHandlers — config + history', () => {
  it('config:read round-trips through the real readConfig', async () => {
    const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
    const handlers = buildDefaultRequestHandlers({
      terminals: makeStubTerminals(),
      history: makeStubHistory(),
      bridges: makeStubBridges(),
      plugins: [],
    });
    const cfg = handlers['config:read']!();
    expect(cfg).toBeDefined();
    expect(typeof cfg).toBe('object');
  });

  it('history:get / history:clear delegate to the HistoryStore stub', async () => {
    const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
    const history = makeStubHistory();
    const handlers = buildDefaultRequestHandlers({
      terminals: makeStubTerminals(),
      history,
      bridges: makeStubBridges(),
      plugins: [],
    });
    expect(handlers['history:get']!(10, 'search')).toEqual([]);
    expect(history.get).toHaveBeenCalledWith(10, 'search');
    expect(handlers['history:clear']!()).toBe(true);
    expect(history.clear).toHaveBeenCalled();
  });
});

describe('buildDefaultRequestHandlers — comm bridge', () => {
  it('comm:state returns null when bridges.commCtx is null', async () => {
    const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
    const handlers = buildDefaultRequestHandlers({
      terminals: makeStubTerminals(),
      history: makeStubHistory(),
      bridges: makeStubBridges({ withCtx: false }),
      plugins: [],
    });
    expect(handlers['comm:state']!()).toBe(null);
  });

  it('comm:state returns a snapshot when commCtx is present', async () => {
    const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
    const handlers = buildDefaultRequestHandlers({
      terminals: makeStubTerminals(),
      history: makeStubHistory(),
      bridges: makeStubBridges({ withCtx: true }),
      plugins: [],
    });
    const snap = handlers['comm:state']!() as { agents: unknown[] } | null;
    expect(snap).not.toBe(null);
    expect(snap!.agents).toEqual([{ id: 'a1' }]);
  });

  it('comm:agents returns [] when commCtx is null (does not throw)', async () => {
    const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
    const handlers = buildDefaultRequestHandlers({
      terminals: makeStubTerminals(),
      history: makeStubHistory(),
      bridges: makeStubBridges({ withCtx: false }),
      plugins: [],
    });
    expect(handlers['comm:agents']!()).toEqual([]);
  });
});

describe('buildDefaultRequestHandlers — file ops', () => {
  it('file:write returns { ok: true } on success', async () => {
    const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
    const handlers = buildDefaultRequestHandlers({
      terminals: makeStubTerminals(),
      history: makeStubHistory(),
      bridges: makeStubBridges(),
      plugins: [],
    });
    const result = handlers['file:write']!(join(tmpDir, 'out.txt'), 'hello');
    expect(result).toEqual({ ok: true });
  });

  it('file:stat returns { exists: false } for missing files', async () => {
    const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
    const handlers = buildDefaultRequestHandlers({
      terminals: makeStubTerminals(),
      history: makeStubHistory(),
      bridges: makeStubBridges(),
      plugins: [],
    });
    const result = handlers['file:stat']!(join(tmpDir, 'nope.txt'));
    expect(result).toEqual({ exists: false });
  });

  it('file:dirname returns the parent directory', async () => {
    const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
    const handlers = buildDefaultRequestHandlers({
      terminals: makeStubTerminals(),
      history: makeStubHistory(),
      bridges: makeStubBridges(),
      plugins: [],
    });
    expect(handlers['file:dirname']!('/a/b/c.txt').replace(/\\/g, '/')).toBe('/a/b');
  });
});

describe('buildDefaultRequestHandlers — plugins', () => {
  it('plugins:list returns the empty info list for empty plugins', async () => {
    const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
    const handlers = buildDefaultRequestHandlers({
      terminals: makeStubTerminals(),
      history: makeStubHistory(),
      bridges: makeStubBridges(),
      plugins: [] as LoadedPlugin[],
    });
    expect(handlers['plugins:list']!()).toEqual([]);
  });

  it('plugins:getConfig returns null for unknown plugin id', async () => {
    const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
    const handlers = buildDefaultRequestHandlers({
      terminals: makeStubTerminals(),
      history: makeStubHistory(),
      bridges: makeStubBridges(),
      plugins: [],
    });
    expect(handlers['plugins:getConfig']!('nonexistent')).toBe(null);
  });
});

describe('buildDefaultCommandHandlers', () => {
  it('terminal:unsubscribe delegates to terminals.unsubscribeAll', async () => {
    const { buildDefaultCommandHandlers } = await import('../../packages/core/src/handlers-default.js');
    const terminals = makeStubTerminals();
    const handlers = buildDefaultCommandHandlers({
      terminals,
      history: makeStubHistory(),
      bridges: makeStubBridges(),
      plugins: [],
    });
    handlers['terminal:unsubscribe']!('id-1');
    expect(terminals.unsubscribeAll).toHaveBeenCalledWith('id-1');
  });

  it('terminal:subscribe is a no-op stub (does not throw)', async () => {
    const { buildDefaultCommandHandlers } = await import('../../packages/core/src/handlers-default.js');
    const handlers = buildDefaultCommandHandlers({
      terminals: makeStubTerminals(),
      history: makeStubHistory(),
      bridges: makeStubBridges(),
      plugins: [],
    });
    expect(() => handlers['terminal:subscribe']!('id-1')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Extended coverage — every remaining channel in the default handler map.
// ---------------------------------------------------------------------------

async function buildH(opts: { withCtx?: boolean; failActivate?: boolean; discoverServer?: unknown } = {}) {
  const { buildDefaultRequestHandlers } = await import('../../packages/core/src/handlers-default.js');
  const terminals = makeStubTerminals();
  const history = makeStubHistory();
  const bridges = makeStubBridges(opts);
  return {
    terminals,
    history,
    bridges,
    handlers: buildDefaultRequestHandlers({ terminals, history, bridges, plugins: [] }),
  };
}

describe('terminal — resize / kill / signal / restart', () => {
  it('terminal:resize delegates', async () => {
    const { terminals, handlers } = await buildH();
    expect(handlers['terminal:resize']!('id', 80, 24)).toBe(true);
    expect(terminals.resize).toHaveBeenCalledWith('id', 80, 24);
  });
  it('terminal:kill delegates', async () => {
    const { terminals, handlers } = await buildH();
    expect(handlers['terminal:kill']!('id')).toBe(true);
    expect(terminals.kill).toHaveBeenCalledWith('id');
  });
  it('terminal:signal delegates', async () => {
    const { terminals, handlers } = await buildH();
    expect(handlers['terminal:signal']!('id', 'SIGINT')).toBe(true);
    expect(terminals.signal).toHaveBeenCalledWith('id', 'SIGINT');
  });
  it('terminal:restart delegates', async () => {
    const { handlers } = await buildH();
    const r = handlers['terminal:restart']!('id') as { id: string };
    expect(r.id).toBe('T2');
  });
});

describe('session channels', () => {
  it('session:save / autoSave / load / getBuffer / replayBuffer do not throw', async () => {
    const { handlers } = await buildH();
    expect(() => handlers['session:save']!()).not.toThrow();
    expect(() => handlers['session:autoSave']!()).not.toThrow();
    expect(() => handlers['session:load']!()).not.toThrow();
    expect(handlers['session:getBuffer']!('unknown')).toBe('');
    expect(handlers['session:replayBuffer']!('unknown')).toBe('');
  });
  it('session:setAgentInfo delegates to terminals.setAgentInfo', async () => {
    const { terminals, handlers } = await buildH();
    expect(handlers['session:setAgentInfo']!('t', 'agent', 'profile')).toBe(true);
    expect(terminals.setAgentInfo).toHaveBeenCalledWith('t', 'agent', 'profile');
  });
  it('session:saveLayout returns true', async () => {
    const { handlers } = await buildH();
    expect(handlers['session:saveLayout']!({})).toBe(true);
  });
});

describe('config + keybindings', () => {
  it('config:write round-trips through readConfig', async () => {
    const { handlers } = await buildH();
    const cfg = handlers['config:read']!() as Record<string, unknown>;
    expect(handlers['config:write']!({ ...cfg, marker: 'x' })).toBe(true);
    const cfg2 = handlers['config:read']!() as Record<string, unknown>;
    expect(cfg2.marker).toBe('x');
  });
  it('config:getPath returns a string path', async () => {
    const { handlers } = await buildH();
    expect(typeof handlers['config:getPath']!()).toBe('string');
  });
  it('keybindings:read / keybindings:write round-trip', async () => {
    const { handlers } = await buildH();
    expect(typeof handlers['keybindings:read']!()).toBe('object');
    expect(handlers['keybindings:write']!({ 'ctrl+s': 'save' })).toBeDefined();
    const kb = handlers['keybindings:read']!() as Record<string, unknown>;
    expect(kb['ctrl+s']).toBe('save');
  });
});

describe('comm bridge — remaining channels', () => {
  it('with no ctx: messages/channels/state-entries/feed return []', async () => {
    const { handlers } = await buildH({ withCtx: false });
    expect(handlers['comm:messages']!(50)).toEqual([]);
    expect(handlers['comm:channels']!()).toEqual([]);
    expect(handlers['comm:state-entries']!()).toEqual([]);
    expect(handlers['comm:feed']!(10)).toEqual([]);
  });
  it('with ctx: messages passes the limit through', async () => {
    const { handlers } = await buildH({ withCtx: true });
    const msgs = handlers['comm:messages']!(42) as Array<{ limit?: number }>;
    expect(msgs[0].limit).toBe(42);
  });
  it('with ctx: messages default limit = 100 when arg omitted', async () => {
    const { handlers } = await buildH({ withCtx: true });
    const msgs = handlers['comm:messages']!() as Array<{ limit?: number }>;
    expect(msgs[0].limit).toBe(100);
  });
  it('with ctx: channels/state-entries/feed return snapshots', async () => {
    const { handlers } = await buildH({ withCtx: true });
    expect(handlers['comm:channels']!()).toHaveLength(1);
    expect(handlers['comm:state-entries']!()).toHaveLength(1);
    const feed = handlers['comm:feed']!(7) as Array<{ n: number }>;
    expect(feed[0].n).toBe(7);
  });
});

describe('tasks bridge', () => {
  it('with no ctx: state=null, list/search=[], get=null', async () => {
    const { handlers } = await buildH({ withCtx: false });
    expect(handlers['tasks:state']!()).toBe(null);
    expect(handlers['tasks:list']!({})).toEqual([]);
    expect(handlers['tasks:get']!(1)).toBe(null);
    expect(handlers['tasks:search']!('q')).toEqual([]);
  });
  it('with ctx: state/list/get/search return snapshots', async () => {
    const { handlers } = await buildH({ withCtx: true });
    const st = handlers['tasks:state']!() as { tasks: unknown[] };
    expect(Array.isArray(st.tasks)).toBe(true);
    expect(handlers['tasks:list']!({ stage: 'todo' })).toHaveLength(1);
    expect(handlers['tasks:get']!(9)).toEqual({ id: 9 });
    const s = handlers['tasks:search']!('hi') as Array<{ q: string }>;
    expect(s[0].q).toBe('hi');
  });
});

describe('knowledge bridge', () => {
  it('all knowledge:* handlers return safe defaults on error', async () => {
    const { handlers } = await buildH();
    // These call into the real knowledge bridge; if the memoryDir doesn't
    // exist the handler must catch and return [] / null, not throw.
    expect(() => handlers['knowledge:entries']!()).not.toThrow();
    expect(() => handlers['knowledge:entries']!('projects')).not.toThrow();
    expect(() => handlers['knowledge:read']!('projects', 'nope')).not.toThrow();
    expect(() => handlers['knowledge:read']!('projects')).not.toThrow();
    expect(() => handlers['knowledge:search']!('nothing')).not.toThrow();
    expect(() => handlers['knowledge:sessions']!()).not.toThrow();
    expect(() => handlers['knowledge:session']!('sid', 'proj')).not.toThrow();
  });
});

describe('discover bridge', () => {
  it('with no ctx: handlers return safe defaults', async () => {
    const { handlers } = await buildH({ withCtx: false });
    expect(handlers['discover:state']!()).toBe(null);
    expect(handlers['discover:servers']!()).toEqual([]);
    expect(handlers['discover:server']!(1)).toBe(null);
    expect(await handlers['discover:browse']!('foo')).toEqual({ servers: [], next_cursor: null });
    expect(await handlers['discover:activate']!(1)).toBe(false);
    expect(await handlers['discover:deactivate']!(1)).toBe(false);
    expect(handlers['discover:delete']!(1)).toBe(false);
    expect(handlers['discover:secrets']!(1)).toEqual([]);
    expect(handlers['discover:metrics']!()).toEqual([]);
    expect(handlers['discover:health']!(1)).toBe(null);
  });
  it('with ctx: state/servers/server/browse/secrets/metrics/health return snapshots', async () => {
    const { handlers } = await buildH({ withCtx: true });
    const st = handlers['discover:state']!() as { servers: unknown[] };
    expect(st.servers).toHaveLength(1);
    expect(handlers['discover:servers']!()).toHaveLength(1);
    expect(handlers['discover:server']!(7)).toBeTruthy();
    const br = (await handlers['discover:browse']!('q')) as { servers: unknown[] };
    expect(br.servers).toHaveLength(1);
    // default-query browse path (coalesces to '')
    const br2 = (await handlers['discover:browse']!()) as { servers: unknown[] };
    expect(br2.servers).toHaveLength(1);
    expect(handlers['discover:secrets']!(3)).toEqual([{ sid: 3 }]);
    // metrics: with id -> server metrics; without id -> overview
    expect(handlers['discover:metrics']!(3)).toEqual([{ sid: 3 }]);
    expect(handlers['discover:metrics']!()).toEqual([{ overview: true }]);
    expect(handlers['discover:health']!(3)).toEqual({ sid: 3, status: 'ok' });
  });
  it('activate / deactivate / delete succeed with ctx', async () => {
    const { bridges, handlers } = await buildH({ withCtx: true });
    expect(await handlers['discover:activate']!(7)).toBe(true);
    const ctx = bridges.discoverCtx as unknown as {
      proxy: { activate: ReturnType<typeof vi.fn>; deactivate: ReturnType<typeof vi.fn> };
      registry: { setActive: ReturnType<typeof vi.fn>; unregister: ReturnType<typeof vi.fn> };
    };
    expect(ctx.proxy.activate).toHaveBeenCalled();
    expect(ctx.registry.setActive).toHaveBeenCalledWith('srv', true);
    expect(await handlers['discover:deactivate']!(7)).toBe(true);
    expect(ctx.proxy.deactivate).toHaveBeenCalledWith('srv');
    expect(ctx.registry.setActive).toHaveBeenCalledWith('srv', false);
    expect(handlers['discover:delete']!(7)).toBe(true);
    expect(ctx.registry.unregister).toHaveBeenCalledWith('srv');
  });
  it('activate returns false when server has no command', async () => {
    const { handlers } = await buildH({ withCtx: true, discoverServer: { id: 7, name: 'srv' } });
    expect(await handlers['discover:activate']!(7)).toBe(false);
  });
  it('activate catches proxy errors and returns false', async () => {
    const { handlers } = await buildH({ withCtx: true, failActivate: true });
    expect(await handlers['discover:activate']!(7)).toBe(false);
  });
});

describe('system / app / mcp / plugins', () => {
  it('system:stats returns a SystemStats-shaped object', async () => {
    const { handlers } = await buildH();
    const s = handlers['system:stats']!() as { cpu: number; ram: unknown; disk: unknown };
    expect(typeof s.cpu).toBe('number');
    expect(s.ram).toBeDefined();
    expect(s.disk).toBeDefined();
  });
  it('system:start-monitoring / stop-monitoring do not throw', async () => {
    const { handlers } = await buildH();
    expect(() => handlers['system:start-monitoring']!()).not.toThrow();
    expect(() => handlers['system:stop-monitoring']!()).not.toThrow();
  });
  it('app:reportError writes a crash log (no throw)', async () => {
    const { handlers } = await buildH();
    expect(() => handlers['app:reportError']!({ message: 'oops', stack: 'trace', source: 'renderer' })).not.toThrow();
    expect(() => handlers['app:reportError']!({ message: 'noStack', source: 'renderer' })).not.toThrow();
  });
  it('app:getCrashLogDir returns a string', async () => {
    const { handlers } = await buildH();
    expect(typeof handlers['app:getCrashLogDir']!()).toBe('string');
  });
  it('mcp:detect-tools returns an array', async () => {
    const { handlers } = await buildH();
    expect(Array.isArray(handlers['mcp:detect-tools']!())).toBe(true);
  });
  it('mcp:auto-configure returns an array (does not throw)', async () => {
    const { handlers } = await buildH();
    expect(Array.isArray(handlers['mcp:auto-configure']!())).toBe(true);
  });
});

describe('file:write error path', () => {
  it('returns { ok: false, error } when write fails', async () => {
    const { handlers } = await buildH();
    // Write to a path whose parent is a file (guaranteed EEXIST/ENOTDIR).
    const bad = join(tmpDir, 'no', 'such', 'deep', '\0bad');
    const r = handlers['file:write']!(bad, 'x') as { ok: boolean; error?: string };
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
  });
  it('file:stat returns exists:true + size for an existing file', async () => {
    const { handlers } = await buildH();
    const p = join(tmpDir, 'exists.txt');
    handlers['file:write']!(p, 'hello');
    const s = handlers['file:stat']!(p) as { exists: boolean; size?: number };
    expect(s.exists).toBe(true);
    expect(s.size).toBeGreaterThan(0);
  });
});
