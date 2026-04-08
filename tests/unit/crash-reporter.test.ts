// Unit tests for @agent-desk/core/crash-reporter.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-desk-crash-'));
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

describe('crash-reporter', () => {
  it('writeCrashLog() creates the crash dir and writes a log file', async () => {
    const { writeCrashLog, CRASH_LOG_DIR } = await import('../../packages/core/src/crash-reporter.js');
    const path = writeCrashLog(new Error('boom'));
    expect(existsSync(path)).toBe(true);
    expect(path.startsWith(CRASH_LOG_DIR)).toBe(true);

    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('Agent Desk Crash Report');
    expect(content).toContain('Error: boom');
  });

  it('writeCrashLog() includes the app version when set via setAppVersion()', async () => {
    const { writeCrashLog, setAppVersion } = await import('../../packages/core/src/crash-reporter.js');
    setAppVersion('9.9.9-test');
    const path = writeCrashLog(new Error('versioned'));
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('App Version: 9.9.9-test');
  });

  it('writeCrashLog() handles string errors', async () => {
    const { writeCrashLog } = await import('../../packages/core/src/crash-reporter.js');
    const path = writeCrashLog('plain string error');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('Error: plain string error');
  });

  it('writeCrashLog() rotates: keeps at most 10 most-recent log files', async () => {
    const { writeCrashLog, CRASH_LOG_DIR } = await import('../../packages/core/src/crash-reporter.js');
    for (let i = 0; i < 15; i++) {
      writeCrashLog(new Error(`crash ${i}`));
      // small backdate so timestamps differ
      const files = readdirSync(CRASH_LOG_DIR);
      const target = join(CRASH_LOG_DIR, files[files.length - 1]);
      const t = new Date(2024, 0, 1, i);
      utimesSync(target, t, t);
    }
    const remaining = readdirSync(CRASH_LOG_DIR).filter((f) => f.startsWith('crash-'));
    expect(remaining.length).toBeLessThanOrEqual(10);
  });

  it('hasRecentCrashLogs() returns true when a crash file is younger than 5 minutes', async () => {
    const { writeCrashLog, hasRecentCrashLogs } = await import('../../packages/core/src/crash-reporter.js');
    writeCrashLog(new Error('fresh'));
    const r = hasRecentCrashLogs();
    expect(r.hasCrash).toBe(true);
    expect(r.dir).toBeTruthy();
  });

  it('hasRecentCrashLogs() returns false when only old files exist', async () => {
    const { writeCrashLog, hasRecentCrashLogs, CRASH_LOG_DIR } =
      await import('../../packages/core/src/crash-reporter.js');
    writeCrashLog(new Error('stale'));
    const files = readdirSync(CRASH_LOG_DIR).filter((f) => f.startsWith('crash-'));
    const oldTime = new Date(Date.now() - 60 * 60 * 1000);
    for (const f of files) {
      utimesSync(join(CRASH_LOG_DIR, f), oldTime, oldTime);
    }
    expect(hasRecentCrashLogs().hasCrash).toBe(false);
  });

  it('getLatestCrashLog() returns the newest log content', async () => {
    const { writeCrashLog, getLatestCrashLog } = await import('../../packages/core/src/crash-reporter.js');
    writeCrashLog(new Error('first'));
    await new Promise((r) => setTimeout(r, 5));
    writeCrashLog(new Error('second'));
    const latest = getLatestCrashLog();
    expect(latest).not.toBe(null);
    expect(latest!.content).toContain('second');
  });

  it('getLatestCrashLog() returns null with no logs', async () => {
    const { getLatestCrashLog } = await import('../../packages/core/src/crash-reporter.js');
    expect(getLatestCrashLog()).toBe(null);
  });
});
