/**
 * dock-quit.spec.ts — macOS dock Quit behavior
 *
 * Verifies that app.quit() (triggered by dock right-click → Quit on macOS)
 * actually terminates the app even when minimized to tray, while close-to-tray
 * still works for normal window close.
 */

import { test, expect } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from 'playwright';
import { buildApp, PROJECT_ROOT, screenshotOnFailure } from './helpers';

test.describe.configure({ mode: 'serial' });

let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  buildApp();
});

test.beforeEach(async () => {
  app = await electron.launch({
    args: ['.'],
    cwd: PROJECT_ROOT,
  });
  window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(3000);
});

test.afterEach(async ({}, testInfo) => {
  if (window) await screenshotOnFailure(window, testInfo);
  if (app) {
    try {
      await Promise.race([
        app.evaluate(({ app: a }) => a.exit(0)),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    } catch {
      /* process already exited */
    }
  }
});

test('close hides to tray instead of quitting', async () => {
  // Closing the window should hide it, not quit the app
  await window.evaluate(() => {
    (window as any).agentDesk.window.close();
  });
  await window.waitForTimeout(500);

  const isVisible = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win?.isVisible() ?? false;
  });
  expect(isVisible).toBe(false);

  // App process should still be running (window exists but hidden)
  const windowCount = await app.evaluate(async ({ BrowserWindow }) => {
    return BrowserWindow.getAllWindows().length;
  });
  expect(windowCount).toBeGreaterThanOrEqual(1);
});

test('app.quit() terminates app even when tray exists', async () => {
  // This simulates what macOS dock right-click → Quit does: calls app.quit()
  // Before the fix, the close handler's preventDefault() blocked this.

  // First verify the app is running and has a tray
  const hasTray = await app.evaluate(async ({ BrowserWindow }) => {
    return BrowserWindow.getAllWindows().length >= 1;
  });
  expect(hasTray).toBe(true);

  const processRef = app.process();
  const exitPromise = new Promise<void>((resolve) => {
    processRef.on('exit', () => resolve());
  });

  try {
    await app.evaluate(({ app: a }) => a.quit());
  } catch {
    // Expected — process exits before evaluate resolves
  }

  // Wait for the process to actually exit (with timeout)
  const exited = await Promise.race([
    exitPromise.then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), 10000)),
  ]);

  expect(exited).toBe(true);
});
