// Integration test for the @agent-desk/server rate limiter and terminal cap.
// Spawns the server with a tiny burst limit + cap, fires enough traffic to
// trip them, asserts the limits are enforced.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import WebSocket from 'ws';

const SERVER_BIN = join(__dirname, '..', '..', 'packages', 'server', 'dist', 'index.js');
const PORT = 3494;
const TOKEN = 'rate-limit-test-token';

let server: ChildProcess | null = null;

function waitForServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server boot timeout')), 5000);
    server!.stdout!.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes(`http://127.0.0.1:${PORT}`)) {
        clearTimeout(timeout);
        setTimeout(resolve, 100);
      }
    });
  });
}

async function openWs(): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?t=${TOKEN}`);
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  return ws;
}

function collectMessages(ws: WebSocket, count: number, timeoutMs = 3000): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const out: unknown[] = [];
    const timeout = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error(`only got ${out.length}/${count} in ${timeoutMs}ms`));
    }, timeoutMs);
    const onMessage = (buf: WebSocket.RawData) => {
      out.push(JSON.parse(buf.toString()));
      if (out.length >= count) {
        clearTimeout(timeout);
        ws.off('message', onMessage);
        resolve(out);
      }
    };
    ws.on('message', onMessage);
  });
}

describe.skipIf(!existsSync(SERVER_BIN))('@agent-desk/server rate limiting', () => {
  beforeAll(async () => {
    server = spawn('node', [SERVER_BIN], {
      env: {
        ...process.env,
        AGENT_DESK_PORT: String(PORT),
        AGENT_DESK_TOKEN: TOKEN,
        AGENT_DESK_RATE_LIMIT_RPS: '5',
        AGENT_DESK_RATE_LIMIT_BURST: '10',
        AGENT_DESK_TERMINAL_CAP: '3',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForServer();
  }, 10_000);

  afterAll(() => {
    if (server) {
      server.kill();
      server = null;
    }
  });

  it('serves the burst then rate-limits the next message', async () => {
    const ws = await openWs();
    const total = 15;
    const collect = collectMessages(ws, total);
    for (let i = 1; i <= total; i++) {
      ws.send(JSON.stringify({ id: i, ch: 'system:stats' }));
    }
    const msgs = (await collect) as Array<{ id: number; result?: unknown; error?: string }>;
    const rateLimited = msgs.filter((m) => m.error === 'rate limit exceeded');
    expect(rateLimited.length).toBeGreaterThan(0);
    const ok = msgs.filter((m) => m.result !== undefined);
    expect(ok.length).toBeGreaterThan(0);
    expect(ok.length).toBeLessThanOrEqual(11);
    ws.close();
  }, 10_000);

  it('rejects terminal:create above the cap', async () => {
    const ws = await openWs();
    const responses: Array<{ id: number; result?: unknown; error?: string }> = [];
    const collected = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
      ws.on('message', (buf) => {
        responses.push(JSON.parse(buf.toString()));
        if (responses.length >= 5) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    for (let i = 1; i <= 5; i++) {
      ws.send(JSON.stringify({ id: i, ch: 'terminal:create', args: [{}] }));
      await new Promise((r) => setTimeout(r, 250));
    }
    await collected;
    const successful = responses.filter((r) => r.result !== undefined && !r.error);
    const capped = responses.filter((r) => r.error?.includes('terminal cap'));
    expect(successful.length).toBeLessThanOrEqual(3);
    expect(capped.length).toBeGreaterThan(0);
    if (successful.length > 0) {
      const okIds = successful
        .map((r) => (r.result as { id: string } | undefined)?.id)
        .filter((id): id is string => typeof id === 'string');
      for (const id of okIds) {
        ws.send(JSON.stringify({ ch: 'terminal:kill', args: [id] }));
      }
    }
    ws.close();
  }, 15_000);
});
