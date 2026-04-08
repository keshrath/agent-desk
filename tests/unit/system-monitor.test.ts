// Unit tests for @agent-desk/core/system-monitor. Each test re-imports the
// module so the internal cached stats / interval / callback / previousCpuTimes
// module-level state starts fresh.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';

// Hoisted mock for child_process.execFile. Tests override the implementation
// via execFileMock.mockImplementation(...) before re-importing the module.
const execFileMock = vi.hoisted(() => vi.fn());
vi.mock('child_process', () => ({
  execFile: execFileMock,
}));

const osMocks = vi.hoisted(() => ({
  cpus: vi.fn(),
  totalmem: vi.fn(),
  freemem: vi.fn(),
}));
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return {
    ...actual,
    default: {
      ...actual,
      cpus: (...a: unknown[]) => osMocks.cpus(...a),
      totalmem: (...a: unknown[]) => osMocks.totalmem(...a),
      freemem: (...a: unknown[]) => osMocks.freemem(...a),
    },
    cpus: (...a: unknown[]) => osMocks.cpus(...a),
    totalmem: (...a: unknown[]) => osMocks.totalmem(...a),
    freemem: (...a: unknown[]) => osMocks.freemem(...a),
  };
});

type CpuInfo = ReturnType<typeof os.cpus>[number];

function makeCpus(user: number, nice: number, sys: number, idle: number, irq: number): CpuInfo[] {
  return [
    {
      model: 'test',
      speed: 1000,
      times: { user, nice, sys, idle, irq },
    } as CpuInfo,
  ];
}

/** Default execFile impl: stdout for Windows (powershell) JSON. */
function winDiskOk(used = 50, free = 50) {
  execFileMock.mockImplementation((cmd: string, _args: unknown, _opts: unknown, cb: any) => {
    cb(null, JSON.stringify({ Used: used, Free: free }), '');
  });
}

function linuxDfOk() {
  execFileMock.mockImplementation((cmd: string, _args: unknown, _opts: unknown, cb: any) => {
    // df -k / format: header line then data line
    const stdout = 'Filesystem 1K-blocks Used Available Use% Mounted\n/dev/sda1 1000 250 750 25% /\n';
    cb(null, stdout, '');
  });
}

function execFileErr() {
  execFileMock.mockImplementation((cmd: string, _args: unknown, _opts: unknown, cb: any) => {
    cb(new Error('boom'), '', 'stderr');
  });
}

const realPlatform = process.platform;
function setPlatform(p: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: p, configurable: true });
}

beforeEach(() => {
  vi.resetModules();
  execFileMock.mockReset();
  osMocks.cpus.mockReset();
  osMocks.totalmem.mockReset();
  osMocks.freemem.mockReset();
  osMocks.cpus.mockReturnValue(makeCpus(1, 0, 1, 1, 0));
  osMocks.totalmem.mockReturnValue(1);
  osMocks.freemem.mockReturnValue(1);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(process, 'platform', { value: realPlatform, configurable: true });
  vi.restoreAllMocks();
});

