// Unit tests for @agent-desk/core/transport/router.ts.
// The router is the architectural backbone of the dual-target design —
// every channel from the contract dispatches through it. These tests
// exercise both the typed (request/command) and runtime-string
// (dispatchRequest/dispatchCommand) entry points plus the push event bus.

import { describe, it, expect, vi } from 'vitest';
import { createRouter } from '../../packages/core/src/transport/router.js';

describe('createRouter — request channels', () => {
  it('dispatches request() to the registered handler', async () => {
    const handler = vi.fn(() => true);
    const router = createRouter({
      requestHandlers: { 'terminal:write': handler as never },
      commandHandlers: {},
    });
    const result = await router.request('terminal:write', 'id-1', 'data');
    expect(handler).toHaveBeenCalledWith('id-1', 'data');
    expect(result).toBe(true);
  });

  it('throws on request() to an unknown channel', async () => {
    const router = createRouter({ requestHandlers: {}, commandHandlers: {} });
    await expect(router.request('terminal:write' as never, 'id', 'data' as never)).rejects.toThrow(/No handler/);
  });

  it('dispatchRequest() resolves runtime-string channels', async () => {
    const router = createRouter({
      requestHandlers: { 'system:stats': () => ({ cpu: 42, ram: { used: 0, total: 0, percent: 0 }, disk: { used: 0, total: 0, percent: 0 } }) as never },
      commandHandlers: {},
    });
    const result = (await router.dispatchRequest('system:stats', [])) as { cpu: number };
    expect(result.cpu).toBe(42);
  });

  it('dispatchRequest() rejects unknown channel with a clear error', async () => {
    const router = createRouter({ requestHandlers: {}, commandHandlers: {} });
    await expect(router.dispatchRequest('not-a-channel', [])).rejects.toThrow(/No handler/);
  });

  it('request() awaits async handlers', async () => {
    const router = createRouter({
      requestHandlers: {
        'terminal:list': (async () => {
          await new Promise((r) => setTimeout(r, 5));
          return [{ id: 'a' }];
        }) as never,
      },
      commandHandlers: {},
    });
    const result = await router.request('terminal:list');
    expect(result).toEqual([{ id: 'a' }]);
  });
});

describe('createRouter — command channels', () => {
  it('dispatches command() synchronously', () => {
    const handler = vi.fn();
    const router = createRouter({
      requestHandlers: {},
      commandHandlers: { 'terminal:subscribe': handler as never },
    });
    router.command('terminal:subscribe', 'term-1');
    expect(handler).toHaveBeenCalledWith('term-1');
  });

  it('throws on command() to an unknown channel', () => {
    const router = createRouter({ requestHandlers: {}, commandHandlers: {} });
    expect(() => router.command('terminal:subscribe' as never, 'id' as never)).toThrow(/No handler/);
  });

  it('dispatchCommand() resolves runtime-string channels', () => {
    const handler = vi.fn();
    const router = createRouter({
      requestHandlers: {},
      commandHandlers: { 'terminal:unsubscribe': handler as never },
    });
    router.dispatchCommand('terminal:unsubscribe', ['term-1']);
    expect(handler).toHaveBeenCalledWith('term-1');
  });
});

describe('createRouter — push event bus', () => {
  it('emit() delivers args to subscribed listeners', () => {
    const router = createRouter({ requestHandlers: {}, commandHandlers: {} });
    const listener = vi.fn();
    router.on('terminal:data', listener);
    router.emit('terminal:data', 'id-1', 'output');
    expect(listener).toHaveBeenCalledWith('id-1', 'output');
  });

  it('on() returns an unsubscribe fn that detaches the listener', () => {
    const router = createRouter({ requestHandlers: {}, commandHandlers: {} });
    const listener = vi.fn();
    const off = router.on('terminal:data', listener);
    router.emit('terminal:data', 'id-1', 'first');
    off();
    router.emit('terminal:data', 'id-1', 'second');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('id-1', 'first');
  });

  it('emit() to a channel with no listeners is a no-op', () => {
    const router = createRouter({ requestHandlers: {}, commandHandlers: {} });
    expect(() => router.emit('config:changed', { version: 1, settings: {}, profiles: [], workspaces: {} })).not.toThrow();
  });

  it('multiple listeners on the same channel all receive the event', () => {
    const router = createRouter({ requestHandlers: {}, commandHandlers: {} });
    const a = vi.fn();
    const b = vi.fn();
    router.on('history:new', a);
    router.on('history:new', b);
    router.emit('history:new', { command: 'ls', terminalId: 't', terminalTitle: 'T', timestamp: 0 });
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });
});

describe('createRouter — channel introspection', () => {
  it('exposes requestChannels and commandChannels for the IPC bridge to enumerate', () => {
    const router = createRouter({
      requestHandlers: {
        'terminal:write': (() => true) as never,
        'system:stats': (() => null) as never,
      },
      commandHandlers: { 'terminal:subscribe': (() => {}) as never },
    });
    expect(router.requestChannels).toContain('terminal:write');
    expect(router.requestChannels).toContain('system:stats');
    expect(router.commandChannels).toContain('terminal:subscribe');
  });
});
