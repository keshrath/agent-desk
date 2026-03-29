/**
 * agent-awareness.spec.ts -- Agent-Aware Terminals
 *
 * Tests the agent parser integration: detection, tool calls, naming,
 * error tracking, and file modification tracking.
 */

import { test, expect } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { buildApp, launchApp, closeApp, screenshotOnFailure } from './helpers';

let app: ElectronApplication;
let window: Page;
let terminalsWork = false;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  buildApp();
  ({ app, window } = await launchApp());

  try {
    await window.locator('.dv-terminal-host').first().waitFor({ state: 'attached', timeout: 10000 });
    terminalsWork = true;
  } catch {
    terminalsWork = false;
  }
});

test.afterAll(async () => {
  if (app) await closeApp(app);
});

test.afterEach(async ({}, testInfo) => {
  await screenshotOnFailure(window, testInfo);
});

test('agentParser detects Claude Code patterns and tool calls', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(`(() => {
    const id = 'test-detect';
    agentParser.parse(id, 'Claude Code v1.2.3');
    agentParser.parse(id, 'Read(src/main/index.ts)');
    agentParser.parse(id, 'Write(src/utils/helper.ts)');
    agentParser.parse(id, 'Edit(src/existing.ts)');
    agentParser.parse(id, 'Bash(npm test)');
    agentParser.parse(id, 'Grep(pattern)');
    const info = agentParser.getInfo(id);
    const result = {
      isAgent: info.isAgent,
      lastTool: info.lastTool,
      toolCount: info.toolCount,
      recentTools: info.recentTools.map(t => t.tool),
      filesModified: [...info.filesModified],
    };
    agentParser.cleanup(id);
    return result;
  })()`);

  expect((result as any).isAgent).toBe(true);
  expect((result as any).lastTool).toBe('Grep');
  expect((result as any).toolCount).toBeGreaterThanOrEqual(5);
  expect((result as any).recentTools).toContain('Grep');
  expect((result as any).filesModified).toContain('src/utils/helper.ts');
  expect((result as any).filesModified).toContain('src/existing.ts');
});

test('agentParser marks agents and lists them', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const agents = (await window.evaluate(`(() => {
    agentParser.markAsAgent('test-list-1', 'agent-a');
    agentParser.markAsAgent('test-list-2', 'agent-b');
    const list = agentParser.getAgentTerminals();
    agentParser.cleanup('test-list-1');
    agentParser.cleanup('test-list-2');
    return list;
  })()`)) as any[];

  const names = agents.map((a: any) => a.agentName);
  expect(names).toContain('agent-a');
  expect(names).toContain('agent-b');
});

test('agentParser detects agent name from comm_register output', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const agentName = await window.evaluate(`(() => {
    agentParser.parse('test-named', 'Registered as: "odoo-dev"');
    const info = agentParser.getInfo('test-named');
    const result = info ? info.agentName : null;
    agentParser.cleanup('test-named');
    return result;
  })()`);
  expect(agentName).toBe('odoo-dev');
});

test('agentParser detects errors and non-Claude terminals are not flagged', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(`(() => {
    agentParser.parse('test-errors', 'Error: Cannot find module "foo"');
    const errInfo = agentParser.getInfo('test-errors');
    const hasErrors = errInfo && errInfo.errors.length > 0;
    agentParser.cleanup('test-errors');

    agentParser.parse('test-plain', 'npm install express');
    agentParser.parse('test-plain', 'ls -la');
    const isAgent = agentParser.isAgent('test-plain');
    agentParser.cleanup('test-plain');

    return { hasErrors, isAgent };
  })()`);

  expect((result as any).hasErrors).toBe(true);
  expect((result as any).isAgent).toBe(false);
});

test('agentParser cleanup removes terminal info', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(`(() => {
    agentParser.markAsAgent('test-cleanup', 'doomed');
    agentParser.cleanup('test-cleanup');
    return agentParser.getInfo('test-cleanup');
  })()`);
  expect(result).toBeNull();
});
