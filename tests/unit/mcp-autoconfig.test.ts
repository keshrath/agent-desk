// Unit tests for @agent-desk/core/mcp-autoconfig.
//
// The module reads/writes real config files under os.homedir() (and
// LOCALAPPDATA on Windows for the OpenCode path). We fully isolate each
// test by pointing HOME/USERPROFILE/LOCALAPPDATA at a fresh mkdtempSync
// dir and calling vi.resetModules() so the module captures the override
// on re-import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';

let tmpHome: string;
let prevHome: string | undefined;
let prevUserProfile: string | undefined;
let prevLocalAppData: string | undefined;

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), 'agent-desk-mcpcfg-'));
  prevHome = process.env.HOME;
  prevUserProfile = process.env.USERPROFILE;
  prevLocalAppData = process.env.LOCALAPPDATA;
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  // Point LOCALAPPDATA at tmp so the OpenCode Windows branch lands in tmp.
  process.env.LOCALAPPDATA = join(tmpHome, 'AppData', 'Local');
  mkdirSync(process.env.LOCALAPPDATA, { recursive: true });
  vi.resetModules();
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  if (prevLocalAppData === undefined) delete process.env.LOCALAPPDATA;
  else process.env.LOCALAPPDATA = prevLocalAppData;
  try {
    rmSync(tmpHome, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

async function load() {
  return await import('../../packages/core/src/mcp-autoconfig.js');
}

const EXPECTED_SERVERS = ['agent-comm', 'agent-tasks', 'agent-knowledge', 'agent-discover'];

describe('mcp-autoconfig — public API exports', () => {
  it('exports the four public functions', async () => {
    const m = await load();
    expect(typeof m.detectInstalledTools).toBe('function');
    expect(typeof m.configureToolMcp).toBe('function');
    expect(typeof m.autoConfigureMcpServers).toBe('function');
    expect(typeof m.configureClaudeCodeExtras).toBe('function');
  });
});

describe('mcp-autoconfig — detectInstalledTools', () => {
  it('returns an empty array when no tool config files exist in the tmp home', async () => {
    const { detectInstalledTools } = await load();
    const tools = detectInstalledTools();
    expect(Array.isArray(tools)).toBe(true);
    // Nothing in tmpHome: all tools should fail detection.
    expect(tools).toEqual([]);
  });

  it('detects Claude Code when ~/.claude.json exists, configured=false', async () => {
    writeFileSync(join(tmpHome, '.claude.json'), JSON.stringify({}), 'utf-8');
    const { detectInstalledTools } = await load();
    const tools = detectInstalledTools();
    const cc = tools.find((t) => t.name === 'claude-code');
    expect(cc).toBeTruthy();
    expect(cc!.label).toBe('Claude Code');
    expect(cc!.configured).toBe(false);
  });

  it('detects Claude Code as configured=true when all four MCP servers are present', async () => {
    const mcpServers: Record<string, unknown> = {};
    for (const s of EXPECTED_SERVERS) mcpServers[s] = { command: 'npx', args: ['-y', s] };
    writeFileSync(join(tmpHome, '.claude.json'), JSON.stringify({ mcpServers }), 'utf-8');
    const { detectInstalledTools } = await load();
    const cc = detectInstalledTools().find((t) => t.name === 'claude-code')!;
    expect(cc.configured).toBe(true);
  });

  it('detects Claude Code as configured=false when only SOME servers are present', async () => {
    writeFileSync(
      join(tmpHome, '.claude.json'),
      JSON.stringify({ mcpServers: { 'agent-comm': { command: 'npx' } } }),
      'utf-8',
    );
    const { detectInstalledTools } = await load();
    expect(detectInstalledTools().find((t) => t.name === 'claude-code')!.configured).toBe(false);
  });

  it('detects Cursor, Windsurf, Gemini when their dirs exist', async () => {
    mkdirSync(join(tmpHome, '.cursor'), { recursive: true });
    mkdirSync(join(tmpHome, '.codeium', 'windsurf'), { recursive: true });
    mkdirSync(join(tmpHome, '.gemini'), { recursive: true });
    const { detectInstalledTools } = await load();
    const names = detectInstalledTools().map((t) => t.name);
    expect(names).toContain('cursor');
    expect(names).toContain('windsurf');
    expect(names).toContain('gemini-cli');
  });

  it('detects OpenCode on its platform-specific path', async () => {
    const dir =
      process.platform === 'win32' ? join(process.env.LOCALAPPDATA!, 'opencode') : join(tmpHome, '.config', 'opencode');
    mkdirSync(dir, { recursive: true });
    const { detectInstalledTools } = await load();
    const oc = detectInstalledTools().find((t) => t.name === 'opencode');
    expect(oc).toBeTruthy();
  });

  it('treats unparseable config as configured=false (readJsonFile catch branch)', async () => {
    writeFileSync(join(tmpHome, '.claude.json'), '{not json', 'utf-8');
    const { detectInstalledTools } = await load();
    expect(detectInstalledTools().find((t) => t.name === 'claude-code')!.configured).toBe(false);
  });
});

describe('mcp-autoconfig — configureToolMcp error paths', () => {
  it('returns error for unknown tool name', async () => {
    const { configureToolMcp } = await load();
    const r = configureToolMcp('not-a-real-tool');
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/Unknown tool/i);
  });

  it('returns skipped when tool is not detected', async () => {
    const { configureToolMcp } = await load();
    const r = configureToolMcp('cursor');
    expect(r.status).toBe('skipped');
    expect(r.message).toMatch(/not installed/i);
  });

  it('returns error when existing config file is unparseable JSON', async () => {
    writeFileSync(join(tmpHome, '.claude.json'), '{broken', 'utf-8');
    const { configureToolMcp } = await load();
    const r = configureToolMcp('claude-code');
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/parse/i);
  });
});

