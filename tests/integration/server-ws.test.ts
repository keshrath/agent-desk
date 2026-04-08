// Integration test for the dual-target architecture: spawn the @agent-desk/server
// process, connect a WebSocket client, exercise five channels end-to-end.
// Proves the same @agent-desk/core stores answer through the WS transport
// that the Electron desktop drives via IPC.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import WebSocket from 'ws';

const SERVER_BIN = join(__dirname, '..', '..', 'packages', 'server', 'dist', 'index.js');
const PORT = 3497;
const TOKEN = 'integration-test-token';

let server: ChildProcess | null = null;

function waitForServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server boot timeout')), 5000);
    server!.stdout!.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes(`http://127.0.0.1:${PORT}`)) {
        clearTimeout(timeout);
        // small grace for the WS upgrade handler to attach
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

describe.skipIf(!existsSync(SERVER_BIN))('@agent-desk/server WS round-trip', () => {
  beforeAll(async () => {
    server = spawn('node', [SERVER_BIN], {
      env: { ...process.env, AGENT_DESK_PORT: String(PORT), AGENT_DESK_TOKEN: TOKEN },
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

  it('rejects WS connection without a valid token', async () => {
    await expect(
      new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?t=wrong`);
        ws.on('open', () => {
          ws.close();
          reject(new Error('expected unauthorized'));
        });
        ws.on('error', () => resolve());
        setTimeout(() => reject(new Error('no auth verdict')), 2000);
      }),
    ).resolves.toBeUndefined();
  });

  it('accepts a valid token and round-trips system:stats', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?t=${TOKEN}`);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    const result = (await rpc(ws, 1, 'system:stats')) as { cpu: number; ram: { percent: number } };
    expect(result).toBeTruthy();
    expect(typeof result.cpu).toBe('number');
    expect(result.ram).toBeDefined();
    ws.close();
  });

  it('round-trips config:read and plugins:list', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?t=${TOKEN}`);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    const config = await rpc(ws, 2, 'config:read');
    expect(config).toBeTruthy();
    expect(typeof config).toBe('object');

    const plugins = await rpc(ws, 3, 'plugins:list');
    expect(Array.isArray(plugins)).toBe(true);
    ws.close();
  });

  it('returns 200 on /healthz without a token', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('returns 401 on protected route without a token', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/index.html`);
    expect(res.status).toBe(401);
  });

  it('exposes bridge status on /healthz', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/healthz`);
    const body = (await res.json()) as { ok: boolean; bridges: { comm: string; tasks: string; discover: string } };
    expect(body.ok).toBe(true);
    expect(body.bridges).toBeDefined();
    expect(['ok', 'failed', 'uninitialized']).toContain(body.bridges.comm);
  });

  it('serves the UI shell with a valid token', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/index.html?t=${TOKEN}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body.length).toBeGreaterThan(0);
  });
});
