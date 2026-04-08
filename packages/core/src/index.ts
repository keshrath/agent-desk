// Public surface of @agent-desk/core. Both @agent-desk/desktop and the
// future @agent-desk/server depend on this and nothing else from core.

export { TerminalManager } from './terminal-manager.js';
export type { ManagedTerminal, TerminalClient, HistoryEntry } from './terminal-manager.js';

export { startMonitoring, stopMonitoring, getSystemStats, onStatsUpdate } from './system-monitor.js';
export type { SystemStats } from './system-monitor.js';

export * as paths from './platform/paths.js';

export {
  setAppVersion,
  writeCrashLog,
  hasRecentCrashLogs,
  getLatestCrashLog,
  setupCrashHandlers,
  CRASH_LOG_DIR,
} from './crash-reporter.js';

export {
  detectInstalledTools,
  configureToolMcp,
  autoConfigureMcpServers,
  configureClaudeCodeExtras,
} from './mcp-autoconfig.js';
export type { ConfigResult } from './mcp-autoconfig.js';

export { CONFIG_FILE, readConfig, writeConfig, watchConfig } from './config-store.js';
export type { ConfigData } from './config-store.js';

export { KEYBINDINGS_FILE, readKeybindings, writeKeybindings } from './keybindings-store.js';

export { HistoryStore, HISTORY_FILE } from './history-store.js';

export { SESSION_DIR, SESSION_FILE, BUFFER_DIR, saveSession, loadSession, getSavedBuffer } from './session-store.js';
export type { SessionData, SessionTerminalData, SaveSessionInput } from './session-store.js';

export { fileStat, fileDirname, fileWrite } from './file-ops.js';
export type { FileStat } from './file-ops.js';

export { AgentBridges, knowledge as knowledgeBridge } from './agent-bridges.js';
export type { EmitFn, BridgeStatus, BridgesStatus } from './agent-bridges.js';

export { buildDefaultRequestHandlers, buildDefaultCommandHandlers } from './handlers-default.js';
export type { BuildHandlersDeps } from './handlers-default.js';

export {
  discoverPlugins,
  destroyPlugins,
  getPluginInfoList,
  resolvePluginAsset,
  getPluginConfig,
} from './plugin-system.js';
export type { LoadedPlugin, PluginManifest, PluginInfo } from './plugin-system.js';

export { API_SHAPE, API_TOPLEVEL, buildAgentDeskApi } from './transport/api-shape.js';
export type {
  ApiBinding,
  ApiBindingKind,
  ApiBucket,
  ApiShape,
  ApiTransport,
  AgentDeskApi,
  RequestBinding,
  CommandBinding,
  SubscribeBinding,
  LocalOnlyBinding,
} from './transport/api-shape.js';

export { createRouter } from './transport/router.js';
export type { Router, RequestHandlers, CommandHandlers, CreateRouterOptions } from './transport/router.js';
export type {
  RequestChannel,
  RequestChannelMap,
  RequestArgs,
  RequestResult,
  CommandChannel,
  CommandChannelMap,
  CommandArgs,
  PushChannel,
  PushChannelMap,
  PushArgs,
  CommSnapshot,
  TasksSnapshot,
  DiscoverSnapshot,
  KnowledgeReadResult,
  KnowledgeSessionListItem,
} from './transport/channels.js';
