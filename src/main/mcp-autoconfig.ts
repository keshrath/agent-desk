// mcp-autoconfig.ts — Auto-configure MCP servers for detected AI coding tools
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ---------------------------------------------------------------------------
// MCP server definitions
// ---------------------------------------------------------------------------

interface McpServerDef {
  description: string;
  npmPackage: string;
}

const MCP_SERVERS: Record<string, McpServerDef> = {
  'agent-comm': {
    description: 'Agent communication - messaging, channels, shared state',
    npmPackage: 'agent-comm',
  },
  'agent-tasks': {
    description: 'Pipeline task management for AI agents',
    npmPackage: 'agent-tasks',
  },
  'agent-knowledge': {
    description: 'Cross-session memory and recall for AI agents',
    npmPackage: 'agent-knowledge',
  },
  'agent-discover': {
    description: 'MCP server registry and marketplace',
    npmPackage: 'agent-discover',
  },
};

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

interface ToolDef {
  name: string;
  label: string;
  configPath: string;
  rootKey: string;
  detect: () => boolean;
  /** Extra keys to add per-server entry (e.g. type: "stdio" for Claude Code) */
  extraKeys?: Record<string, string>;
}

function home(...segments: string[]): string {
  return join(homedir(), ...segments);
}

const TOOLS: ToolDef[] = [
  {
    name: 'claude-code',
    label: 'Claude Code',
    configPath: home('.claude.json'),
    rootKey: 'mcpServers',
    detect: () => existsSync(home('.claude.json')),
    extraKeys: { type: 'stdio' },
  },
  {
    name: 'cursor',
    label: 'Cursor',
    configPath: home('.cursor', 'mcp.json'),
    rootKey: 'mcpServers',
    detect: () => existsSync(home('.cursor')),
  },
  {
    name: 'windsurf',
    label: 'Windsurf',
    configPath: home('.codeium', 'windsurf', 'mcp_config.json'),
    rootKey: 'mcpServers',
    detect: () => existsSync(home('.codeium', 'windsurf')),
  },
  {
    name: 'gemini-cli',
    label: 'Gemini CLI',
    configPath: home('.gemini', 'settings.json'),
    rootKey: 'mcpServers',
    detect: () => existsSync(home('.gemini')),
  },
  {
    name: 'opencode',
    label: 'OpenCode',
    configPath:
      process.platform === 'win32'
        ? join(process.env.LOCALAPPDATA ?? home('AppData', 'Local'), 'opencode', 'opencode.json')
        : home('.config', 'opencode', 'opencode.json'),
    rootKey: 'mcp',
    detect: () => {
      if (process.platform === 'win32') {
        const dir = join(process.env.LOCALAPPDATA ?? home('AppData', 'Local'), 'opencode');
        return existsSync(dir);
      }
      return existsSync(home('.config', 'opencode'));
    },
    extraKeys: { __opencode: 'true' },
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfigResult {
  tool: string;
  label: string;
  path: string;
  status: 'configured' | 'skipped' | 'error';
  message?: string;
  serversAdded?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonFile(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function backupFile(path: string): void {
  if (existsSync(path)) {
    copyFileSync(path, path + '.bak');
  }
}

function buildServerEntry(tool: ToolDef, serverName: string): Record<string, unknown> {
  const def = MCP_SERVERS[serverName];

  // OpenCode uses a different format: array command, environment, type, enabled
  if (tool.extraKeys?.__opencode) {
    return {
      type: 'local',
      command: ['npx', '-y', def.npmPackage],
      environment: {},
      enabled: true,
    };
  }

  const entry: Record<string, unknown> = {
    command: 'npx',
    args: ['-y', def.npmPackage],
  };
  if (tool.extraKeys) {
    for (const [k, v] of Object.entries(tool.extraKeys)) {
      entry[k] = v;
    }
  }
  return entry;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Detect which AI coding tools are installed */
export function detectInstalledTools(): Array<{ name: string; label: string; path: string; configured: boolean }> {
  const results: Array<{ name: string; label: string; path: string; configured: boolean }> = [];
  for (const tool of TOOLS) {
    if (tool.detect()) {
      results.push({
        name: tool.name,
        label: tool.label,
        path: tool.configPath,
        configured: isAlreadyConfigured(tool),
      });
    }
  }
  return results;
}

/** Check if all MCP servers are already configured for a tool */
function isAlreadyConfigured(tool: ToolDef): boolean {
  const data = readJsonFile(tool.configPath);
  if (!data) return false;
  const servers = data[tool.rootKey] as Record<string, unknown> | undefined;
  if (!servers || typeof servers !== 'object') return false;
  return Object.keys(MCP_SERVERS).every((name) => name in servers);
}

/** Configure MCP servers for a specific tool */
export function configureToolMcp(toolName: string): ConfigResult {
  const tool = TOOLS.find((t) => t.name === toolName);
  if (!tool) {
    return { tool: toolName, label: toolName, path: '', status: 'error', message: 'Unknown tool' };
  }
  if (!tool.detect()) {
    return {
      tool: tool.name,
      label: tool.label,
      path: tool.configPath,
      status: 'skipped',
      message: 'Tool not installed',
    };
  }

  try {
    // Read existing config or start fresh
    let data = readJsonFile(tool.configPath);

    // If the file exists but couldn't be parsed, skip it
    if (existsSync(tool.configPath) && data === null) {
      return {
        tool: tool.name,
        label: tool.label,
        path: tool.configPath,
        status: 'error',
        message: 'Could not parse existing config file (invalid JSON)',
      };
    }

    if (!data) data = {};

    // Ensure root key exists
    if (!data[tool.rootKey] || typeof data[tool.rootKey] !== 'object') {
      data[tool.rootKey] = {};
    }
    const servers = data[tool.rootKey] as Record<string, unknown>;

    const added: string[] = [];
    for (const serverName of Object.keys(MCP_SERVERS)) {
      if (!(serverName in servers)) {
        servers[serverName] = buildServerEntry(tool, serverName);
        added.push(serverName);
      }
    }

    if (added.length === 0) {
      return {
        tool: tool.name,
        label: tool.label,
        path: tool.configPath,
        status: 'skipped',
        message: 'All MCP servers already configured',
        serversAdded: [],
      };
    }

    // Backup before writing
    backupFile(tool.configPath);

    // Write updated config
    writeFileSync(tool.configPath, JSON.stringify(data, null, 2), 'utf-8');

    return {
      tool: tool.name,
      label: tool.label,
      path: tool.configPath,
      status: 'configured',
      message: `Added ${added.length} server(s): ${added.join(', ')}`,
      serversAdded: added,
    };
  } catch (err) {
    return {
      tool: tool.name,
      label: tool.label,
      path: tool.configPath,
      status: 'error',
      message: `${err}`,
    };
  }
}

/** Auto-configure all detected tools */
export function autoConfigureMcpServers(): ConfigResult[] {
  const results: ConfigResult[] = [];
  for (const tool of TOOLS) {
    if (tool.detect()) {
      const result = configureToolMcp(tool.name);
      results.push(result);
      // For Claude Code, also configure hooks and permissions
      if (tool.name === 'claude-code') {
        const extrasResult = configureClaudeCodeExtras();
        results.push(extrasResult);
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Claude Code extras: hooks + permissions in settings.json
// ---------------------------------------------------------------------------

interface HookEntry {
  type: string;
  command: string;
  timeout: number;
}

interface HookGroup {
  hooks: HookEntry[];
}

/** Hook script definitions — each maps to a generated script in ~/.claude/hooks/agent-desk/ */
const HOOK_SCRIPTS: Record<string, { filename: string; content: string }> = {
  'comm-session-start': {
    filename: 'comm-session-start.js',
    content: `#!/usr/bin/env node
const port = parseInt(process.env.AGENT_COMM_PORT || '3421', 10);
const msg = {
  systemMessage: 'agent-comm: http://localhost:' + port,
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: 'Pipeline: http://localhost:' + (port + 1) +
      '\\nagent-comm startup: 1) comm_register 2) comm_channel({ action: "join", channel: "general" }) 3) comm_send({ channel: "general" }) your intent 4) comm_inbox — then proceed.' +
      '\\nDashboard: http://localhost:' + port +
      '\\nNote: You will be reminded to check comm_inbox when new messages arrive. Always call comm_inbox before starting significant work to check for coordination signals from other agents.' +
      '\\nKnowledge: http://localhost:' + (port + 2),
  },
};
console.log(JSON.stringify(msg));
`,
  },
  'tasks-session-start': {
    filename: 'tasks-session-start.js',
    content: `#!/usr/bin/env node
const port = process.env.AGENT_TASKS_PORT || '3422';
const msg = {
  systemMessage: 'agent-tasks: http://localhost:' + port,
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: 'Pipeline: http://localhost:' + port,
  },
};
console.log(JSON.stringify(msg));
`,
  },
  'knowledge-session-start': {
    filename: 'knowledge-session-start.js',
    content: `#!/usr/bin/env node
const port = process.env.AGENT_KNOWLEDGE_PORT || '3423';
const msg = {
  systemMessage: 'agent-knowledge: http://localhost:' + port,
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: 'Knowledge: http://localhost:' + port,
  },
};
console.log(JSON.stringify(msg));
`,
  },
  'comm-on-stop': {
    filename: 'comm-on-stop.js',
    content: `#!/usr/bin/env node
const msg = {
  reason: 'Before stopping:\\n' +
    '1. Post a brief summary of what you accomplished to "general" via comm_send({ channel: "general" })\\n' +
    '2. Clean up any shared state you own — especially locks via comm_state({ action: "delete" })\\n' +
    '3. Call comm_agents({ action: "unregister" }) to go offline cleanly',
};
console.log(JSON.stringify(msg));
`,
  },
  'comm-check-registration': {
    filename: 'comm-check-registration.js',
    content: `#!/usr/bin/env node
const { existsSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

process.on('uncaughtException', () => { process.exit(0); });

function check() {
  const dbPath = join(homedir(), '.agent-comm', 'agent-comm.db');
  if (!existsSync(dbPath)) return { registered: false, recentMessages: 0, onlineAgents: 0 };
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const agentRow = db.prepare("SELECT COUNT(*) as cnt FROM agents WHERE status IN ('online', 'idle')").get();
    const msgRow = db.prepare("SELECT COUNT(*) as cnt FROM messages WHERE created_at > datetime('now', '-10 minutes')").get();
    db.close();
    return { registered: agentRow.cnt > 0, onlineAgents: agentRow.cnt, recentMessages: msgRow.cnt };
  } catch { return null; }
}

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const r = check();
    if (!r) { console.log(JSON.stringify({})); return; }
    if (!r.registered) {
      console.log(JSON.stringify({ hookSpecificOutput: { additionalContext: 'No agent-comm session. Call comm_register first, then comm_channel({ action: "join", channel: "general" }).' } }));
    } else if (r.recentMessages > 0) {
      console.log(JSON.stringify({ hookSpecificOutput: { additionalContext: r.onlineAgents + ' agent(s) online, ' + r.recentMessages + ' message(s) in last 10 min. Call comm_inbox NOW before starting this work.' } }));
    } else if (r.onlineAgents > 1) {
      console.log(JSON.stringify({ hookSpecificOutput: { additionalContext: r.onlineAgents + ' agents online. Consider posting a status update to "general".' } }));
    } else {
      console.log(JSON.stringify({}));
    }
  } catch { console.log(JSON.stringify({})); }
});
`,
  },
  'comm-check-inbox': {
    filename: 'comm-check-inbox.js',
    content: `#!/usr/bin/env node
const { existsSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    if (data.tool_name && data.tool_name.startsWith('mcp__agent-comm__')) {
      console.log(JSON.stringify({}));
      return;
    }
  } catch {}
  const dbPath = join(homedir(), '.agent-comm', 'agent-comm.db');
  if (!existsSync(dbPath)) { console.log(JSON.stringify({})); return; }
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const msgRow = db.prepare("SELECT COUNT(*) as cnt FROM messages WHERE created_at > datetime('now', '-10 minutes')").get();
    const agentRow = db.prepare("SELECT COUNT(*) as cnt FROM agents WHERE status IN ('online', 'idle')").get();
    db.close();
    const parts = [];
    if (msgRow.cnt > 0) parts.push('You have unread messages (' + msgRow.cnt + ' in last 10 min). You MUST call comm_inbox now.');
    if (agentRow.cnt > 1) parts.push(agentRow.cnt + ' agents online.');
    if (parts.length > 0) {
      console.log(JSON.stringify({ hookSpecificOutput: { additionalContext: parts.join(' ') } }));
    } else {
      console.log(JSON.stringify({}));
    }
  } catch { console.log(JSON.stringify({})); }
});
`,
  },
  'tasks-cleanup-stop': {
    filename: 'tasks-cleanup-stop.js',
    content: `#!/usr/bin/env node
const { readFileSync, existsSync, writeFileSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

const MAX_BLOCKS = 1;
const COUNTER_FILE = join(homedir(), '.claude', 'task-cleanup-counter.json');
const DB_PATH = process.env.AGENT_TASKS_DB || join(homedir(), '.agent-tasks', 'agent-tasks.db');

function getSessionName() {
  const agentCommDb = join(homedir(), '.agent-comm', 'agent-comm.db');
  try {
    const Database = require('better-sqlite3');
    const db = new Database(agentCommDb, { readonly: true, fileMustExist: true });
    const row = db.prepare('SELECT name FROM agents WHERE status = \\'online\\' ORDER BY last_heartbeat DESC LIMIT 1').get();
    db.close();
    if (row && row.name) return row.name;
  } catch {}
  return null;
}

function getBlockCount(sessionName) {
  try {
    if (existsSync(COUNTER_FILE)) {
      const counter = JSON.parse(readFileSync(COUNTER_FILE, 'utf-8'));
      if (counter.session === sessionName) return counter.count || 0;
    }
  } catch {}
  return 0;
}

function setBlockCount(sessionName, count) {
  try { writeFileSync(COUNTER_FILE, JSON.stringify({ session: sessionName, count })); } catch {}
}

let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const sessionName = getSessionName();
    if (!sessionName || !existsSync(DB_PATH)) { console.log(JSON.stringify({})); return; }
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH, { readonly: false });
    const tasks = db.prepare("SELECT id, title, status, stage FROM tasks WHERE assigned_to = ? AND status IN ('pending', 'in_progress')").all(sessionName);
    if (!tasks.length) { db.close(); setBlockCount(sessionName, 0); console.log(JSON.stringify({})); return; }
    const blockCount = getBlockCount(sessionName);
    const taskList = tasks.map(t => '#' + t.id + ' [' + t.status + '@' + t.stage + '] ' + t.title).join('\\n  ');
    if (blockCount < MAX_BLOCKS) {
      db.close();
      setBlockCount(sessionName, blockCount + 1);
      console.log(JSON.stringify({ decision: 'block', reason: 'You have ' + tasks.length + ' incomplete task(s):\\n  ' + taskList + '\\n\\nComplete or fail each task before stopping.' }));
      return;
    }
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const failStmt = db.prepare('UPDATE tasks SET status = ?, result = ?, updated_at = ? WHERE id = ?');
    const failAll = db.transaction(() => {
      for (const task of tasks) failStmt.run('failed', 'Session "' + sessionName + '" ended (auto-cleanup)', now, task.id);
    });
    failAll();
    db.close();
    setBlockCount(sessionName, 0);
    console.log(JSON.stringify({ decision: 'allow', reason: 'Auto-failed ' + tasks.length + ' orphaned task(s). Session ending.' }));
  } catch { console.log(JSON.stringify({})); }
});
`,
  },
  'tasks-cleanup-start': {
    filename: 'tasks-cleanup-start.js',
    content: `#!/usr/bin/env node
const { existsSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

const DB_PATH = process.env.AGENT_TASKS_DB || join(homedir(), '.agent-tasks', 'agent-tasks.db');

function getActiveSessions() {
  const agentCommDb = join(homedir(), '.agent-comm', 'agent-comm.db');
  const active = new Set();
  try {
    const Database = require('better-sqlite3');
    const db = new Database(agentCommDb, { readonly: true, fileMustExist: true });
    const rows = db.prepare('SELECT name FROM agents WHERE status = \\'online\\'').all();
    db.close();
    for (const row of rows) {
      if (row.name) active.add(row.name);
    }
  } catch {}
  return active;
}

let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    if (!existsSync(DB_PATH)) { console.log(JSON.stringify({})); return; }
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH, { readonly: false });
    const assignees = db.prepare("SELECT DISTINCT assigned_to FROM tasks WHERE assigned_to IS NOT NULL AND status IN ('pending', 'in_progress')").pluck().all();
    if (!assignees.length) { db.close(); console.log(JSON.stringify({})); return; }
    const activeSessions = getActiveSessions();
    const staleAssignees = assignees.filter(a => !activeSessions.has(a));
    if (!staleAssignees.length) { db.close(); console.log(JSON.stringify({})); return; }
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const failStmt = db.prepare("UPDATE tasks SET status = 'failed', result = 'Session ' || ? || ' no longer running (stale task cleanup)', updated_at = ? WHERE assigned_to = ? AND status IN ('pending', 'in_progress')");
    let cleaned = 0;
    const cleanAll = db.transaction(() => { for (const a of staleAssignees) { cleaned += failStmt.run(a, now, a).changes; } });
    cleanAll();
    db.close();
    if (cleaned > 0) process.stderr.write('[task-cleanup-start] Auto-failed ' + cleaned + ' task(s)\\n');
    console.log(JSON.stringify({}));
  } catch (err) {
    process.stderr.write('[task-cleanup-start] ' + (err.message || err) + '\\n');
    console.log(JSON.stringify({}));
  }
});
`,
  },
};

/** Hook assignments — which scripts run at which hook events */
const HOOK_ASSIGNMENTS: Record<string, Array<{ scriptKey: string; timeout: number }>> = {
  SessionStart: [
    { scriptKey: 'comm-session-start', timeout: 5 },
    { scriptKey: 'tasks-session-start', timeout: 5 },
    { scriptKey: 'knowledge-session-start', timeout: 5 },
    { scriptKey: 'tasks-cleanup-start', timeout: 10 },
  ],
  UserPromptSubmit: [{ scriptKey: 'comm-check-registration', timeout: 10 }],
  PostToolUse: [{ scriptKey: 'comm-check-inbox', timeout: 5 }],
  Stop: [
    { scriptKey: 'comm-on-stop', timeout: 5 },
    { scriptKey: 'tasks-cleanup-stop', timeout: 10 },
  ],
  SubagentStart: [
    { scriptKey: 'comm-session-start', timeout: 5 },
    { scriptKey: 'tasks-session-start', timeout: 5 },
    { scriptKey: 'knowledge-session-start', timeout: 5 },
  ],
  SubagentStop: [
    { scriptKey: 'comm-on-stop', timeout: 5 },
    { scriptKey: 'tasks-cleanup-stop', timeout: 10 },
  ],
};

/** Required MCP permission patterns */
const REQUIRED_PERMISSIONS = [
  'mcp__agent-comm__*',
  'mcp__agent-tasks__*',
  'mcp__agent-knowledge__*',
  'mcp__agent-discover__*',
];

/**
 * Install hook scripts to ~/.claude/hooks/agent-desk/ and configure
 * hooks + permissions in ~/.claude/settings.json.
 * Only runs for Claude Code.
 */
export function configureClaudeCodeExtras(): ConfigResult {
  const settingsPath = home('.claude', 'settings.json');
  const hooksDir = home('.claude', 'hooks', 'agent-desk');

  try {
    // Ensure hooks directory exists
    mkdirSync(hooksDir, { recursive: true });

    // Write hook scripts
    for (const [, def] of Object.entries(HOOK_SCRIPTS)) {
      const scriptPath = join(hooksDir, def.filename);
      writeFileSync(scriptPath, def.content, 'utf-8');
    }

    // Read or create settings.json
    let settings = readJsonFile(settingsPath);
    if (existsSync(settingsPath) && settings === null) {
      return {
        tool: 'claude-code',
        label: 'Claude Code Extras',
        path: settingsPath,
        status: 'error',
        message: 'Could not parse settings.json (invalid JSON)',
      };
    }
    if (!settings) settings = {};

    // Backup before modifying
    backupFile(settingsPath);

    let modified = false;

    // --- Permissions ---
    if (!settings.permissions || typeof settings.permissions !== 'object') {
      settings.permissions = {};
    }
    const perms = settings.permissions as Record<string, unknown>;
    if (!Array.isArray(perms.allow)) {
      perms.allow = [];
    }
    const allowList = perms.allow as string[];
    for (const perm of REQUIRED_PERMISSIONS) {
      if (!allowList.includes(perm)) {
        allowList.push(perm);
        modified = true;
      }
    }

    // --- Hooks ---
    if (!settings.hooks || typeof settings.hooks !== 'object') {
      settings.hooks = {};
    }
    const hooks = settings.hooks as Record<string, unknown>;

    for (const [eventName, assignments] of Object.entries(HOOK_ASSIGNMENTS)) {
      // Build expected commands for this event
      const newCommands: Array<{ command: string; timeout: number }> = [];
      for (const a of assignments) {
        const def = HOOK_SCRIPTS[a.scriptKey];
        if (!def) continue;
        const cmd = `node "$HOME/.claude/hooks/agent-desk/${def.filename}"`;
        newCommands.push({ command: cmd, timeout: a.timeout });
      }

      let groups = hooks[eventName] as HookGroup[] | undefined;
      if (!Array.isArray(groups)) {
        groups = [];
        hooks[eventName] = groups;
      }

      const existingCommands = new Set<string>();
      for (const group of groups) {
        if (Array.isArray(group.hooks)) {
          for (const h of group.hooks) {
            existingCommands.add(h.command);
          }
        }
      }

      const toAdd: HookEntry[] = [];
      for (const nc of newCommands) {
        const scriptFilename = nc.command.split('/').pop()?.replace('"', '') || '';
        const alreadyExists = [...existingCommands].some(
          (cmd) => cmd === nc.command || cmd.includes('agent-desk/' + scriptFilename),
        );
        if (!alreadyExists) {
          toAdd.push({ type: 'command', command: nc.command, timeout: nc.timeout });
        }
      }

      if (toAdd.length > 0) {
        if (groups.length === 0) {
          groups.push({ hooks: [] });
          hooks[eventName] = groups;
        }
        (groups[0].hooks as HookEntry[]).push(...toAdd);
        modified = true;
      }
    }

    if (!modified) {
      return {
        tool: 'claude-code',
        label: 'Claude Code Extras',
        path: settingsPath,
        status: 'skipped',
        message: 'Hooks and permissions already configured',
      };
    }

    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

    return {
      tool: 'claude-code',
      label: 'Claude Code Extras',
      path: settingsPath,
      status: 'configured',
      message: 'Added hooks and permissions to settings.json',
    };
  } catch (err) {
    return {
      tool: 'claude-code',
      label: 'Claude Code Extras',
      path: settingsPath,
      status: 'error',
      message: `${err}`,
    };
  }
}
