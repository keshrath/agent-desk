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

import type { Agent, Channel, Message, StateEntry, FeedEvent } from 'agent-comm/dist/types.js';
import type { Task, SearchResult as TaskSearchResult } from 'agent-tasks/dist/types.js';
import type { ServerEntry, MarketplaceResult } from 'agent-discover/dist/types.js';
import type { KnowledgeEntry, KnowledgeSearchResult, SessionMeta } from 'agent-knowledge/dist/lib.js';

export interface KnowledgeReadResult {
  entry: KnowledgeEntry;
  content: string;
}

export type KnowledgeSessionListItem = { project: string; sessionId: string } & SessionMeta;

type TerminalListItem = ReturnType<TerminalManager['list']>[number];
type DetectedTool = { name: string; label: string; path: string; configured: boolean };
type PluginConfig = { baseUrl: string; wsUrl: string } | null;

export interface CommSnapshot {
  agents: Agent[];
  channels: Channel[];
  messages: Message[];
  state: StateEntry[];
  feed: FeedEvent[];
}

export interface TasksSnapshot {
  tasks: Task[];
}

export interface DiscoverSnapshot {
  servers: ServerEntry[];
}

// ---------------------------------------------------------------------------
// Workspace (project-centric records with root, env, color, agent selection)
// ---------------------------------------------------------------------------

export interface SavedTerminal {
  panelId: string;
  command: string;
  args: string[];
  cwd: string;
  title: string;
  profile: string;
  icon: string;
}

export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  color: string;
  env: Record<string, string>;
  agents: string[];
  pinned: boolean;
  lastOpened: number;
  terminals: SavedTerminal[];
  layout: unknown;
}

// ---------------------------------------------------------------------------
// Git (read-only sidebar model — no staging/commit/push in v1)
// ---------------------------------------------------------------------------

export type GitFileStatusCode = 'M' | 'A' | 'D' | '?' | 'R' | 'U';

export interface GitFileStatus {
  path: string;
  status: GitFileStatusCode;
  staged: boolean;
}

export interface GitCommit {
  sha: string;
  subject: string;
  author: string;
  date: number;
}

export interface GitStatus {
  root: string;
  branch: string | null;
  detached: boolean;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  lastCommit: GitCommit | null;
}

/**
 * A discovered git repository inside a workspace folder. A workspace is just
 * a directory; zero or more git repos may live inside it at arbitrary depth
 * via submodules. A `GitRepoNode` represents one such repo with its own
 * status, and carries its submodules as `children` for UI tree rendering.
 *
 * - `root`         absolute path to the repo's working tree
 * - `relativePath` path relative to the workspace root (empty string when
 *                  the workspace root IS the repo root)
 * - `name`         display name — last path segment
 * - `depth`        0 for top-level, 1 for direct submodule, etc.
 * - `parentRoot`   the containing repo's absolute path, or null for top-level
 * - `isSubmodule`  true if this node was found via the parent's .gitmodules
 * - `status`       the repo's own git status (branch, files, ahead/behind)
 * - `children`     nested submodule nodes (may be empty)
 * - `error`        non-null when status discovery failed — UI shows a warning
 */
export interface GitRepoNode {
  root: string;
  relativePath: string;
  name: string;
  depth: number;
  parentRoot: string | null;
  isSubmodule: boolean;
  status: GitStatus | null;
  children: GitRepoNode[];
  error?: string;
}

/**
 * The result of scanning a workspace folder for git repositories. Top-level
 * repos are in `repos`: if the workspace root itself is a repo there will be
 * exactly one entry whose `children` holds its submodule tree; if the
 * workspace root is not a repo, `repos` contains every first-level child
 * directory that is a repo (sibling-project model).
 */
export interface GitRepoTree {
  workspaceRoot: string;
  repos: GitRepoNode[];
  scannedAt: number;
}

