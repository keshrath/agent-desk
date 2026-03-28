// =============================================================================
// Agent Desk — System Monitor (CPU, RAM, Disk)
// =============================================================================
// Collects system metrics using Node.js built-in modules only.
// =============================================================================

import os from 'os';
import { execFile } from 'child_process';

export interface SystemStats {
  cpu: number;
  ram: { used: number; total: number; percent: number };
  disk: { used: number; total: number; percent: number };
}

let cachedStats: SystemStats = {
  cpu: 0,
  ram: { used: 0, total: 0, percent: 0 },
  disk: { used: 0, total: 0, percent: 0 },
};

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let previousCpuTimes: { idle: number; total: number } | null = null;
let statsUpdateCallback: ((stats: SystemStats) => void) | null = null;

// ---------------------------------------------------------------------------
// CPU
// ---------------------------------------------------------------------------

function getCpuTimes(): { idle: number; total: number } {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }
  return { idle, total };
}

function calculateCpuPercent(): number {
  const current = getCpuTimes();
  if (!previousCpuTimes) {
    previousCpuTimes = current;
    return 0;
  }
  const idleDelta = current.idle - previousCpuTimes.idle;
  const totalDelta = current.total - previousCpuTimes.total;
  previousCpuTimes = current;
  if (totalDelta === 0) return 0;
  return Math.round(((totalDelta - idleDelta) / totalDelta) * 100);
}

// ---------------------------------------------------------------------------
// RAM
// ---------------------------------------------------------------------------

function getRamStats(): { used: number; total: number; percent: number } {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    used,
    total,
    percent: Math.round((used / total) * 100),
  };
}

// ---------------------------------------------------------------------------
// Disk
// ---------------------------------------------------------------------------

function getDiskStats(): Promise<{ used: number; total: number; percent: number }> {
  return new Promise((resolve) => {
    const fallback = { used: 0, total: 0, percent: 0 };

    if (process.platform === 'win32') {
      execFile(
        'powershell',
        ['-NoProfile', '-Command', 'Get-PSDrive C | Select-Object Used,Free | ConvertTo-Json'],
        { timeout: 5000 },
        (err, stdout) => {
          if (err) {
            resolve(fallback);
            return;
          }
          try {
            const data = JSON.parse(stdout.trim());
            const used = Number(data.Used) || 0;
            const free = Number(data.Free) || 0;
            const total = used + free;
            resolve({
              used,
              total,
              percent: total > 0 ? Math.round((used / total) * 100) : 0,
            });
          } catch {
            resolve(fallback);
          }
        },
      );
    } else {
      // Linux / macOS
      execFile('df', ['-k', '/'], { timeout: 5000 }, (err, stdout) => {
        if (err) {
          resolve(fallback);
          return;
        }
        try {
          const lines = stdout.trim().split('\n');
          if (lines.length < 2) {
            resolve(fallback);
            return;
          }
          const parts = lines[1].split(/\s+/);
          const total = parseInt(parts[1], 10) * 1024;
          const used = parseInt(parts[2], 10) * 1024;
          resolve({
            used,
            total,
            percent: total > 0 ? Math.round((used / total) * 100) : 0,
          });
        } catch {
          resolve(fallback);
        }
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Monitoring lifecycle
// ---------------------------------------------------------------------------

async function collectStats(): Promise<void> {
  const cpu = calculateCpuPercent();
  const ram = getRamStats();
  const disk = await getDiskStats();
  cachedStats = { cpu, ram, disk };
  if (statsUpdateCallback) {
    statsUpdateCallback(cachedStats);
  }
}

export function getSystemStats(): SystemStats {
  return cachedStats;
}

export function onStatsUpdate(callback: (stats: SystemStats) => void): void {
  statsUpdateCallback = callback;
}

export function startMonitoring(): void {
  if (monitorInterval) return;
  previousCpuTimes = getCpuTimes();
  collectStats();
  monitorInterval = setInterval(collectStats, 2000);
}

export function stopMonitoring(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  statsUpdateCallback = null;
}
