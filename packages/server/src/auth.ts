// Single-user URL token auth. Server generates the token at startup and
// prints the loaded URL to stdout. WS upgrades and HTTP routes both require
// ?t=<token>. Default-binds 127.0.0.1.
//
// Token resolution precedence:
//   1. process.env.AGENT_DESK_TOKEN — if set, used as-is, nothing persisted.
//   2. userData('server-token') file — if present and non-empty, read/trim.
//   3. Generate fresh randomBytes(24) hex, persist to userData('server-token')
//      with mode 0o600 (best-effort on Windows), then use it.
// This keeps the token stable across restarts (matching the deployment doc)
// while still allowing an env override and a first-boot bootstrap.

import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { dirname } from 'path';
import type { IncomingMessage } from 'http';
import { paths } from '@agent-desk/core';

function resolveToken(): string {
  const fromEnv = process.env.AGENT_DESK_TOKEN;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  const tokenPath = paths.userData('server-token');
  try {
    if (existsSync(tokenPath)) {
      const existing = readFileSync(tokenPath, 'utf-8').trim();
      if (existing.length > 0) return existing;
    }
  } catch {
    /* fall through to regenerate */
  }

  const fresh = randomBytes(24).toString('hex');
  try {
    mkdirSync(dirname(tokenPath), { recursive: true });
    writeFileSync(tokenPath, fresh, { encoding: 'utf-8' });
    try {
      chmodSync(tokenPath, 0o600);
    } catch {
      /* best-effort on Windows */
    }
  } catch (err) {
    process.stderr.write(`[agent-desk] failed to persist server token: ${err}\n`);
  }
  return fresh;
}

export const TOKEN = resolveToken();

export function checkRequestToken(req: IncomingMessage): boolean {
  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams.get('t') === TOKEN;
}

export function checkExpressToken(query: Record<string, unknown>): boolean {
  return query.t === TOKEN;
}