// ---------------------------------------------------------------------------
// Diff viewer (pre-highlighted hunks produced in core via Shiki)
// ---------------------------------------------------------------------------

export type DiffLineKind = 'ctx' | 'add' | 'del';

export interface DiffHunkLine {
  kind: DiffLineKind;
  oldLine: number | null;
  newLine: number | null;
  html: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffHunkLine[];
}

export interface RenderedDiff {
  language: string;
  hunks: DiffHunk[];
  truncated: boolean;
  binary: boolean;
}

// ---------------------------------------------------------------------------
// External editor handoff
// ---------------------------------------------------------------------------

export interface DetectedEditor {
  id: string;
  name: string;
  command: string;
  path: string;
  hasUrlScheme: boolean;
}

export interface EditorOpenResult {
  ok: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Request / response
// ---------------------------------------------------------------------------

export interface RequestChannelMap {
  // terminal
  'terminal:create': {
    args: [
      opts: {
        cwd?: string;
        command?: string;
        args?: string[];
        cols?: number;
        rows?: number;
        env?: Record<string, string>;
      },
    ];
    result: { id: string; cwd: string; command: string; args: string[]; title: string };
  };
  'terminal:write': { args: [id: string, data: string]; result: boolean };
  'terminal:resize': { args: [id: string, cols: number, rows: number]; result: boolean };
  'terminal:kill': { args: [id: string]; result: boolean };
  'terminal:signal': { args: [id: string, signal: string]; result: boolean };
  'terminal:restart': {
    args: [id: string];
    result: { id: string; cwd: string; command: string; args: string[] } | null;
  };
  'terminal:list': { args: []; result: TerminalListItem[] };

  // session
  'session:save': { args: []; result: void };
  'session:load': { args: []; result: SessionData | null };
  'session:getBuffer': { args: [id: string]; result: string };
  'session:autoSave': { args: []; result: void };
  'session:replayBuffer': { args: [id: string]; result: string };
  'session:setAgentInfo': { args: [id: string, agentName: string | null, profileName: string | null]; result: boolean };
  'session:saveLayout': { args: [layout: unknown]; result: boolean };

  // file
  'file:write': { args: [filePath: string, content: string]; result: { ok: boolean; error?: string } };
  'file:stat': { args: [filePath: string]; result: { exists: boolean; size?: number; mtime?: number } };
  'file:dirname': { args: [filePath: string]; result: string };

  // config / keybindings / history
  'config:read': { args: []; result: ConfigData };
  'config:write': { args: [data: unknown]; result: boolean };
  'config:getPath': { args: []; result: string };
  'keybindings:read': { args: []; result: Record<string, string | null> };
  'keybindings:write': { args: [data: Record<string, string | null>]; result: boolean };
  'history:get': { args: [limit?: number, search?: string]; result: HistoryEntry[] };
  'history:clear': { args: []; result: boolean };

  // agent-comm bridge
  'comm:state': { args: []; result: CommSnapshot | null };
  'comm:agents': { args: []; result: Agent[] };
  'comm:messages': { args: [limit?: number]; result: Message[] };
  'comm:channels': { args: []; result: Channel[] };
  'comm:state-entries': { args: []; result: StateEntry[] };
  'comm:feed': { args: [limit?: number]; result: FeedEvent[] };

  // agent-tasks bridge
  'tasks:state': { args: []; result: TasksSnapshot | null };
  'tasks:list': { args: [filter?: Record<string, unknown>]; result: Task[] };
  'tasks:get': { args: [id: number]; result: Task | null };
  'tasks:search': { args: [query: string]; result: TaskSearchResult[] };

  // agent-knowledge bridge
  'knowledge:entries': { args: [category?: string]; result: KnowledgeEntry[] };
  'knowledge:read': { args: [category: string, name: string]; result: KnowledgeReadResult | null };
  'knowledge:search': { args: [query: string]; result: KnowledgeSearchResult[] };
  'knowledge:sessions': { args: []; result: KnowledgeSessionListItem[] };
  'knowledge:session': { args: [sessionId: string, project?: string]; result: unknown };

