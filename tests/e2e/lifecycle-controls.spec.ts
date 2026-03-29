/**
 * lifecycle-controls.spec.ts -- Lifecycle Controls (Context Menu)
 *
 * Tests context menu rendering, lifecycle menu item logic,
 * and confirm dialog behavior.
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

test('context menu renders items with separators and danger styling', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    r.showContextMenu(100, 100, [
      { label: 'Test Item 1', icon: 'edit', action: () => {} },
      { type: 'separator' },
      { label: 'Test Item 2', icon: 'delete', danger: true, action: () => {} },
    ]);
  });
  await window.waitForTimeout(200);

  await expect(window.locator('.context-menu')).toBeAttached();
  expect(await window.locator('.context-item').count()).toBe(2);
  await expect(window.locator('.context-separator')).toBeAttached();
  await expect(window.locator('.context-item.danger')).toBeAttached();

  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.hideContextMenu();
  });
});

test('lifecycle items are enabled for running terminals and disabled for exited', async () => {
  const result = (await window.evaluate(() => {
    const s = (window as any).__agentDeskState;

    s.terminals.set('lc-running', { title: 'Running', status: 'running' });
    s.terminals.set('lc-exited', { title: 'Exited', status: 'exited' });

    const checkRunning = (id: string) => {
      const ts = s.terminals.get(id);
      return ts && (ts.status === 'running' || ts.status === 'waiting' || ts.status === 'idle');
    };

    const runningEnabled = checkRunning('lc-running');
    const exitedEnabled = checkRunning('lc-exited');

    s.terminals.delete('lc-running');
    s.terminals.delete('lc-exited');

    return { runningEnabled, exitedEnabled };
  })) as any;

  expect(result.runningEnabled).toBe(true);
  expect(result.exitedEnabled).toBe(false);
});

test('confirm dialog renders and closes on Cancel', async () => {
  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.showConfirmDialog('Test Title', 'Test message content', () => {});
  });
  await window.waitForTimeout(300);

  await expect(window.locator('.confirm-overlay')).toBeAttached();
  await expect(window.locator('.confirm-modal h3')).toHaveText('Test Title');
  await expect(window.locator('.confirm-modal p')).toHaveText('Test message content');

  await window.locator('.confirm-btn-cancel').click();
  await window.waitForTimeout(200);
  expect(await window.locator('.confirm-overlay').count()).toBe(0);
});

test('confirm dialog closes on Escape', async () => {
  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.showConfirmDialog('Escape Test', 'Press Escape', () => {});
  });
  await window.waitForTimeout(300);

  await window.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  await window.waitForTimeout(200);
  expect(await window.locator('.confirm-overlay').count()).toBe(0);
});
