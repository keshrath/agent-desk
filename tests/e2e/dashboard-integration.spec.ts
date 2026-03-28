/**
 * dashboard-integration.spec.ts — F14: Dashboard Integration
 *
 * Tests webview containers for comm/tasks/knowledge views,
 * dashboard toolbar elements, and the webview bridge API.
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

// ── Webview Containers ───────────────────────────────────────────────

test('comm webview container exists', async () => {
  const container = window.locator('#view-comm');
  await expect(container).toBeAttached();
});

test('tasks webview container exists', async () => {
  const container = window.locator('#view-tasks');
  await expect(container).toBeAttached();
});

test('knowledge webview container exists', async () => {
  const container = window.locator('#view-knowledge');
  await expect(container).toBeAttached();
});

test('comm webview has correct data-src', async () => {
  const src = await window.locator('#webview-comm').getAttribute('data-src');
  expect(src).toContain('localhost:3421');
});

test('tasks webview has correct data-src', async () => {
  const src = await window.locator('#webview-tasks').getAttribute('data-src');
  expect(src).toContain('localhost:3422');
});

test('knowledge webview has correct data-src', async () => {
  const src = await window.locator('#webview-knowledge').getAttribute('data-src');
  expect(src).toContain('localhost:3423');
});

// ── View Switching ───────────────────────────────────────────────────

test('switching to comm view activates it', async () => {
  await window.locator('#sidebar .nav-btn[data-view="comm"]').click();
  await window.waitForTimeout(500);

  const isActive = await window.locator('#view-comm').evaluate((el) => el.classList.contains('active'));
  expect(isActive).toBe(true);
});

test('switching to tasks view activates it', async () => {
  await window.locator('#sidebar .nav-btn[data-view="tasks"]').click();
  await window.waitForTimeout(500);

  const isActive = await window.locator('#view-tasks').evaluate((el) => el.classList.contains('active'));
  expect(isActive).toBe(true);
});

test('switching to knowledge view activates it', async () => {
  await window.locator('#sidebar .nav-btn[data-view="knowledge"]').click();
  await window.waitForTimeout(500);

  const isActive = await window.locator('#view-knowledge').evaluate((el) => el.classList.contains('active'));
  expect(isActive).toBe(true);
});

// ── Webview Bridge API ───────────────────────────────────────────────

test('webview bridge API is available', async () => {
  const hasApi = await window.evaluate(() => {
    const ad = (window as any).agentDesk;
    return !!(ad && ad.webview && ad.webview.getPreloadPath && ad.webview.broadcastTerminalUpdate);
  });
  expect(hasApi).toBe(true);
});

test('webview.getPreloadPath returns a path', async () => {
  const path = await window.evaluate(async () => {
    return await (window as any).agentDesk.webview.getPreloadPath();
  });
  expect(path).toBeTruthy();
  expect(typeof path).toBe('string');
});

test('webview.onTerminalUpdate is a function', async () => {
  const isFunction = await window.evaluate(() => {
    return typeof (window as any).agentDesk.webview.onTerminalUpdate === 'function';
  });
  expect(isFunction).toBe(true);
});

// ── Return to terminals ──────────────────────────────────────────────

test('return to terminals view', async () => {
  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});
