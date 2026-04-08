// Builds the request/command handler maps for createRouter().
// This is the dual-target proof-of-life: the same store modules in
// @agent-desk/core power both the Electron desktop and this WS server.
//
// Web-only fallbacks (dialog, shell.openExternal, window controls,
// notifications, mcp autoconfig hide-on-web) are NOT in this map — the
// renderer's transport-ws layer intercepts them client-side.

import {
  TerminalManager,
  type RequestHandlers,
  type CommandHandlers,
  readConfig,
  writeConfig,
  CONFIG_FILE,
  readKeybindings,
  writeKeybindings,
  HistoryStore,
  saveSession,
  loadSession,
  getSavedBuffer,
  fileStat,
  fileDirname,
  fileWrite,
  getSystemStats,
  startMonitoring,
  stopMonitoring,
  writeCrashLog,
  CRASH_LOG_DIR,
  AgentBridges,
  knowledgeBridge,
  detectInstalledTools,
  autoConfigureMcpServers,
  getPluginInfoList,
  getPluginConfig,
  type LoadedPlugin,
} from '@agent-desk/core';

export interface BuildHandlersDeps {
  terminals: TerminalManager;
  history: HistoryStore;
  bridges: AgentBridges;
  plugins: LoadedPlugin[];
}

export function buildRequestHandlers(deps: BuildHandlersDeps): RequestHandlers {
  const { terminals, history, bridges, plugins } = deps;

  return {
    // terminal
    'terminal:create': (opts) => {
      const t = terminals.spawn(opts.cwd, opts.command, opts.args, opts.cols, opts.rows, opts.env);
      return { id: t.id, cwd: t.cwd, command: t.command, args: t.args, title: t.title };
    },
    'terminal:write': (id, data) => terminals.write(id, data),
    'terminal:resize': (id, cols, rows) => terminals.resize(id, cols, rows),
    'terminal:kill': (id) => terminals.kill(id),
    'terminal:signal': (id, signal) => terminals.signal(id, signal),
    'terminal:restart': (id) => terminals.restart(id),
    'terminal:list': () => terminals.list(),

    // session
    'session:save': () => saveSession(terminals, {}),
    'session:load': () => loadSession(),
    'session:getBuffer': (id) => getSavedBuffer(id) || '',
    'session:autoSave': () => saveSession(terminals, {}),
    'session:replayBuffer': (id) => getSavedBuffer(id) || '',
    'session:setAgentInfo': (id, agentName, profileName) => terminals.setAgentInfo(id, agentName, profileName),
    'session:saveLayout': () => true, // server target ignores layout (no popout windows)

    // file
    'file:write': (filePath, content) => {
      try {
        fileWrite(filePath, content);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
    'file:stat': (filePath) => {
      const s = fileStat(filePath);
      return s ? { exists: true, size: s.size } : { exists: false };
    },
    'file:dirname': (filePath) => fileDirname(filePath),

    // config / keybindings / history
    'config:read': () => readConfig(),
    'config:write': (data) => {
      writeConfig(data as Parameters<typeof writeConfig>[0]);
      return true;
    },
    'config:getPath': () => CONFIG_FILE,
    'keybindings:read': () => readKeybindings(),
    'keybindings:write': (data) => writeKeybindings(data),
    'history:get': (limit, search) => history.get(limit, search),
    'history:clear': () => history.clear(),

    // comm bridge — direct context access
    'comm:state': () => {
      const ctx = bridges.commCtx;
      if (!ctx) return null;
      return {
        agents: ctx.agents.list(),
        channels: ctx.channels.list(),
        messages: ctx.messages.list({ limit: 100 }),
        state: ctx.state.list(),
        feed: ctx.feed.recent(100),
      };
    },
    'comm:agents': () => bridges.commCtx?.agents.list() ?? [],
    'comm:messages': (limit) => bridges.commCtx?.messages.list({ limit: limit ?? 100 }) ?? [],
    'comm:channels': () => bridges.commCtx?.channels.list() ?? [],
    'comm:state-entries': () => bridges.commCtx?.state.list() ?? [],
    'comm:feed': (limit) => bridges.commCtx?.feed.recent(limit ?? 100) ?? [],

    // tasks bridge
    'tasks:state': () => (bridges.tasksCtx ? { tasks: bridges.tasksCtx.tasks.list({}) } : null),
    'tasks:list': (filter) => bridges.tasksCtx?.tasks.list(filter ?? {}) ?? [],
    'tasks:get': (id) => bridges.tasksCtx?.tasks.getById(id) ?? null,
    'tasks:search': (query) => bridges.tasksCtx?.tasks.search(query) ?? [],

    // knowledge bridge
    'knowledge:entries': (category) => {
      try {
        const cfg = knowledgeBridge.getConfig();
        return knowledgeBridge.listEntries(cfg.memoryDir, category);
      } catch {
        return [];
      }
    },
    'knowledge:read': (category, name) => {
      try {
        const cfg = knowledgeBridge.getConfig();
        const entryPath = name ? `${category}/${name}` : category;
        return knowledgeBridge.readEntry(cfg.memoryDir, entryPath);
      } catch {
        return null;
      }
    },
    'knowledge:search': (query) => {
      try {
        const cfg = knowledgeBridge.getConfig();
        return knowledgeBridge.search(cfg.memoryDir, query);
      } catch {
        return [];
      }
    },
    'knowledge:sessions': () => {
      try {
        return knowledgeBridge.listSessions();
      } catch {
        return [];
      }
    },
    'knowledge:session': (sessionId, project) => {
      try {
        return knowledgeBridge.getSessionSummary(sessionId, project);
      } catch {
        return null;
      }
    },

    // discover bridge
    'discover:state': () => (bridges.discoverCtx ? { servers: bridges.discoverCtx.registry.list() } : null),
    'discover:servers': () => bridges.discoverCtx?.registry.list() ?? [],
    'discover:server': (id) => bridges.discoverCtx?.registry.getById(id) ?? null,
    'discover:browse': async (query) => {
      try {
        return (await bridges.discoverCtx?.marketplace.browse(query ?? '')) ?? { servers: [] };
      } catch {
        return { servers: [] };
      }
    },
    'discover:activate': async (id) => {
      const ctx = bridges.discoverCtx;
      if (!ctx) return false;
      try {
        const server = ctx.registry.getById(id);
        if (!server || !server.command) return false;
        await ctx.proxy.activate({ name: server.name, command: server.command, args: server.args, env: server.env });
        ctx.registry.setActive(server.name, true);
        return true;
      } catch {
        return false;
      }
    },
    'discover:deactivate': async (id) => {
      const ctx = bridges.discoverCtx;
      if (!ctx) return false;
      try {
        const server = ctx.registry.getById(id);
        if (!server) return false;
        await ctx.proxy.deactivate(server.name);
        ctx.registry.setActive(server.name, false);
        return true;
      } catch {
        return false;
      }
    },
    'discover:delete': (id) => {
      const ctx = bridges.discoverCtx;
      if (!ctx) return false;
      try {
        const server = ctx.registry.getById(id);
        if (!server) return false;
        ctx.registry.unregister(server.name);
        return true;
      } catch {
        return false;
      }
    },
    'discover:secrets': (serverId) => {
      try {
        return bridges.discoverCtx?.secrets.list(serverId) ?? [];
      } catch {
        return [];
      }
    },
    'discover:metrics': (serverId) => {
      try {
        if (!bridges.discoverCtx) return [];
        if (serverId) return bridges.discoverCtx.metrics.getServerMetrics(serverId);
        return bridges.discoverCtx.metrics.getOverview();
      } catch {
        return [];
      }
    },
    'discover:health': (serverId) => {
      try {
        return bridges.discoverCtx?.health.getHealth(serverId) ?? null;
      } catch {
        return null;
      }
    },

    // system
    'system:stats': () => getSystemStats(),
    'system:start-monitoring': () => {
      startMonitoring();
    },
    'system:stop-monitoring': () => {
      stopMonitoring();
    },

    // app / crash
    'app:reportError': (errorData) => {
      const error = new Error(errorData.message);
      if (errorData.stack) error.stack = errorData.stack;
      writeCrashLog(error, 'renderer');
    },
    'app:getCrashLogDir': () => CRASH_LOG_DIR,

    // mcp — server target returns empty (web hides the autoconfig UI)
    'mcp:detect-tools': () => detectInstalledTools(),
    'mcp:auto-configure': () => autoConfigureMcpServers(),

    // plugins
    'plugins:list': () => getPluginInfoList(plugins),
    'plugins:getConfig': (pluginId) => getPluginConfig(plugins, pluginId),
  };
}

export function buildCommandHandlers(deps: BuildHandlersDeps): CommandHandlers {
  const { terminals } = deps;
  return {
    'terminal:subscribe': (id) => {
      // The WS layer wires this — pass-through stub. The actual subscription
      // happens in ws-transport.ts where it has access to the live socket.
      void id;
    },
    'terminal:unsubscribe': (id) => {
      terminals.unsubscribeAll(id);
    },
  };
}
