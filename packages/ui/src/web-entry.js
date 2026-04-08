// @agent-desk/ui web entry — installs `window.agentDesk` for browser/PWA
// targets, backed by a WebSocket transport against @agent-desk/server.
//
// The bucket structure comes from API_SHAPE in @agent-desk/core so this file
// stays one transport declaration; adding a new channel means: tick the
// contract + handler + api-shape, done. No edits here.
//
// PWA mode: window.__AGENT_DESK_READ_ONLY__ = true blocks every method whose
// binding has a request-channel that's in the read-only blocklist (matches
// the server-side READONLY_BLOCKED_CHANNELS but enforced client-side too as
// defense-in-depth + better UX — failures don't even hit the network).

/// <reference lib="dom" />
import { buildAgentDeskApi } from '@agent-desk/core';
/** @typedef {import('@agent-desk/core').ApiTransport} ApiTransport */
/** @typedef {import('@agent-desk/core').LocalOnlyBinding} LocalOnlyBinding */

const PROTOCOL = location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${PROTOCOL}//${location.host}/ws${location.search}`;

const READ_ONLY = !!(/** @type {any} */ (window).__AGENT_DESK_READ_ONLY__);

const READONLY_BLOCKED = new Set([
  'terminal:create',
  'terminal:write',
  'terminal:kill',
  'terminal:signal',
  'terminal:restart',
  'session:save',
  'session:autoSave',
  'session:setAgentInfo',
  'session:saveLayout',
  'file:write',
  'config:write',
  'keybindings:write',
  'history:clear',
  'discover:activate',
  'discover:deactivate',
  'discover:delete',
  'mcp:auto-configure',
]);

/** @type {WebSocket | null} */
let ws = null;
let nextRpcId = 1;
/** @type {Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>} */
const pending = new Map();
/** @type {Map<string, Array<(...args: unknown[]) => void>>} */
const pushListeners = new Map();
/** @type {Promise<void> | null} */
let connectPromise = null;

function connect() {
  if (connectPromise) return connectPromise;
  connectPromise = new Promise((resolve, reject) => {
    const sock = new WebSocket(WS_URL);
    ws = sock;
    sock.onopen = () => resolve();
    sock.onerror = (err) => reject(/** @type {Error} */ (/** @type {unknown} */ (err)));
    sock.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(/** @type {string} */ (ev.data));
      } catch {
        return;
      }
      if (msg.id != null && pending.has(msg.id)) {
        const entry = pending.get(msg.id);
        pending.delete(msg.id);
        if (!entry) return;
        if (msg.error) entry.reject(new Error(msg.error));
        else entry.resolve(msg.result);
        return;
      }
      if (msg.push) {
        const listeners = pushListeners.get(msg.push);
        if (listeners) for (const fn of listeners) fn(...(msg.args || []));
      }
    };
    sock.onclose = () => {
      connectPromise = null;
      ws = null;
      for (const { reject: rj } of pending.values()) rj(new Error('ws closed'));
      pending.clear();
    };
  });
  return connectPromise;
}

/**
 * @param {string} channel
 * @param {unknown[]} args
 * @returns {Promise<unknown>}
 */
async function rpc(channel, args) {
  if (READ_ONLY && READONLY_BLOCKED.has(channel)) {
    console.warn('[agent-desk/ui] read-only: blocked', channel);
    return null;
  }
  await connect();
  if (!ws) throw new Error('ws not connected');
  const id = nextRpcId++;
  const sock = ws;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    sock.send(JSON.stringify({ id, ch: channel, args }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`rpc ${channel} timeout`));
      }
    }, 30_000);
  });
}

/**
 * @param {string} channel
 * @param {unknown[]} args
 */
async function fire(channel, args) {
  if (READ_ONLY && READONLY_BLOCKED.has(channel)) return;
  await connect();
  if (!ws) return;
  ws.send(JSON.stringify({ ch: channel, args }));
}

/**
 * @param {string} channel
 * @param {(...args: unknown[]) => void} listener
 * @returns {() => void}
 */
function subscribePush(channel, listener) {
  let arr = pushListeners.get(channel);
  if (!arr) {
    arr = [];
    pushListeners.set(channel, arr);
  }
  arr.push(listener);
  return () => {
    if (!arr) return;
    const idx = arr.indexOf(listener);
    if (idx >= 0) arr.splice(idx, 1);
  };
}

/**
 * @param {LocalOnlyBinding['tag']} tag
 * @param {unknown[]} args
 * @returns {unknown}
 */
function webLocalOnly(tag, args) {
  switch (tag) {
    // window controls — desktop-only, web no-op
    case 'window.minimize':
    case 'window.maximize':
    case 'window.close':
    case 'window.flashFrame':
    case 'app.setLoginItem':
    case 'shell.openPath':
      return;
    case 'shell.openExternal': {
      const url = /** @type {string} */ (args[0]);
      try {
        window.open(url, '_blank', 'noopener');
      } catch {
        /* noop */
      }
      return;
    }
    case 'app.notify': {
      const [title, body] = /** @type {[string, string]} */ (args);
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, { body });
        } catch {
          /* noop */
        }
      }
      return;
    }
    case 'dialog.openDirectory':
    case 'dialog.saveFile':
      return Promise.resolve(null);
    case 'app.checkForUpdates':
    case 'app.installUpdate':
      return Promise.resolve(null);
    case 'terminal.popout':
      return Promise.resolve(null);
    case 'app.onUpdateStatus':
    case 'app.onCrashDetected':
    case 'app.onAction':
    case 'app.onOpenCwd':
      // No source for these in the web target — return a no-op unsubscribe.
      return () => {};
  }
}

/** @type {ApiTransport} */
const transport = {
  request(channel, args) {
    return rpc(channel, args);
  },
  command(channel, args) {
    void fire(channel, args);
  },
  subscribe(channel, callback) {
    return subscribePush(channel, callback);
  },
  localOnly(tag, args) {
    return webLocalOnly(tag, args);
  },
};

const agentDesk = buildAgentDeskApi(transport);
agentDesk.__readOnly = READ_ONLY;
agentDesk.__target = 'web';
agentDesk.__ws = () => ws;

/** @type {any} */ (window).agentDesk = agentDesk;

void connect().catch((/** @type {unknown} */ err) => {
  console.error('[agent-desk/ui] WS connect failed', err);
});

export { rpc, fire, subscribePush as on };
