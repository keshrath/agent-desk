// @agent-desk/ui web entry — wires the vanilla-JS renderer against a
// WebSocket transport when running outside Electron.
//
// The renderer was originally built for Electron's preload bridge
// (window.agentDesk). For the web target, we install a shim with the same
// shape that proxies every call over WS to @agent-desk/server.
//
// The PWA imports this module via `@agent-desk/ui/web`. The PWA flips
// `window.__AGENT_DESK_READ_ONLY__ = true` BEFORE importing so the renderer
// can hide mutating controls.

const PROTOCOL = location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${PROTOCOL}//${location.host}/ws${location.search}`;

let ws = null;
let nextRpcId = 1;
const pending = new Map();
const pushListeners = new Map();
let connectPromise = null;

function connect() {
  if (connectPromise) return connectPromise;
  connectPromise = new Promise((resolve, reject) => {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => resolve();
    ws.onerror = (err) => reject(err);
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve: r, reject: rj } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rj(new Error(msg.error));
        else r(msg.result);
        return;
      }
      if (msg.push) {
        const listeners = pushListeners.get(msg.push);
        if (listeners) for (const fn of listeners) fn(...(msg.args || []));
      }
    };
    ws.onclose = () => {
      connectPromise = null;
      ws = null;
      // Reject any in-flight requests
      for (const { reject: rj } of pending.values()) rj(new Error('ws closed'));
      pending.clear();
    };
  });
  return connectPromise;
}

async function rpc(channel, args) {
  await connect();
  const id = nextRpcId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, ch: channel, args }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`rpc ${channel} timeout`));
      }
    }, 30_000);
  });
}

async function fire(channel, args) {
  await connect();
  ws.send(JSON.stringify({ ch: channel, args }));
}

function on(channel, listener) {
  let arr = pushListeners.get(channel);
  if (!arr) {
    arr = [];
    pushListeners.set(channel, arr);
  }
  arr.push(listener);
  return () => {
    const idx = arr.indexOf(listener);
    if (idx >= 0) arr.splice(idx, 1);
  };
}

// window.agentDesk shim — same shape as the Electron preload bridge.
// Channel names match @agent-desk/core's RequestChannelMap exactly.
const READ_ONLY = !!window.__AGENT_DESK_READ_ONLY__;

function blockedInReadOnly() {
  console.warn('[agent-desk/ui] write blocked: PWA is read-only');
  return Promise.resolve(null);
}

