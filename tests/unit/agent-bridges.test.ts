// Unit tests for @agent-desk/core/agent-bridges.
// Mocks the four SDK constructors so the lifecycle is testable without
// touching the real better-sqlite3 stores.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const commCloseMock = vi.fn();
const tasksCloseMock = vi.fn();
const discoverCloseMock = vi.fn();

vi.mock('agent-comm/dist/lib.js', () => ({
  createContext: vi.fn(() => ({
    agents: { list: () => [{ id: 'a' }] },
    channels: { list: () => [] },
    messages: { list: () => [] },
    state: { list: () => [] },
    feed: { recent: () => [] },
    close: commCloseMock,
  })),
}));

vi.mock('agent-tasks/dist/lib.js', () => ({
  createContext: vi.fn(() => ({
    tasks: { list: () => [{ id: 1 }], getById: () => null, search: () => [] },
    close: tasksCloseMock,
  })),
}));

vi.mock('agent-discover/dist/lib.js', () => ({
  createContext: vi.fn(() => ({
    registry: { list: () => [{ id: 1 }], getById: () => null },
    close: discoverCloseMock,
  })),
}));

vi.mock('agent-knowledge/dist/lib.js', () => ({
  getConfig: () => ({ memoryDir: '/tmp/k' }),
  listEntries: () => [],
  readEntry: () => null,
  searchKnowledge: () => [],
  listSessions: () => [],
  getSessionSummary: () => null,
}));

beforeEach(() => {
  commCloseMock.mockClear();
  tasksCloseMock.mockClear();
  discoverCloseMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AgentBridges — lifecycle', () => {
  it('constructor leaves all contexts null + status() reports uninitialized', async () => {
    const { AgentBridges } = await import('../../packages/core/src/agent-bridges.js');
    const b = new AgentBridges();
    expect(b.commCtx).toBe(null);
    expect(b.tasksCtx).toBe(null);
    expect(b.discoverCtx).toBe(null);
    expect(b.status()).toEqual({ comm: 'uninitialized', tasks: 'uninitialized', discover: 'uninitialized' });
    expect(b.failed).toBe(0);
  });

  it('init() populates all three contexts and status() reports ok', async () => {
    const { AgentBridges } = await import('../../packages/core/src/agent-bridges.js');
    const b = new AgentBridges();
    b.init();
    expect(b.commCtx).not.toBe(null);
    expect(b.tasksCtx).not.toBe(null);
    expect(b.discoverCtx).not.toBe(null);
    expect(b.status()).toEqual({ comm: 'ok', tasks: 'ok', discover: 'ok' });
    expect(b.failed).toBe(0);
  });

  it('close() tears the contexts down and calls each .close()', async () => {
    const { AgentBridges } = await import('../../packages/core/src/agent-bridges.js');
    const b = new AgentBridges();
    b.init();
    b.close();
    expect(b.commCtx).toBe(null);
    expect(b.tasksCtx).toBe(null);
    expect(b.discoverCtx).toBe(null);
    expect(commCloseMock).toHaveBeenCalled();
    expect(tasksCloseMock).toHaveBeenCalled();
    expect(discoverCloseMock).toHaveBeenCalled();
  });

  it('close() then init() works (re-init after close)', async () => {
    const { AgentBridges } = await import('../../packages/core/src/agent-bridges.js');
    const b = new AgentBridges();
    b.init();
    b.close();
    b.init();
    expect(b.commCtx).not.toBe(null);
    expect(b.status().comm).toBe('ok');
  });

  it('failed counter tracks contexts that throw during init', async () => {
    const commLib = await import('agent-comm/dist/lib.js');
    const tasksLib = await import('agent-tasks/dist/lib.js');
    (commLib.createContext as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('better-sqlite3 ABI mismatch');
    });
    (tasksLib.createContext as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('better-sqlite3 ABI mismatch');
    });
    const { AgentBridges } = await import('../../packages/core/src/agent-bridges.js');
    const b = new AgentBridges();
    b.init();
    expect(b.failed).toBe(2);
    expect(b.status().comm).toBe('failed');
    expect(b.status().tasks).toBe('failed');
    expect(b.status().discover).toBe('ok');
  });
});

describe('AgentBridges — startPolling', () => {
  it('emits comm:update / tasks:update / knowledge:update / discover:update on each tick', async () => {
    vi.useFakeTimers();
    const { AgentBridges } = await import('../../packages/core/src/agent-bridges.js');
    const b = new AgentBridges();
    b.init();
    const events: Array<{ ch: string }> = [];
    b.startPolling((channel) => {
      events.push({ ch: channel });
    });
    vi.advanceTimersByTime(2100);
    expect(events.some((e) => e.ch === 'comm:update')).toBe(true);
    expect(events.some((e) => e.ch === 'tasks:update')).toBe(true);
    expect(events.some((e) => e.ch === 'discover:update')).toBe(true);
    vi.advanceTimersByTime(5100);
    expect(events.some((e) => e.ch === 'knowledge:update')).toBe(true);
    b.close();
  });

  it('close() clears the polling intervals — no further emits after close', async () => {
    vi.useFakeTimers();
    const { AgentBridges } = await import('../../packages/core/src/agent-bridges.js');
    const b = new AgentBridges();
    b.init();
    let count = 0;
    b.startPolling(() => {
      count++;
    });
    vi.advanceTimersByTime(2100);
    const after = count;
    b.close();
    vi.advanceTimersByTime(10_000);
    expect(count).toBe(after);
  });
});
