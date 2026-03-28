/**
 * sidebar.spec.ts — Navigation tests
 *
 * Tests sidebar button clicks, keyboard shortcuts for view switching,
 * active-state styling, and tooltip visibility.
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

// ── Helpers ────────────────────────────────────────────────────────────

function navBtn(view: string) {
  return window.locator(`#sidebar .nav-btn[data-view="${view}"]`);
}

// ── Tests ──────────────────────────────────────────────────────────────

test('clicking terminal sidebar button shows terminal view', async () => {
  await navBtn('settings').click();
  await window.waitForTimeout(300);

  await navBtn('terminals').click();
  await window.waitForTimeout(300);

  await expect(window.locator('#terminal-views')).toHaveClass(/active/);
});

test('clicking comm button shows webview', async () => {
  await navBtn('comm').click();
  await window.waitForTimeout(500);

  const hasActive = await window.locator('#view-comm').evaluate((el) => el.classList.contains('active'));
  expect(hasActive).toBe(true);
});

test('clicking tasks button shows webview', async () => {
  await navBtn('tasks').click();
  await window.waitForTimeout(500);

  const hasActive = await window.locator('#view-tasks').evaluate((el) => el.classList.contains('active'));
  expect(hasActive).toBe(true);
});

test('clicking knowledge button shows webview', async () => {
  await navBtn('knowledge').click();
  await window.waitForTimeout(500);

  const hasActive = await window.locator('#view-knowledge').evaluate((el) => el.classList.contains('active'));
  expect(hasActive).toBe(true);
});

test('clicking settings button shows settings panel', async () => {
  await navBtn('settings').click();
  await window.waitForTimeout(300);

  await expect(window.locator('#settings-panel')).toHaveClass(/active/);
});

test('Ctrl+1 switches to terminals view', async () => {
  await navBtn('settings').click();
  await window.waitForTimeout(300);

  await window.keyboard.press('Control+1');
  await window.waitForTimeout(300);

  await expect(navBtn('terminals')).toHaveClass(/active/);
  await expect(window.locator('#terminal-views')).toHaveClass(/active/);
});

test('Ctrl+2 switches to comm view', async () => {
  await window.keyboard.press('Control+2');
  await window.waitForTimeout(300);

  await expect(navBtn('comm')).toHaveClass(/active/);
  const hasActive = await window.locator('#view-comm').evaluate((el) => el.classList.contains('active'));
  expect(hasActive).toBe(true);
});

test('Ctrl+3 switches to tasks view', async () => {
  await window.keyboard.press('Control+3');
  await window.waitForTimeout(300);

  await expect(navBtn('tasks')).toHaveClass(/active/);
  const hasActive = await window.locator('#view-tasks').evaluate((el) => el.classList.contains('active'));
  expect(hasActive).toBe(true);
});

test('active sidebar button has correct styling', async () => {
  await navBtn('terminals').click();
  await window.waitForTimeout(300);

  await expect(navBtn('terminals')).toHaveClass(/active/);
  await expect(navBtn('comm')).not.toHaveClass(/active/);
  await expect(navBtn('tasks')).not.toHaveClass(/active/);
  await expect(navBtn('knowledge')).not.toHaveClass(/active/);
  await expect(navBtn('settings')).not.toHaveClass(/active/);
});

test('sidebar tooltips are set via data-tooltip attribute', async () => {
  const tooltips = await window
    .locator('#sidebar .nav-btn[data-tooltip]')
    .evaluateAll((btns) => (btns as HTMLElement[]).map((b) => b.dataset.tooltip));

  expect(tooltips).toContain('Terminals');
  expect(tooltips).toContain('Agent Comm');
  expect(tooltips).toContain('Tasks');
  expect(tooltips).toContain('Settings');
});

test('switching views updates status bar text', async () => {
  const statusLeft = window.locator('#status-bar .status-left');

  await navBtn('comm').click();
  await window.waitForTimeout(300);
  await expect(statusLeft).toHaveText('Communication');

  await navBtn('tasks').click();
  await window.waitForTimeout(300);
  await expect(statusLeft).toHaveText('Tasks');

  await navBtn('knowledge').click();
  await window.waitForTimeout(300);
  await expect(statusLeft).toHaveText('Agent Knowledge');

  await navBtn('settings').click();
  await window.waitForTimeout(300);
  await expect(statusLeft).toHaveText('Settings');

  await navBtn('terminals').click();
  await window.waitForTimeout(300);
  const text = await statusLeft.innerText();
  expect(text.toLowerCase()).toContain('terminal');
});
