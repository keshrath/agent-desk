import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';
import { userData } from './platform/paths.js';

const CRASH_DIR = userData('crash-logs');
const MAX_CRASH_LOGS = 10;

// Injected by the host (desktop sets this to app.getVersion()). Defaults to
// 'unknown' so the server target works even if no host calls setAppVersion.
let appVersion = 'unknown';
export function setAppVersion(version: string): void {
  appVersion = version;
}

function ensureCrashDir(): void {
  if (!existsSync(CRASH_DIR)) mkdirSync(CRASH_DIR, { recursive: true });
}

function formatTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function getMemoryUsage(): string {
  try {
    const mem = process.memoryUsage();
    const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
    return `RSS: ${mb(mem.rss)} MB, Heap Used: ${mb(mem.heapUsed)}/${mb(mem.heapTotal)} MB`;
  } catch {
    return 'unavailable';
  }
}

export function writeCrashLog(error: Error | string, source: 'main' | 'renderer' = 'main'): string {
  ensureCrashDir();

  const timestamp = formatTimestamp();
  const filename = `crash-${timestamp}.log`;
  const filepath = join(CRASH_DIR, filename);

  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack || 'No stack trace' : 'No stack trace';

  const content = [
    `Agent Desk Crash Report`,
    `=======================`,
    `Timestamp: ${new Date().toISOString()}`,
    `Source: ${source} process`,
    `App Version: ${appVersion}`,
    `Electron: ${process.versions.electron ?? 'n/a'}`,
    `Platform: ${platform()} ${process.arch}`,
    `Node: ${process.versions.node}`,
    `Memory: ${getMemoryUsage()}`,
    ``,
    `Error: ${errorMessage}`,
    ``,
    `Stack Trace:`,
    stack,
  ].join('\n');

  try {
    writeFileSync(filepath, content, 'utf-8');
  } catch (err) {
    console.error('[agent-desk] Failed to write crash log:', err);
  }

  cleanupOldLogs();

  return filepath;
}

function cleanupOldLogs(): void {
  try {
    const files = readdirSync(CRASH_DIR)
      .filter((f) => f.startsWith('crash-') && f.endsWith('.log'))
      .map((f) => ({
        name: f,
        path: join(CRASH_DIR, f),
        mtime: statSync(join(CRASH_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > MAX_CRASH_LOGS) {
      for (const old of files.slice(MAX_CRASH_LOGS)) {
        unlinkSync(old.path);
      }
    }
  } catch {
    // best-effort cleanup
  }
}

export function hasRecentCrashLogs(): { hasCrash: boolean; dir: string } {
  ensureCrashDir();

  const RECENT_THRESHOLD_MS = 5 * 60 * 1000;
  const now = Date.now();

  try {
    const hasRecent = readdirSync(CRASH_DIR)
      .filter((f) => f.startsWith('crash-') && f.endsWith('.log'))
      .some((f) => now - statSync(join(CRASH_DIR, f)).mtimeMs < RECENT_THRESHOLD_MS);
    return { hasCrash: hasRecent, dir: CRASH_DIR };
  } catch {
    return { hasCrash: false, dir: CRASH_DIR };
  }
}

export function getLatestCrashLog(): { timestamp: string; content: string } | null {
  ensureCrashDir();

  try {
    const files = readdirSync(CRASH_DIR)
      .filter((f) => f.startsWith('crash-') && f.endsWith('.log'))
      .map((f) => ({
        name: f,
        path: join(CRASH_DIR, f),
        mtime: statSync(join(CRASH_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) return null;

    const latest = files[0];
    return {
      timestamp: new Date(latest.mtime).toISOString(),
      content: readFileSync(latest.path, 'utf-8'),
    };
  } catch {
    return null;
  }
}

export function setupCrashHandlers(): void {
  process.on('uncaughtException', (error) => {
    console.error('[agent-desk] Uncaught exception:', error);
    writeCrashLog(error, 'main');
  });

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    console.error('[agent-desk] Unhandled rejection:', error);
    writeCrashLog(error, 'main');
  });
}

export const CRASH_LOG_DIR = CRASH_DIR;
