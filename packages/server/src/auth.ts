// Single-user URL token auth. Server generates the token at startup,
// prints the loaded URL to stdout. WS upgrades and HTTP routes both
// require ?t=<token>. Default-binds 127.0.0.1.

import { randomBytes } from 'crypto';
import type { IncomingMessage } from 'http';

export const TOKEN = process.env.AGENT_DESK_TOKEN || randomBytes(24).toString('hex');

export function checkRequestToken(req: IncomingMessage): boolean {
  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams.get('t') === TOKEN;
}

export function checkExpressToken(query: Record<string, unknown>): boolean {
  return query.t === TOKEN;
}
