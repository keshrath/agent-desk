// Unit tests for @agent-desk/core/transport/api-shape.ts.
// API_SHAPE is the single declarative source for window.agentDesk; both
// the desktop preload and the web shim build from it. These tests verify
// the iteration helper produces the bucket structure correctly.

import { describe, it, expect, vi } from 'vitest';
import {
  API_SHAPE,
  API_TOPLEVEL,
  buildAgentDeskApi,
  type ApiTransport,
} from '../../packages/core/src/transport/api-shape.js';

function makeStubTransport(): ApiTransport & {
  requests: Array<{ ch: string; args: unknown[] }>;
  commands: Array<{ ch: string; args: unknown[] }>;
  subscribed: Array<{ ch: string; cb: unknown }>;
  localOnlyCalls: Array<{ tag: string; args: unknown[] }>;
} {
  const requests: Array<{ ch: string; args: unknown[] }> = [];
  const commands: Array<{ ch: string; args: unknown[] }> = [];
  const subscribed: Array<{ ch: string; cb: unknown }> = [];
  const localOnlyCalls: Array<{ tag: string; args: unknown[] }> = [];
  return {
    requests,
    commands,
    subscribed,
    localOnlyCalls,
    request(channel, args) {
      requests.push({ ch: channel, args });
      return { _stub: 'request', channel };
    },
    command(channel, args) {
      commands.push({ ch: channel, args });
    },
    subscribe(channel, callback) {
      subscribed.push({ ch: channel, cb: callback });
      return () => {};
    },
    localOnly(tag, args) {
      localOnlyCalls.push({ tag, args });
      return { _stub: 'localOnly', tag };
    },
  };
}

describe('API_SHAPE — structure', () => {
  it('has every documented bucket', () => {
    const expected = [
      'terminal',
      'session',
      'window',
      'dialog',
      'file',
      'config',
      'keybindings',
      'history',
      'system',
      'app',
      'comm',
      'tasks',
      'knowledge',
      'discover',
      'mcp',
      'plugins',
    ];
    for (const bucket of expected) {
      expect(API_SHAPE).toHaveProperty(bucket);
    }
  });

  it('exposes top-level localOnly methods (notify, openExternal, etc.)', () => {
    expect(API_TOPLEVEL).toHaveProperty('notify');
    expect(API_TOPLEVEL).toHaveProperty('openExternal');
    expect(API_TOPLEVEL).toHaveProperty('openPath');
    expect(API_TOPLEVEL).toHaveProperty('setLoginItem');
  });
});

describe('buildAgentDeskApi() — request bindings', () => {
  it('builds bucket.method functions that call transport.request with the channel name + args', () => {
    const transport = makeStubTransport();
    const api = buildAgentDeskApi(transport);
    api.terminal.write('id-1', 'hello');
    expect(transport.requests).toHaveLength(1);
    expect(transport.requests[0].ch).toBe('terminal:write');
    expect(transport.requests[0].args).toEqual(['id-1', 'hello']);
  });

  it('passes {} as a default first arg when defaultEmptyOpts is set and no args supplied', () => {
    const transport = makeStubTransport();
    const api = buildAgentDeskApi(transport);
    api.terminal.create();
    expect(transport.requests[0].args).toEqual([{}]);
  });
});

describe('buildAgentDeskApi() — command bindings', () => {
  it('builds bucket.method functions that call transport.command and return undefined', () => {
    const transport = makeStubTransport();
    const api = buildAgentDeskApi(transport);
    const result = api.terminal.subscribe('term-1');
    expect(transport.commands[0].ch).toBe('terminal:subscribe');
    expect(transport.commands[0].args).toEqual(['term-1']);
    expect(result).toBeUndefined();
  });
});

describe('buildAgentDeskApi() — subscribe bindings', () => {
  it('builds bucket.method functions that wire callbacks via transport.subscribe', () => {
    const transport = makeStubTransport();
    const api = buildAgentDeskApi(transport);
    const callback = vi.fn();
    api.terminal.onData(callback);
    expect(transport.subscribed).toHaveLength(1);
    expect(transport.subscribed[0].ch).toBe('terminal:data');
    expect(transport.subscribed[0].cb).toBe(callback);
  });
});

describe('buildAgentDeskApi() — localOnly bindings', () => {
  it('routes window.minimize through transport.localOnly with the correct tag', () => {
    const transport = makeStubTransport();
    const api = buildAgentDeskApi(transport);
    api.window.minimize();
    expect(transport.localOnlyCalls).toHaveLength(1);
    expect(transport.localOnlyCalls[0].tag).toBe('window.minimize');
  });

  it('routes top-level methods (openExternal, notify) via localOnly', () => {
    const transport = makeStubTransport();
    const api = buildAgentDeskApi(transport);
    api.openExternal('https://example.com');
    api.notify('Title', 'Body');
    const tags = transport.localOnlyCalls.map((c) => c.tag);
    expect(tags).toContain('shell.openExternal');
    expect(tags).toContain('app.notify');
  });

  it('forwards args to localOnly verbatim', () => {
    const transport = makeStubTransport();
    const api = buildAgentDeskApi(transport);
    api.dialog.saveFile({ defaultPath: '/tmp/x.txt' });
    expect(transport.localOnlyCalls[0].args).toEqual([{ defaultPath: '/tmp/x.txt' }]);
  });
});
