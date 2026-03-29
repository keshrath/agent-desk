/**
 * dashboard-integration.spec.ts -- Dashboard Integration
 *
 * Tests webview containers, data-src attributes, view switching,
 * and the webview bridge API.
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

test('webviews have correct data-src attributes', async () => {
  expect(await window.locator('#webview-comm').getAttribute('data-src')).toContain('localhost:3421');
  expect(await window.locator('#webview-tasks').getAttribute('data-src')).toContain('localhost:3422');
  expect(await window.locator('#webview-knowledge').getAttribute('data-src')).toContain('localhost:3423');
});

test('switching to each dashboard view activates it', async () => {
  for (const view of ['comm', 'tasks', 'knowledge']) {
    await window.locator(`#sidebar .nav-btn[data-view="${view}"]`).click();
    await window.waitForTimeout(500);
    const isActive = await window.locator(`#view-${view}`).evaluate((el) => el.classList.contains('active'));
    expect(isActive).toBe(true);
  }

  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});

test('webview bridge API is available and functional', async () => {
  const result = await window.evaluate(async () => {
    const ad = (window as any).agentDesk;
    const path = await ad.webview.getPreloadPath();
    return {
      hasApi: !!(ad.webview.getPreloadPath && ad.webview.broadcastTerminalUpdate),
      path: path,
      hasOnUpdate: typeof ad.webview.onTerminalUpdate === 'function',
    };
  });

  expect(result.hasApi).toBe(true);
  expect(result.path).toBeTruthy();
  expect(typeof result.path).toBe('string');
  expect(result.hasOnUpdate).toBe(true);
});