describe('mcp-autoconfig — configureToolMcp success (Claude Code)', () => {
  it('adds all four MCP servers with expected shape, backs up existing file', async () => {
    const cfgPath = join(tmpHome, '.claude.json');
    writeFileSync(cfgPath, JSON.stringify({ existingKey: 'preserved' }), 'utf-8');
    const { configureToolMcp } = await load();
    const r = configureToolMcp('claude-code');
    expect(r.status).toBe('configured');
    expect(r.serversAdded).toEqual(EXPECTED_SERVERS);
    expect(existsSync(cfgPath + '.bak')).toBe(true);

    const written = JSON.parse(readFileSync(cfgPath, 'utf-8'));
    expect(written.existingKey).toBe('preserved');
    for (const s of EXPECTED_SERVERS) {
      const entry = written.mcpServers[s];
      expect(entry.command).toBe('npx');
      expect(entry.args).toEqual(['-y', s]);
      expect(entry.type).toBe('stdio'); // extraKeys for claude-code
    }
  });

  it('is idempotent: second run returns skipped and does not duplicate entries', async () => {
    writeFileSync(join(tmpHome, '.claude.json'), JSON.stringify({}), 'utf-8');
    const { configureToolMcp } = await load();
    const r1 = configureToolMcp('claude-code');
    expect(r1.status).toBe('configured');
    const r2 = configureToolMcp('claude-code');
    expect(r2.status).toBe('skipped');
    expect(r2.message).toMatch(/already configured/i);
    const written = JSON.parse(readFileSync(join(tmpHome, '.claude.json'), 'utf-8'));
    expect(Object.keys(written.mcpServers).sort()).toEqual([...EXPECTED_SERVERS].sort());
  });

  it('creates mcpServers root key when config had none', async () => {
    writeFileSync(join(tmpHome, '.claude.json'), JSON.stringify({ foo: 1 }), 'utf-8');
    const { configureToolMcp } = await load();
    const r = configureToolMcp('claude-code');
    expect(r.status).toBe('configured');
    const written = JSON.parse(readFileSync(join(tmpHome, '.claude.json'), 'utf-8'));
    expect(typeof written.mcpServers).toBe('object');
  });

  it('replaces non-object mcpServers with a fresh object (defensive branch)', async () => {
    writeFileSync(join(tmpHome, '.claude.json'), JSON.stringify({ mcpServers: 'garbage' }), 'utf-8');
    const { configureToolMcp } = await load();
    const r = configureToolMcp('claude-code');
    expect(r.status).toBe('configured');
    const written = JSON.parse(readFileSync(join(tmpHome, '.claude.json'), 'utf-8'));
    expect(typeof written.mcpServers).toBe('object');
    expect(Object.keys(written.mcpServers)).toEqual(EXPECTED_SERVERS);
  });
});

