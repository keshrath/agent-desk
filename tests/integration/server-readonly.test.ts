// Integration test for the @agent-desk/server --readonly flag.
// Spawns the server with AGENT_DESK_SERVER_READONLY=1 and verifies that
// mutating channels return an error while read channels still work.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import WebSocket from 'ws';

const SERVER_BIN = join(__dirname, '..', '..', 'packages', 'server', 'dist', 'index.js');
const PORT = 3495;
const TOKEN = 'readonly-test-token';

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

function rpc(ws: WebSocket, id: number, ch: string, args: unknown[] = []): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`rpc ${ch} timeout`)), 3000);
    const onMessage = (buf: WebSocket.RawData) => {
      const msg = JSON.parse(buf.toString());
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.off('message', onMessage);
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result);
      }
    };
    ws.on('message', onMessage);
    ws.send(JSON.stringify({ id, ch, args }));
  });
}

describe.skipIf(!existsSync(SERVER_BIN))('@agent-desk/server --readonly', () => {
  beforeAll(async () => {
    server = spawn('node', [SERVER_BIN, '--readonly'], {
      env: {
        ...process.env,
        AGENT_DESK_PORT: String(PORT),
        AGENT_DESK_TOKEN: TOKEN,
        AGENT_DESK_SERVER_READONLY: '1',
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

  async function openWs(): Promise<WebSocket> {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?t=${TOKEN}`);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    return ws;
  }

  it('still allows read channels', async () => {
    const ws = await openWs();
    const stats = await rpc(ws, 1, 'system:stats');
    expect(stats).toBeTruthy();
    const config = await rpc(ws, 2, 'config:read');
    expect(config).toBeTruthy();
    ws.close();
  });

  it('blocks terminal:create with a read-only error', async () => {
    const ws = await openWs();
    await expect(rpc(ws, 1, 'terminal:create', [{}])).rejects.toThrow(/read-only/);
    ws.close();
  });

  it('blocks config:write', async () => {
    const ws = await openWs();
    await expect(rpc(ws, 1, 'config:write', [{}])).rejects.toThrow(/read-only/);
    ws.close();
  });

  it('blocks file:write', async () => {
    const ws = await openWs();
    await expect(rpc(ws, 1, 'file:write', ['/tmp/x', 'data'])).rejects.toThrow(/read-only/);
    ws.close();
  });

  it('blocks discover:activate', async () => {
    const ws = await openWs();
    await expect(rpc(ws, 1, 'discover:activate', [1])).rejects.toThrow(/read-only/);
    ws.close();
  });
});
