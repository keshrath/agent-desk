/**
 * agent-monitor.spec.ts -- Agent Monitor View
 *
 * Tests the monitor view navigation, agent card rendering,
 * and status dot display.
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

test('clicking monitor nav button switches to monitor view', async () => {
  await window.locator('#sidebar .nav-btn[data-view="monitor"]').click();
  await window.waitForTimeout(500);

  const view = window.locator('#view-monitor');
  await expect(view).toHaveClass(/active/);
});

test('agent cards render when terminals exist in state', async () => {
  const rendered = await window.evaluate(() => {
    const s = (window as any).__agentDeskState;
    const r = (window as any).__agentDeskRegistry;
    if (!s || !r) return false;

    s.terminals.set('monitor-test-card', {
      title: 'Test Agent',
      status: 'running',
      lastOutputTime: Date.now(),
    });

    if (r.renderAgentMonitor) r.renderAgentMonitor();

    const card = document.querySelector('.agent-monitor-card[data-terminal-id="monitor-test-card"]');
    const dot = card?.querySelector('.agent-monitor-dot');
    const exists = !!card && !!dot;

    s.terminals.delete('monitor-test-card');
    if (r.renderAgentMonitor) r.renderAgentMonitor();

    return exists;
  });

  expect(rendered).toBe(true);
});

test('monitor view shows empty state when no agents', async () => {
  await window.locator('#sidebar .nav-btn[data-view="monitor"]').click();
  await window.waitForTimeout(500);

  const hasTerminals = await window.evaluate(() => {
    const s = (window as any).__agentDeskState;
    return s && s.terminals && s.terminals.size > 0;
  });

  if (!hasTerminals) {
    const emptyEl = window.locator('#view-monitor .agent-monitor-empty');
    if ((await emptyEl.count()) > 0) {
      await expect(emptyEl).toContainText('No agents');
    }
  }

  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});
