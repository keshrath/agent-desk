/**
 * window-controls.spec.ts — Window management tests
 *
 * Tests window minimize / maximize / close behavior via IPC (the app
 * uses titleBarOverlay so native buttons handle the clicks, but the
 * IPC handlers are the same).
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

test('window controls buttons exist in the DOM', async () => {
  const minimizeExists = await window.locator('#btn-minimize').count();
  const maximizeExists = await window.locator('#btn-maximize').count();
  const closeExists = await window.locator('#btn-close').count();

  expect(minimizeExists).toBe(1);
  expect(maximizeExists).toBe(1);
  expect(closeExists).toBe(1);
});

test('close button has "close" class for styling', async () => {
  await expect(window.locator('#btn-close')).toHaveClass(/close/);
});

test('minimize via IPC minimizes window', async () => {
  await window.evaluate(() => {
    (window as any).agentDesk.window.minimize();
  });
  await window.waitForTimeout(500);

  const isMinimized = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win?.isMinimized() ?? false;
  });
  expect(isMinimized).toBe(true);

  await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.restore();
  });
  await window.waitForTimeout(500);
});

test('maximize via IPC maximizes window', async () => {
  const wasMaximized = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win?.isMaximized() ?? false;
  });

  await window.evaluate(() => {
    (window as any).agentDesk.window.maximize();
  });
  await window.waitForTimeout(500);

  const isMaximized = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win?.isMaximized() ?? false;
  });

  expect(isMaximized).toBe(!wasMaximized);
});

test('maximize via IPC restores window when already maximized', async () => {
  await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win?.isMaximized()) win?.maximize();
  });
  await window.waitForTimeout(300);

  await window.evaluate(() => {
    (window as any).agentDesk.window.maximize();
  });
  await window.waitForTimeout(500);

  const isMaximized = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win?.isMaximized() ?? false;
  });
  expect(isMaximized).toBe(false);
});

test('close via IPC hides to tray (does not quit)', async () => {
  await window.evaluate(() => {
    (window as any).agentDesk.window.close();
  });
  await window.waitForTimeout(500);

  const windowCount = await app.evaluate(async ({ BrowserWindow }) => {
    return BrowserWindow.getAllWindows().length;
  });
  expect(windowCount).toBeGreaterThanOrEqual(1);

  const isVisible = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win?.isVisible() ?? false;
  });
  expect(isVisible).toBe(false);

  await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.show();
  });
  await window.waitForTimeout(500);
});
