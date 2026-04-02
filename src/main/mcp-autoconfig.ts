// mcp-autoconfig.ts — Auto-configure MCP servers for detected AI coding tools
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
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
      results.push(configureToolMcp(tool.name));
    }
  }
  return results;
}
