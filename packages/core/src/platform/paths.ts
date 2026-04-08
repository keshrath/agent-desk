// Platform-agnostic path resolver. Replaces Electron's app.getPath('userData')
// so that @agent-desk/core has zero Electron dependency.
//
// Override roots via env vars (XDG-style):
//   AGENT_DESK_USER_DATA — userData root (default: ~/.agent-desk)
//   AGENT_DESK_CACHE     — cache root    (default: ~/.agent-desk/cache)
//   AGENT_DESK_LOGS      — logs root     (default: ~/.agent-desk/logs)

import { homedir } from 'os';
import { join } from 'path';

const ROOT = process.env.AGENT_DESK_USER_DATA || join(homedir(), '.agent-desk');

export function userData(...segments: string[]): string {
  return join(ROOT, ...segments);
}

export function cacheDir(...segments: string[]): string {
  return join(process.env.AGENT_DESK_CACHE || join(ROOT, 'cache'), ...segments);
}

export function logsDir(...segments: string[]): string {
  return join(process.env.AGENT_DESK_LOGS || join(ROOT, 'logs'), ...segments);
}

export const USER_DATA_ROOT = ROOT;
