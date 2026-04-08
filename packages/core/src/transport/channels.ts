// Channel contract — the typed source of truth for every IPC/WS message
// flowing between the renderer and the core router. Both transports
// (Electron IPC in @agent-desk/desktop, WebSocket in @agent-desk/server)
// dispatch through this contract.
//
// Channel buckets:
//   RequestChannels — request/response (Promise<Result>)
//   CommandChannels — fire-and-forget from renderer to core
//   PushChannels    — server→client events
//
// As stores are extracted from src/main/index.ts (subsequent commits),
// the body args/return types here become non-`unknown`. The shape and
// channel names are stable from day one — that's the contract.

import type { TerminalManager, HistoryEntry } from '../terminal-manager.js';
import type { SessionData } from '../session-store.js';
import type { ConfigData } from '../config-store.js';
import type { SystemStats } from '../system-monitor.js';
import type { PluginInfo } from '../plugin-system.js';
import type { ConfigResult } from '../mcp-autoconfig.js';

type TerminalListItem = ReturnType<TerminalManager['list']>[number];
type DetectedTool = { name: string; label: string; path: string; configured: boolean };
type PluginConfig = { baseUrl: string; wsUrl: string } | null;

// ---------------------------------------------------------------------------
// Request / response
// ---------------------------------------------------------------------------

export interface RequestChannelMap {
  // terminal
  'terminal:create': {
    args: [opts: { cwd?: string; command?: string; args?: string[]; cols?: number; rows?: number; env?: Record<string, string> }];
    result: { id: string; cwd: string; command: string; args: string[]; title: string };
  };
  'terminal:write':   { args: [id: string, data: string]; result: boolean };
  'terminal:resize':  { args: [id: string, cols: number, rows: number]; result: boolean };
  'terminal:kill':    { args: [id: string]; result: boolean };
  'terminal:signal':  { args: [id: string, signal: string]; result: boolean };
  'terminal:restart': { args: [id: string]; result: { id: string; cwd: string; command: string; args: string[] } | null };
  'terminal:list':    { args: []; result: TerminalListItem[] };

  // session
  'session:save':         { args: []; result: void };
  'session:load':         { args: []; result: SessionData | null };
  'session:getBuffer':    { args: [id: string]; result: string };
  'session:autoSave':     { args: []; result: void };
  'session:replayBuffer': { args: [id: string]; result: string };
  'session:setAgentInfo': { args: [id: string, agentName: string | null, profileName: string | null]; result: boolean };
  'session:saveLayout':   { args: [layout: unknown]; result: boolean };

  // file
  'file:write':   { args: [filePath: string, content: string]; result: { ok: boolean; error?: string } };
  'file:stat':    { args: [filePath: string]; result: { exists: boolean; size?: number; mtime?: number } };
  'file:dirname': { args: [filePath: string]; result: string };

  // config / keybindings / history
  'config:read':       { args: []; result: ConfigData };
  'config:write':      { args: [data: unknown]; result: boolean };
  'config:getPath':    { args: []; result: string };
  'keybindings:read':  { args: []; result: Record<string, string | null> };
  'keybindings:write': { args: [data: Record<string, string | null>]; result: boolean };
  'history:get':       { args: [limit?: number, search?: string]; result: HistoryEntry[] };
  'history:clear':     { args: []; result: boolean };

  // agent-comm bridge
  'comm:state':         { args: []; result: unknown };
  'comm:agents':        { args: []; result: unknown[] };
  'comm:messages':      { args: [limit?: number]; result: unknown[] };
  'comm:channels':      { args: []; result: unknown[] };
  'comm:state-entries': { args: []; result: unknown[] };
  'comm:feed':          { args: [limit?: number]; result: unknown[] };

  // agent-tasks bridge
  'tasks:state':  { args: []; result: unknown };
  'tasks:list':   { args: [filter?: Record<string, unknown>]; result: unknown[] };
  'tasks:get':    { args: [id: number]; result: unknown };
  'tasks:search': { args: [query: string]; result: unknown[] };

  // agent-knowledge bridge
  'knowledge:entries':  { args: [category?: string]; result: unknown[] };
  'knowledge:read':     { args: [category: string, name: string]; result: unknown };
  'knowledge:search':   { args: [query: string]; result: unknown[] };
  'knowledge:sessions': { args: []; result: unknown[] };
  'knowledge:session':  { args: [sessionId: string, project?: string]; result: unknown };

  // agent-discover bridge
  'discover:state':      { args: []; result: unknown };
  'discover:servers':    { args: []; result: unknown[] };
  'discover:server':     { args: [id: number]; result: unknown };
  'discover:browse':     { args: [query?: string]; result: unknown };
  'discover:activate':   { args: [id: number]; result: unknown };
  'discover:deactivate': { args: [id: number]; result: unknown };
  'discover:delete':     { args: [id: number]; result: boolean };
  'discover:secrets':    { args: [serverId: number]; result: unknown };
  'discover:metrics':    { args: [serverId?: number]; result: unknown };
  'discover:health':     { args: [serverId: number]; result: unknown };

  // system
  'system:stats':            { args: []; result: SystemStats };
  'system:start-monitoring': { args: []; result: void };
  'system:stop-monitoring':  { args: []; result: void };

  // app / crash
  'app:reportError':   { args: [errorData: { message: string; stack?: string; source: string }]; result: void };
  'app:getCrashLogDir': { args: []; result: string };

  // mcp autoconfig
  'mcp:detect-tools':   { args: []; result: DetectedTool[] };
  'mcp:auto-configure': { args: []; result: ConfigResult[] };

  // plugins
  'plugins:list':      { args: []; result: PluginInfo[] };
  'plugins:getConfig': { args: [pluginId: string]; result: PluginConfig };
}

export type RequestChannel = keyof RequestChannelMap;
export type RequestArgs<K extends RequestChannel>   = RequestChannelMap[K]['args'];
export type RequestResult<K extends RequestChannel> = RequestChannelMap[K]['result'];

// ---------------------------------------------------------------------------
// Fire-and-forget commands (renderer → core, no response)
// ---------------------------------------------------------------------------

export interface CommandChannelMap {
  'terminal:subscribe':   [id: string];
  'terminal:unsubscribe': [id: string];
}

export type CommandChannel = keyof CommandChannelMap;
export type CommandArgs<K extends CommandChannel> = CommandChannelMap[K];

// ---------------------------------------------------------------------------
// Server-push events (core → renderer)
// ---------------------------------------------------------------------------

export interface PushChannelMap {
  'terminal:data':  [id: string, data: string];
  'terminal:exit':  [id: string, exitCode: number];

  'comm:update':      [data: unknown];
  'tasks:update':     [data: unknown];
  'knowledge:update': [data: unknown];
  'discover:update':  [data: unknown];

  'config:changed':       [data: unknown];
  'history:new':          [entry: unknown];
  'system:stats-update':  [stats: unknown];
}

export type PushChannel = keyof PushChannelMap;
export type PushArgs<K extends PushChannel> = PushChannelMap[K];
