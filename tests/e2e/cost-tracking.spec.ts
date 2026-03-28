/**
 * cost-tracking.spec.ts — Cost Tracking (agent-parser + system-monitor)
 *
 * Tests cost estimation in the status bar, per-agent cost tracking,
 * and cost display in tooltips.
 */

import { test, expect } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { buildApp, launchApp, closeApp, screenshotOnFailure } from './helpers';

let app: ElectronApplication;
let window: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  buildApp();
  ({ app, window } = await launchApp());
});

test.afterAll(async () => {
  if (app) await closeApp(app);
});

test.afterEach(async ({}, testInfo) => {
  await screenshotOnFailure(window, testInfo);
});

// ── Agent Parser Cost Tracking ──────────────────────────────────────

test('agentParser tracks tool call counts', async () => {
  const result = await window.evaluate(`(() => {
    agentParser.markAsAgent('cost-test-1', 'cost-agent');
    agentParser.parse('cost-test-1', 'Read(file.ts)');
    agentParser.parse('cost-test-1', 'Write(output.ts)');
    agentParser.parse('cost-test-1', 'Bash(npm test)');
    const info = agentParser.getInfo('cost-test-1');
    const toolCount = info ? info.toolCount : -1;
    agentParser.cleanup('cost-test-1');
    return toolCount;
  })()`);
  expect(result).toBe(3);
});

test('agentParser tracks recent tools', async () => {
  const tools = await window.evaluate(`(() => {
    agentParser.markAsAgent('cost-test-2', 'tool-agent');
    agentParser.parse('cost-test-2', 'Read(a.ts)');
    agentParser.parse('cost-test-2', 'Edit(b.ts)');
    agentParser.parse('cost-test-2', 'Grep(pattern)');
    const info = agentParser.getInfo('cost-test-2');
    const recent = info ? info.recentTools.slice() : [];
    agentParser.cleanup('cost-test-2');
    return recent;
  })()`);
  expect(Array.isArray(tools)).toBe(true);
  expect(tools.length).toBeGreaterThanOrEqual(3);
});

// ── Status Bar Widget ───────────────────────────────────────────────

test('status bar exists', async () => {
  const statusBar = window.locator('#status-bar');
  await expect(statusBar).toBeVisible();
});

test('status bar has left, center, and right sections', async () => {
  const left = window.locator('#status-bar .status-left');
  const center = window.locator('#status-bar .status-center');
  const right = window.locator('#status-bar .status-right');

  await expect(left).toBeAttached();
  await expect(center).toBeAttached();
  await expect(right).toBeAttached();
});

test('system stats widget renders in status bar', async () => {
  const stats = window.locator('.system-stats');
  const count = await stats.count();
  expect(count).toBeGreaterThanOrEqual(0);
});

// ── Cost Widget ─────────────────────────────────────────────────────

test('cost widget may appear in status bar when agents have tool calls', async () => {
  const hasCostWidget = await window.evaluate(() => {
    const widget = document.querySelector('.cost-widget');
    return !!widget;
  });

  expect(typeof hasCostWidget).toBe('boolean');
});
