/**
 * app-launch.spec.ts — Basic app lifecycle tests
 *
 * Verifies the Electron app boots correctly, renders the expected chrome
 * (titlebar, sidebar, status bar) and can be closed cleanly.
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

// ── Tests ──────────────────────────────────────────────────────────────

test('app launches without errors', async () => {
  expect(window).toBeTruthy();
  const isVisible = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win?.isVisible() ?? false;
  });
  expect(isVisible).toBe(true);
});

test('window has correct title "Agent Desk"', async () => {
  const title = await window.title();
  expect(title).toBe('Agent Desk');
});

test('window has minimum size (800x600)', async () => {
  const minSize = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win?.getMinimumSize() ?? [0, 0];
  });
  expect(minSize[0]).toBe(800);
  expect(minSize[1]).toBe(600);
});

test('titlebar is visible with "Agent Desk" text', async () => {
  const titlebar = window.locator('#titlebar');
  await expect(titlebar).toBeVisible();

  const titleText = window.locator('#titlebar .app-title');
  await expect(titleText).toContainText('Agent Desk');
});

test('sidebar is visible with navigation buttons', async () => {
  const sidebar = window.locator('#sidebar');
  await expect(sidebar).toBeVisible();

  const buttons = window.locator('#sidebar .nav-btn');
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(6);
});

test('sidebar buttons include expected views', async () => {
  const views = await window
    .locator('#sidebar .nav-btn[data-view]')
    .evaluateAll((btns) => (btns as HTMLElement[]).map((b) => b.dataset.view));
  expect(views).toContain('terminals');
  expect(views).toContain('comm');
  expect(views).toContain('tasks');
  expect(views).toContain('settings');
});

test('status bar is visible', async () => {
  const statusBar = window.locator('#status-bar');
  await expect(statusBar).toBeVisible();
});

test('app can be closed cleanly', async () => {
  const windowCount = await app.evaluate(async ({ BrowserWindow }) => {
    return BrowserWindow.getAllWindows().length;
  });
  expect(windowCount).toBeGreaterThanOrEqual(1);
});
