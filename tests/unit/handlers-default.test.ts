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

function makeStubBridges(opts: { withCtx?: boolean } = {}): AgentBridges {
  const ctx = opts.withCtx
    ? {
        agents: { list: () => [{ id: 'a1' }] },
        channels: { list: () => [{ id: 'c1' }] },
        messages: { list: () => [{ id: 'm1' }] },
        state: { list: () => [] },
        feed: { recent: () => [] },
        tasks: {
          list: () => [{ id: 1, title: 'task' }],
          getById: () => ({ id: 1 }),
          search: () => [{ id: 1 }],
        },
        registry: { list: () => [], getById: () => null },
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
