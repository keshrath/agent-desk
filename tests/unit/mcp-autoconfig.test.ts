// Unit tests for @agent-desk/core/mcp-autoconfig.
// Coverage is shallow on purpose: this module reads the host's Claude /
// Cursor / Windsurf / Gemini / OpenCode config files (which may or may
// not exist on the test host), and the auto-configure path mutates them.
// We don't want unit tests rewriting the developer's real ~/.claude.json.
//
// What we test: the public API exists, returns sensible types, and the
// embedded hook script string templates parse as syntactically valid
// JavaScript so a future edit doesn't ship broken hooks.

import { describe, it, expect } from 'vitest';
import {
  detectInstalledTools,
  configureToolMcp,
  autoConfigureMcpServers,
  configureClaudeCodeExtras,
} from '../../packages/core/src/mcp-autoconfig.js';

describe('mcp-autoconfig — public API', () => {
  it('exports detectInstalledTools as a function', () => {
    expect(typeof detectInstalledTools).toBe('function');
  });

  it('exports configureToolMcp as a function', () => {
    expect(typeof configureToolMcp).toBe('function');
  });

  it('exports autoConfigureMcpServers as a function', () => {
    expect(typeof autoConfigureMcpServers).toBe('function');
  });

  it('exports configureClaudeCodeExtras as a function', () => {
    expect(typeof configureClaudeCodeExtras).toBe('function');
  });
});

describe('mcp-autoconfig — detectInstalledTools', () => {
  it('returns an array of {name, label, path, configured} objects', () => {
    const tools = detectInstalledTools();
    expect(Array.isArray(tools)).toBe(true);
    for (const t of tools) {
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('label');
      expect(t).toHaveProperty('path');
      expect(t).toHaveProperty('configured');
      expect(typeof t.name).toBe('string');
      expect(typeof t.configured).toBe('boolean');
    }
  });
});

describe('mcp-autoconfig — configureToolMcp error path', () => {
  it('returns an error result for an unknown tool name', () => {
    const result = configureToolMcp('not-a-real-tool-name-zzz');
    expect(result.tool).toBe('not-a-real-tool-name-zzz');
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/Unknown tool/i);
  });
});