window.agentDesk = {
  __readOnly: READ_ONLY,

  terminal: {
    create: (opts) => (READ_ONLY ? blockedInReadOnly() : rpc('terminal:create', [opts || {}])),
    write: (id, data) => (READ_ONLY ? blockedInReadOnly() : rpc('terminal:write', [id, data])),
    resize: (id, cols, rows) => rpc('terminal:resize', [id, cols, rows]),
    kill: (id) => (READ_ONLY ? blockedInReadOnly() : rpc('terminal:kill', [id])),
    signal: (id, signal) => (READ_ONLY ? blockedInReadOnly() : rpc('terminal:signal', [id, signal])),
    restart: (id) => (READ_ONLY ? blockedInReadOnly() : rpc('terminal:restart', [id])),
    list: () => rpc('terminal:list', []),
    popout: () => Promise.resolve(null), // desktop-only
    subscribe: (id) => fire('terminal:subscribe', [id]),
    unsubscribe: (id) => fire('terminal:unsubscribe', [id]),
    onData: (cb) => on('terminal:data', cb),
    onExit: (cb) => on('terminal:exit', cb),
  },

  session: {
    save: () => (READ_ONLY ? blockedInReadOnly() : rpc('session:save', [])),
    load: () => rpc('session:load', []),
    getBuffer: (id) => rpc('session:getBuffer', [id]),
    autoSave: () => (READ_ONLY ? blockedInReadOnly() : rpc('session:autoSave', [])),
    replayBuffer: (id) => rpc('session:replayBuffer', [id]),
    setAgentInfo: (id, name, profile) =>
      READ_ONLY ? blockedInReadOnly() : rpc('session:setAgentInfo', [id, name, profile]),
    saveLayout: (layout) => (READ_ONLY ? blockedInReadOnly() : rpc('session:saveLayout', [layout])),
  },

  // Window controls — desktop-only, web stubs.
  window: {
    minimize: () => {},
    maximize: () => {},
    close: () => {},
    flashFrame: () => {},
  },

  // Notifications — use the browser's Notification API instead of an IPC call.
  notify: (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body });
      } catch {
        /* noop */
      }
    }
  },

  onAction: () => () => {},
  onOpenCwd: () => () => {},

  dialog: {
    saveFile: () => Promise.resolve(null), // web: handled via <a download>
    openDirectory: () => Promise.resolve(null),
  },

  file: {
    write: (path, content) => (READ_ONLY ? blockedInReadOnly() : rpc('file:write', [path, content])),
    stat: (path) => rpc('file:stat', [path]),
    dirname: (path) => rpc('file:dirname', [path]),
  },

  config: {
    read: () => rpc('config:read', []),
    write: (data) => (READ_ONLY ? blockedInReadOnly() : rpc('config:write', [data])),
    getPath: () => rpc('config:getPath', []),
    onChange: (cb) => on('config:changed', cb),
  },

  setLoginItem: () => {}, // desktop-only

  keybindings: {
    read: () => rpc('keybindings:read', []),
    write: (data) => (READ_ONLY ? blockedInReadOnly() : rpc('keybindings:write', [data])),
  },

  history: {
    get: (limit, search) => rpc('history:get', [limit, search]),
    clear: () => (READ_ONLY ? blockedInReadOnly() : rpc('history:clear', [])),
    onNew: (cb) => on('history:new', cb),
  },

  system: {
    getStats: () => rpc('system:stats', []),
    startMonitoring: () => rpc('system:start-monitoring', []),
    stopMonitoring: () => rpc('system:stop-monitoring', []),
    onStatsUpdate: (cb) => on('system:stats-update', cb),
  },

  app: {
    checkForUpdates: () => Promise.resolve(null), // desktop-only
    installUpdate: () => Promise.resolve(null),
    onUpdateStatus: () => () => {},
    onCrashDetected: () => () => {},
    reportError: (err) => rpc('app:reportError', [err]),
    getCrashLogDir: () => rpc('app:getCrashLogDir', []),
  },

  comm: {
    getState: () => rpc('comm:state', []),
    agents: () => rpc('comm:agents', []),
    messages: (limit) => rpc('comm:messages', [limit]),
    channels: () => rpc('comm:channels', []),
    stateEntries: () => rpc('comm:state-entries', []),
    feed: (limit) => rpc('comm:feed', [limit]),
    onUpdate: (cb) => on('comm:update', cb),
  },

  tasks: {
    getState: () => rpc('tasks:state', []),
    list: (filter) => rpc('tasks:list', [filter]),
    get: (id) => rpc('tasks:get', [id]),
    search: (query) => rpc('tasks:search', [query]),
    onUpdate: (cb) => on('tasks:update', cb),
  },

  knowledge: {
    entries: (category) => rpc('knowledge:entries', [category]),
    read: (category, name) => rpc('knowledge:read', [category, name]),
    search: (query) => rpc('knowledge:search', [query]),
    sessions: () => rpc('knowledge:sessions', []),
    session: (sessionId, project) => rpc('knowledge:session', [sessionId, project]),
    onUpdate: (cb) => on('knowledge:update', cb),
  },

  discover: {
    getState: () => rpc('discover:state', []),
    servers: () => rpc('discover:servers', []),
    server: (id) => rpc('discover:server', [id]),
    browse: (query) => rpc('discover:browse', [query]),
    activate: (id) => (READ_ONLY ? blockedInReadOnly() : rpc('discover:activate', [id])),
    deactivate: (id) => (READ_ONLY ? blockedInReadOnly() : rpc('discover:deactivate', [id])),
    delete: (id) => (READ_ONLY ? blockedInReadOnly() : rpc('discover:delete', [id])),
    secrets: (serverId) => rpc('discover:secrets', [serverId]),
    metrics: (serverId) => rpc('discover:metrics', [serverId]),
    health: (serverId) => rpc('discover:health', [serverId]),
    onUpdate: (cb) => on('discover:update', cb),
  },

  mcp: {
    detectTools: () => rpc('mcp:detect-tools', []),
    autoConfigure: () => (READ_ONLY ? blockedInReadOnly() : rpc('mcp:auto-configure', [])),
  },

  plugins: {
    list: () => rpc('plugins:list', []),
    getConfig: (id) => rpc('plugins:getConfig', [id]),
  },

  openExternal: (url) => {
    try {
      window.open(url, '_blank', 'noopener');
    } catch {
      /* noop */
    }
  },
  openPath: () => {}, // desktop-only

  // Web-target metadata so the renderer can detect the transport.
  __target: 'web',
  __ws: () => ws,
};

// Eagerly connect; the renderer assumes window.agentDesk is wired before
// any await. The connect() promise is awaited the first time it's needed.
void connect().catch((err) => {
  console.error('[agent-desk/ui] WS connect failed', err);
});

// Re-export for ESM consumers (the PWA imports this file via dynamic import).
export { rpc, fire, on };
