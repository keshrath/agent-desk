// Unit tests for @agent-desk/core/plugin-system pure functions:
// discoverPlugins, getPluginInfoList, resolvePluginAsset, getPluginConfig.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  discoverPlugins,
  getPluginInfoList,
  resolvePluginAsset,
  getPluginConfig,
} from '../../packages/core/src/plugin-system.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-desk-plugin-system-'));
});

afterEach(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

function writePlugin(pkgName: string, manifest: Record<string, unknown>) {
  const dir = join(tmpDir, pkgName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'agent-desk-plugin.json'), JSON.stringify(manifest));
  const uiDir = join(dir, 'dist', 'ui');
  mkdirSync(uiDir, { recursive: true });
  writeFileSync(join(uiDir, 'app.js'), 'console.log("plugin");');
  writeFileSync(join(uiDir, 'styles.css'), '.plugin { color: red; }');
  return dir;
}

describe('plugin-system', () => {
  it('discoverPlugins() returns [] when the dir does not exist', () => {
    expect(discoverPlugins(join(tmpDir, 'nope'))).toEqual([]);
  });

  it('discoverPlugins() finds packages with agent-desk-plugin.json', () => {
    writePlugin('plugin-a', { id: 'plugin-a', name: 'Plugin A', icon: 'star', version: '1.0.0', description: 'a', ui: 'app.js' });
    writePlugin('plugin-b', { id: 'plugin-b', name: 'Plugin B', icon: 'bolt', version: '2.0.0', description: 'b', ui: 'app.js' });
    writePlugin('not-a-plugin', { id: 'noop' }); // missing required keys, but the loader is permissive
    const plugins = discoverPlugins(tmpDir);
    expect(plugins.length).toBeGreaterThanOrEqual(2);
    const ids = plugins.map((p) => p.manifest.id);
    expect(ids).toContain('plugin-a');
    expect(ids).toContain('plugin-b');
  });

  it('discoverPlugins() sorts by manifest.position ascending', () => {
    writePlugin('p1', { id: 'p1', name: 'P1', icon: '', version: '1', description: '', ui: 'app.js', position: 5 });
    writePlugin('p2', { id: 'p2', name: 'P2', icon: '', version: '1', description: '', ui: 'app.js', position: 2 });
    writePlugin('p3', { id: 'p3', name: 'P3', icon: '', version: '1', description: '', ui: 'app.js', position: 1 });
    const plugins = discoverPlugins(tmpDir);
    expect(plugins.map((p) => p.manifest.id)).toEqual(['p3', 'p2', 'p1']);
  });

  it('getPluginInfoList() builds info entries with file:// urls', () => {
    writePlugin('p1', { id: 'p1', name: 'P1', icon: 'home', version: '0.1.0', description: 'one', ui: 'app.js', css: 'styles.css' });
    const plugins = discoverPlugins(tmpDir);
    const info = getPluginInfoList(plugins);
    expect(info[0].id).toBe('p1');
    expect(info[0].name).toBe('P1');
    expect(info[0].cssUrl).toMatch(/^file:\/\//);
    expect(info[0].scriptUrls.length).toBe(1);
  });

  it('resolvePluginAsset() returns null for unknown plugin', () => {
    expect(resolvePluginAsset([], 'nothing', 'app.js')).toBe(null);
  });

  it('resolvePluginAsset() returns the absolute path + mime for a real asset', () => {
    writePlugin('p1', { id: 'p1', name: 'P1', icon: '', version: '1', description: '', ui: 'app.js' });
    const plugins = discoverPlugins(tmpDir);
    const r = resolvePluginAsset(plugins, 'p1', 'app.js');
    expect(r).not.toBe(null);
    expect(r!.absPath.endsWith('app.js')).toBe(true);
    expect(r!.mimeType).toBe('application/javascript');
    const css = resolvePluginAsset(plugins, 'p1', 'styles.css');
    expect(css!.mimeType).toBe('text/css');
  });

  it('resolvePluginAsset() blocks path traversal', () => {
    writePlugin('p1', { id: 'p1', name: 'P1', icon: '', version: '1', description: '', ui: 'app.js' });
    const plugins = discoverPlugins(tmpDir);
    expect(resolvePluginAsset(plugins, 'p1', '../../../etc/passwd')).toBe(null);
  });

  it('getPluginConfig() returns the dashboard URL for known plugin ids', () => {
    const plugins = [
      { manifest: { id: 'agent-comm', name: 'A', icon: '', version: '1', description: '', ui: 'app.js' }, packageDir: '/x' },
      { manifest: { id: 'unknown', name: 'X', icon: '', version: '1', description: '', ui: 'app.js' }, packageDir: '/x' },
    ];
    expect(getPluginConfig(plugins, 'agent-comm')).toEqual({
      baseUrl: 'http://localhost:3421',
      wsUrl: 'localhost:3421',
    });
    expect(getPluginConfig(plugins, 'unknown')).toBe(null);
    expect(getPluginConfig(plugins, 'nonexistent')).toBe(null);
  });
});
