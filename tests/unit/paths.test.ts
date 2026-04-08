// Unit tests for @agent-desk/core/platform/paths.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';

beforeEach(() => {
  delete process.env.AGENT_DESK_USER_DATA;
  delete process.env.AGENT_DESK_CACHE;
  delete process.env.AGENT_DESK_LOGS;
  vi.resetModules();
});

afterEach(() => {
  delete process.env.AGENT_DESK_USER_DATA;
  delete process.env.AGENT_DESK_CACHE;
  delete process.env.AGENT_DESK_LOGS;
});

describe('platform/paths', () => {
  it('userData() defaults to ~/.agent-desk', async () => {
    const { userData, USER_DATA_ROOT } = await import('../../packages/core/src/platform/paths.js');
    expect(USER_DATA_ROOT).toBe(join(homedir(), '.agent-desk'));
    expect(userData('config.json')).toBe(join(homedir(), '.agent-desk', 'config.json'));
  });

  it('userData() honors AGENT_DESK_USER_DATA override', async () => {
    process.env.AGENT_DESK_USER_DATA = '/tmp/custom-root';
    const { userData, USER_DATA_ROOT } = await import('../../packages/core/src/platform/paths.js');
    expect(USER_DATA_ROOT).toBe('/tmp/custom-root');
    expect(userData('a', 'b.json').replace(/\\/g, '/')).toBe('/tmp/custom-root/a/b.json');
  });

  it('cacheDir() defaults to <root>/cache', async () => {
    process.env.AGENT_DESK_USER_DATA = '/tmp/root';
    const { cacheDir } = await import('../../packages/core/src/platform/paths.js');
    expect(cacheDir('x').replace(/\\/g, '/')).toBe('/tmp/root/cache/x');
  });

  it('cacheDir() honors AGENT_DESK_CACHE override', async () => {
    process.env.AGENT_DESK_USER_DATA = '/tmp/root';
    process.env.AGENT_DESK_CACHE = '/var/cache/ad';
    const { cacheDir } = await import('../../packages/core/src/platform/paths.js');
    expect(cacheDir('y').replace(/\\/g, '/')).toBe('/var/cache/ad/y');
  });

  it('logsDir() defaults to <root>/logs and honors AGENT_DESK_LOGS', async () => {
    process.env.AGENT_DESK_USER_DATA = '/tmp/root';
    let m = await import('../../packages/core/src/platform/paths.js');
    expect(m.logsDir('z').replace(/\\/g, '/')).toBe('/tmp/root/logs/z');

    vi.resetModules();
    process.env.AGENT_DESK_LOGS = '/var/log/ad';
    m = await import('../../packages/core/src/platform/paths.js');
    expect(m.logsDir('z').replace(/\\/g, '/')).toBe('/var/log/ad/z');
  });
});
