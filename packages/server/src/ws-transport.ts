// JSON-RPC over WebSocket. Each client gets its own router instance so
// terminal subscriptions don't leak across browsers. The core terminal
// store is a singleton — terminals are addressable by id across clients.
//
// Per-connection rate limiting (token bucket) and a hard terminal cap
// protect against runaway clients exhausting pty handles.

import type { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  createRouter,
  type Router,
  type RequestHandlers,
  type CommandHandlers,
  type PushChannel,
  type PushChannelMap,
  type TerminalManager,
} from '@agent-desk/core';
import { checkRequestToken } from './auth.js';

const RATE_LIMIT_RPS = parseInt(process.env.AGENT_DESK_RATE_LIMIT_RPS || '50', 10);
const RATE_LIMIT_BURST = parseInt(process.env.AGENT_DESK_RATE_LIMIT_BURST || '100', 10);
const TERMINAL_CAP = parseInt(process.env.AGENT_DESK_TERMINAL_CAP || '64', 10);

interface RpcRequest {
  id?: number;
  ch: string;
  args?: unknown[];
}

interface RpcResponse {
  id: number;
  result?: unknown;
  error?: string;
}

interface RpcPush {
  push: string;
  args: unknown[];
}

export interface WsTransportOptions {
  http: HttpServer;
  buildHandlers: (pushFromCore: (channel: PushChannel, ...args: unknown[]) => void) => {
    request: RequestHandlers;
    command: CommandHandlers;
  };
  terminals: TerminalManager;
}

export function attachWsTransport(opts: WsTransportOptions): {
  emitToAll: <K extends PushChannel>(channel: K, ...args: PushChannelMap[K]) => void;
  close: () => void;
} {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();

  opts.http.on('upgrade', (req: IncomingMessage, socket, head) => {
    if (req.url?.startsWith('/ws') && checkRequestToken(req)) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    const subscribed = new Set<string>();

    // Token bucket for per-connection rate limiting
    let tokens = RATE_LIMIT_BURST;
    let lastRefill = Date.now();
    function takeToken(): boolean {
      const now = Date.now();
      const elapsed = (now - lastRefill) / 1000;
      tokens = Math.min(RATE_LIMIT_BURST, tokens + elapsed * RATE_LIMIT_RPS);
      lastRefill = now;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    }

    const sendPush = (channel: string, ...args: unknown[]) => {
      const msg: RpcPush = { push: channel, args };
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        /* socket may be closed */
      }
    };

    const handlers = opts.buildHandlers((channel, ...args) => sendPush(channel, ...args));

    // Per-connection command handlers — the core 'terminal:subscribe'
    // command needs to wire pty data into THIS websocket, so it can't be
    // shared. We override here.
    const localCommands: CommandHandlers = {
      ...handlers.command,
      'terminal:subscribe': (id) => {
        if (subscribed.has(id)) return;
        subscribed.add(id);
        opts.terminals.subscribe(id, {
          send: (data: string) => sendPush('terminal:data', id, data),
          sendExit: (exitCode: number) => sendPush('terminal:exit', id, exitCode),
        });
      },
    };

    const router: Router = createRouter({
      requestHandlers: handlers.request,
      commandHandlers: localCommands,
    });

    ws.on('message', async (buf) => {
      if (!takeToken()) {
        try {
          ws.send(JSON.stringify({ id: 0, error: 'rate limit exceeded' }));
        } catch {
          /* noop */
        }
        return;
      }
      let msg: RpcRequest;
      try {
        msg = JSON.parse(buf.toString());
      } catch {
        return;
      }
      if (msg.ch === 'terminal:create' && opts.terminals.list().length >= TERMINAL_CAP) {
        if (msg.id != null) {
          ws.send(JSON.stringify({ id: msg.id, error: `terminal cap reached (${TERMINAL_CAP})` }));
        }
        return;
      }
      if (msg.id != null) {
        try {
          const result = await router.dispatchRequest(msg.ch, msg.args ?? []);
          const resp: RpcResponse = { id: msg.id, result };
          ws.send(JSON.stringify(resp));
        } catch (err) {
          const resp: RpcResponse = { id: msg.id, error: String(err) };
          ws.send(JSON.stringify(resp));
        }
      } else {
        try {
          router.dispatchCommand(msg.ch, msg.args ?? []);
        } catch {
          /* fire and forget */
        }
      }
    });

    ws.on('close', () => {
      for (const id of subscribed) {
        opts.terminals.unsubscribeAll(id);
      }
      clients.delete(ws);
    });
  });

  function emitToAll<K extends PushChannel>(channel: K, ...args: PushChannelMap[K]): void {
    const msg: RpcPush = { push: channel, args };
    const json = JSON.stringify(msg);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(json);
        } catch {
          /* skip */
        }
      }
    }
  }

  return {
    emitToAll,
    close: () => {
      wss.close();
      for (const ws of clients) ws.close();
    },
  };
}