describe('mcp-autoconfig — configureToolMcp (Cursor, Gemini, Windsurf)', () => {
  it('Cursor: writes mcp.json into ~/.cursor with plain entries (no extraKeys)', async () => {
    mkdirSync(join(tmpHome, '.cursor'), { recursive: true });
    const { configureToolMcp } = await load();
    const r = configureToolMcp('cursor');
    expect(r.status).toBe('configured');
    const written = JSON.parse(readFileSync(join(tmpHome, '.cursor', 'mcp.json'), 'utf-8'));
    const entry = written.mcpServers['agent-comm'];
    expect(entry.command).toBe('npx');
    expect(entry.args).toEqual(['-y', 'agent-comm']);
    expect(entry.type).toBeUndefined();
  });

  it('Gemini: writes settings.json into ~/.gemini', async () => {
    mkdirSync(join(tmpHome, '.gemini'), { recursive: true });
    const { configureToolMcp } = await load();
    const r = configureToolMcp('gemini-cli');
    expect(r.status).toBe('configured');
    const written = JSON.parse(readFileSync(join(tmpHome, '.gemini', 'settings.json'), 'utf-8'));
    expect(Object.keys(written.mcpServers)).toEqual(EXPECTED_SERVERS);
  });

  it('Windsurf: writes mcp_config.json into ~/.codeium/windsurf', async () => {
    mkdirSync(join(tmpHome, '.codeium', 'windsurf'), { recursive: true });
    const { configureToolMcp } = await load();
    const r = configureToolMcp('windsurf');
    expect(r.status).toBe('configured');
    const written = JSON.parse(readFileSync(join(tmpHome, '.codeium', 'windsurf', 'mcp_config.json'), 'utf-8'));
    expect(Object.keys(written.mcpServers)).toEqual(EXPECTED_SERVERS);
  });
});

describe('mcp-autoconfig — configureToolMcp (OpenCode special format)', () => {
  it('writes OpenCode-style entries (type=local, array command, enabled)', async () => {
    const dir =
      process.platform === 'win32' ? join(process.env.LOCALAPPDATA!, 'opencode') : join(tmpHome, '.config', 'opencode');
    mkdirSync(dir, { recursive: true });
    const { configureToolMcp } = await load();
    const r = configureToolMcp('opencode');
    expect(r.status).toBe('configured');
    const written = JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf-8'));
    // OpenCode uses rootKey 'mcp'
    const entry = written.mcp['agent-comm'];
    expect(entry.type).toBe('local');
    expect(entry.command).toEqual(['npx', '-y', 'agent-comm']);
    expect(entry.enabled).toBe(true);
    expect(entry.environment).toEqual({});
  });
});

describe('mcp-autoconfig — autoConfigureMcpServers', () => {
  it('returns empty array when no tools are detected', async () => {
    const { autoConfigureMcpServers } = await load();
    expect(autoConfigureMcpServers()).toEqual([]);
  });

  it('configures Claude Code AND runs extras (returns 2 results for that tool)', async () => {
    writeFileSync(join(tmpHome, '.claude.json'), JSON.stringify({}), 'utf-8');
    const { autoConfigureMcpServers } = await load();
    const results = autoConfigureMcpServers();
    const tools = results.map((r) => r.tool);
    // Primary result + extras
    expect(tools.filter((t) => t === 'claude-code').length).toBeGreaterThanOrEqual(2);
    // Extras write hooks dir
    expect(existsSync(join(tmpHome, '.claude', 'hooks', 'agent-desk'))).toBe(true);
  });
});