describe('system-monitor', () => {
  it('getSystemStats() returns zeroed stats before monitoring starts', async () => {
    const mod = await import('../../packages/core/src/system-monitor.js');
    const stats = mod.getSystemStats();
    expect(stats).toEqual({
      cpu: 0,
      ram: { used: 0, total: 0, percent: 0 },
      disk: { used: 0, total: 0, percent: 0 },
    });
  });

  it('collectStats via startMonitoring updates cached stats (RAM + CPU + Win disk)', async () => {
    setPlatform('win32');
    winDiskOk(75, 25);
    osMocks.totalmem.mockReturnValue(1000);
    osMocks.freemem.mockReturnValue(250);
    let cpuCall = 0;
    osMocks.cpus.mockImplementation(() => {
      cpuCall++;
      return cpuCall === 1 ? makeCpus(0, 0, 0, 0, 0) : makeCpus(50, 0, 50, 100, 0);
    });

    const mod = await import('../../packages/core/src/system-monitor.js');
    mod.startMonitoring();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const stats = mod.getSystemStats();
    expect(stats.ram.total).toBe(1000);
    expect(stats.ram.used).toBe(750);
    expect(stats.ram.percent).toBe(75);
    expect(stats.cpu).toBe(50);
    expect(stats.disk.total).toBe(100);
    expect(stats.disk.used).toBe(75);
    expect(stats.disk.percent).toBe(75);

    mod.stopMonitoring();
  });

  it('linux df path parses disk stats', async () => {
    setPlatform('linux');
    linuxDfOk();
    osMocks.totalmem.mockReturnValue(100);
    osMocks.freemem.mockReturnValue(50);
    osMocks.cpus.mockReturnValue(makeCpus(1, 0, 1, 1, 0));

    const mod = await import('../../packages/core/src/system-monitor.js');
    let received: any = null;
    mod.onStatsUpdate((s) => {
      received = s;
    });
    mod.startMonitoring();
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    await Promise.resolve();

    expect(received).not.toBeNull();
    expect(received.disk.total).toBe(1000 * 1024);
    expect(received.disk.used).toBe(250 * 1024);
    expect(received.disk.percent).toBe(25);
    mod.stopMonitoring();
  });

  it('disk falls back to zeros when execFile errors (win32)', async () => {
    setPlatform('win32');
    execFileErr();
    osMocks.cpus.mockReturnValue(makeCpus(1, 0, 1, 1, 0));
    const mod = await import('../../packages/core/src/system-monitor.js');
    mod.startMonitoring();
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    expect(mod.getSystemStats().disk).toEqual({ used: 0, total: 0, percent: 0 });
    mod.stopMonitoring();
  });

  it('disk falls back to zeros when execFile errors (linux)', async () => {
    setPlatform('linux');
    execFileErr();
    osMocks.cpus.mockReturnValue(makeCpus(1, 0, 1, 1, 0));
    const mod = await import('../../packages/core/src/system-monitor.js');
    mod.startMonitoring();
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    expect(mod.getSystemStats().disk).toEqual({ used: 0, total: 0, percent: 0 });
    mod.stopMonitoring();
  });

  it('disk falls back when powershell stdout is unparseable JSON', async () => {
    setPlatform('win32');
    execFileMock.mockImplementation((cmd: string, _args: unknown, _opts: unknown, cb: any) => {
      cb(null, 'not json', '');
    });
    osMocks.cpus.mockReturnValue(makeCpus(1, 0, 1, 1, 0));
    const mod = await import('../../packages/core/src/system-monitor.js');
    mod.startMonitoring();
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    expect(mod.getSystemStats().disk).toEqual({ used: 0, total: 0, percent: 0 });
    mod.stopMonitoring();
  });

  it('disk falls back when df output has <2 lines', async () => {
    setPlatform('linux');
    execFileMock.mockImplementation((cmd: string, _args: unknown, _opts: unknown, cb: any) => {
      cb(null, 'only-header\n', '');
    });
    osMocks.cpus.mockReturnValue(makeCpus(1, 0, 1, 1, 0));
    const mod = await import('../../packages/core/src/system-monitor.js');
    mod.startMonitoring();
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    expect(mod.getSystemStats().disk).toEqual({ used: 0, total: 0, percent: 0 });
    mod.stopMonitoring();
  });

  it('disk percent handles total=0 as 0% (win32)', async () => {
    setPlatform('win32');
    winDiskOk(0, 0);
    osMocks.cpus.mockReturnValue(makeCpus(1, 0, 1, 1, 0));
    const mod = await import('../../packages/core/src/system-monitor.js');
    mod.startMonitoring();
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    const s = mod.getSystemStats();
    expect(s.disk.percent).toBe(0);
    expect(s.disk.total).toBe(0);
    mod.stopMonitoring();
  });

  it('CPU percent is 0 on first sample and 0 when totalDelta is 0', async () => {
    setPlatform('linux');
    linuxDfOk();
    osMocks.cpus.mockReturnValue(makeCpus(10, 0, 10, 10, 0));
    const mod = await import('../../packages/core/src/system-monitor.js');
    mod.startMonitoring();
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    expect(mod.getSystemStats().cpu).toBe(0);
    await vi.advanceTimersByTimeAsync(2100);
    await Promise.resolve();
    expect(mod.getSystemStats().cpu).toBe(0);
    mod.stopMonitoring();
  });

  it('startMonitoring is idempotent (second call is a no-op)', async () => {
    setPlatform('linux');
    linuxDfOk();
    osMocks.cpus.mockReturnValue(makeCpus(1, 0, 1, 1, 0));
    const mod = await import('../../packages/core/src/system-monitor.js');
    mod.startMonitoring();
    const firstCount = vi.getTimerCount();
    mod.startMonitoring();
    const secondCount = vi.getTimerCount();
    expect(secondCount).toBe(firstCount);
    mod.stopMonitoring();
  });

  it('stopMonitoring clears the interval and callback; no further updates', async () => {
    setPlatform('linux');
    linuxDfOk();
    osMocks.cpus.mockReturnValue(makeCpus(1, 0, 1, 1, 0));
    const mod = await import('../../packages/core/src/system-monitor.js');
    let calls = 0;
    mod.onStatsUpdate(() => {
      calls++;
    });
    mod.startMonitoring();
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    const before = calls;
    mod.stopMonitoring();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    await Promise.resolve();
    expect(calls).toBe(before);
  });

  it('onStatsUpdate callback fires on each 2s tick', async () => {
    setPlatform('linux');
    linuxDfOk();
    osMocks.cpus.mockReturnValue(makeCpus(1, 0, 1, 1, 0));
    const mod = await import('../../packages/core/src/system-monitor.js');
    const cb = vi.fn();
    mod.onStatsUpdate(cb);
    mod.startMonitoring();
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    await Promise.resolve();
    const initial = cb.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2100);
    await Promise.resolve();
    await Promise.resolve();
    expect(cb.mock.calls.length).toBeGreaterThan(initial);
    mod.stopMonitoring();
  });

  it('stopMonitoring before startMonitoring is a no-op', async () => {
    const mod = await import('../../packages/core/src/system-monitor.js');
    expect(() => mod.stopMonitoring()).not.toThrow();
  });
});