  // agent-discover bridge
  'discover:state': { args: []; result: DiscoverSnapshot | null };
  'discover:servers': { args: []; result: ServerEntry[] };
  'discover:server': { args: [id: number]; result: ServerEntry | null };
  'discover:browse': { args: [query?: string]; result: MarketplaceResult };
  'discover:activate': { args: [id: number]; result: boolean };
  'discover:deactivate': { args: [id: number]; result: boolean };
  'discover:delete': { args: [id: number]; result: boolean };
  'discover:secrets': { args: [serverId: number]; result: unknown };
  'discover:metrics': { args: [serverId?: number]; result: unknown };
  'discover:health': { args: [serverId: number]; result: unknown };

  // system
  'system:stats': { args: []; result: SystemStats };
  'system:start-monitoring': { args: []; result: void };
  'system:stop-monitoring': { args: []; result: void };

  // app / crash
  'app:reportError': { args: [errorData: { message: string; stack?: string; source: string }]; result: void };
  'app:getCrashLogDir': { args: []; result: string };

  // mcp autoconfig
  'mcp:detect-tools': { args: []; result: DetectedTool[] };
  'mcp:auto-configure': { args: []; result: ConfigResult[] };

  // plugins
  'plugins:list': { args: []; result: PluginInfo[] };
  'plugins:getConfig': { args: [pluginId: string]; result: PluginConfig };

  // workspace
  'workspace:list': { args: []; result: Workspace[] };
  'workspace:get': { args: [id: string]; result: Workspace | null };
  'workspace:save': { args: [ws: Workspace]; result: boolean };
  'workspace:delete': { args: [id: string]; result: boolean };
  'workspace:open': { args: [id: string]; result: { openedTerminals: string[] } };
  'workspace:recent': { args: [limit?: number]; result: Workspace[] };

  // git
  'git:status': { args: [root: string]; result: GitStatus | null };
  'git:diff': { args: [root: string, file: string, staged?: boolean]; result: string };
  'git:file': { args: [root: string, file: string, ref?: string]; result: string };
  'git:discover': { args: [workspaceRoot: string]; result: GitRepoTree };

  // diff
  'diff:render': {
    args: [oldContent: string, newContent: string, language?: string];
    result: RenderedDiff;
  };

  // editor
  'editor:detect': { args: []; result: DetectedEditor[] };
  'editor:open': {
    args: [editorId: string, filePath: string, line?: number, col?: number];
    result: EditorOpenResult;
  };
}

export type RequestChannel = keyof RequestChannelMap;
export type RequestArgs<K extends RequestChannel> = RequestChannelMap[K]['args'];
export type RequestResult<K extends RequestChannel> = RequestChannelMap[K]['result'];

// ---------------------------------------------------------------------------
// Fire-and-forget commands (renderer → core, no response)
// ---------------------------------------------------------------------------

export interface CommandChannelMap {
  'terminal:subscribe': [id: string];
  'terminal:unsubscribe': [id: string];
}

export type CommandChannel = keyof CommandChannelMap;
export type CommandArgs<K extends CommandChannel> = CommandChannelMap[K];

// ---------------------------------------------------------------------------
// Server-push events (core → renderer)
// ---------------------------------------------------------------------------

export interface PushChannelMap {
  'terminal:data': [id: string, data: string];
  'terminal:exit': [id: string, exitCode: number];

  'comm:update': [data: unknown];
  'tasks:update': [data: unknown];
  'knowledge:update': [data: unknown];
  'discover:update': [data: unknown];

  'config:changed': [data: unknown];
  'history:new': [entry: unknown];
  'system:stats-update': [stats: unknown];

  'git:update': [root: string];
}

export type PushChannel = keyof PushChannelMap;
export type PushArgs<K extends PushChannel> = PushChannelMap[K];