describe('mcp-autoconfig — configureClaudeCodeExtras', () => {
  it('writes all hook scripts, permissions, and hook assignments to settings.json', async () => {
    const { configureClaudeCodeExtras } = await load();
    const r = configureClaudeCodeExtras();
    expect(r.status).toBe('configured');

    const hooksDir = join(tmpHome, '.claude', 'hooks', 'agent-desk');
    const expectedFiles = [
      'comm-session-start.js',
      'tasks-session-start.js',
      'knowledge-session-start.js',
      'comm-on-stop.js',
      'comm-check-registration.js',
      'comm-check-inbox.js',
      'tasks-cleanup-stop.js',
      'tasks-cleanup-start.js',
    ];
    for (const f of expectedFiles) {
      expect(existsSync(join(hooksDir, f))).toBe(true);
    }

    const settings = JSON.parse(readFileSync(join(tmpHome, '.claude', 'settings.json'), 'utf-8'));
    const allow: string[] = settings.permissions.allow;
    expect(allow).toEqual(
      expect.arrayContaining([
        'mcp__agent-comm__*',
        'mcp__agent-tasks__*',
        'mcp__agent-knowledge__*',
        'mcp__agent-discover__*',
      ]),
    );
    expect(Array.isArray(settings.hooks.SessionStart)).toBe(true);
    const sessionStartCommands: string[] = settings.hooks.SessionStart.flatMap(
      (g: { hooks: Array<{ command: string }> }) => g.hooks.map((h) => h.command),
    );
    expect(sessionStartCommands.some((c) => c.includes('comm-session-start.js'))).toBe(true);
    expect(sessionStartCommands.some((c) => c.includes('tasks-session-start.js'))).toBe(true);
  });

  it('is idempotent: second call returns skipped', async () => {
    const { configureClaudeCodeExtras } = await load();
    const r1 = configureClaudeCodeExtras();
    expect(r1.status).toBe('configured');
    const r2 = configureClaudeCodeExtras();
    expect(r2.status).toBe('skipped');
    expect(r2.message).toMatch(/already configured/i);
  });

  it('merges into pre-existing settings.json with other permissions preserved', async () => {
    mkdirSync(join(tmpHome, '.claude'), { recursive: true });
    writeFileSync(
      join(tmpHome, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { allow: ['Bash(ls:*)'] }, foo: 'preserved' }),
      'utf-8',
    );
    const { configureClaudeCodeExtras } = await load();
    const r = configureClaudeCodeExtras();
    expect(r.status).toBe('configured');
    const settings = JSON.parse(readFileSync(join(tmpHome, '.claude', 'settings.json'), 'utf-8'));
    expect(settings.foo).toBe('preserved');
    expect(settings.permissions.allow).toContain('Bash(ls:*)');
    expect(settings.permissions.allow).toContain('mcp__agent-comm__*');
    // Backup created
    expect(existsSync(join(tmpHome, '.claude', 'settings.json.bak'))).toBe(true);
  });

  it('returns error when existing settings.json is unparseable', async () => {
    mkdirSync(join(tmpHome, '.claude'), { recursive: true });
    writeFileSync(join(tmpHome, '.claude', 'settings.json'), '{broken', 'utf-8');
    const { configureClaudeCodeExtras } = await load();
    const r = configureClaudeCodeExtras();
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/parse/i);
  });

  it('all HOOK_SCRIPTS contents parse as syntactically valid JavaScript (node --check)', async () => {
    const { configureClaudeCodeExtras } = await load();
    configureClaudeCodeExtras();
    // Make the agent-desk hooks dir a live ES module scope so `import` is valid,
    // matching what the real ~/.claude/hooks/package.json declares.
    const hooksDir = join(tmpHome, '.claude', 'hooks', 'agent-desk');
    writeFileSync(join(tmpHome, '.claude', 'hooks', 'package.json'), '{"type":"module"}', 'utf-8');
    const files = [
      'comm-session-start.js',
      'tasks-session-start.js',
      'knowledge-session-start.js',
      'comm-on-stop.js',
      'comm-check-registration.js',
      'comm-check-inbox.js',
      'tasks-cleanup-stop.js',
      'tasks-cleanup-start.js',
    ];
    for (const f of files) {
      const r = spawnSync(process.execPath, ['--check', join(hooksDir, f)], {
        encoding: 'utf-8',
      });
      expect(r.status, `${f} failed node --check:\n${r.stderr}`).toBe(0);
      expect(r.stderr).not.toMatch(/SyntaxError|ReferenceError/);
    }
  });
});
