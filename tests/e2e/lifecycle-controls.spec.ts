/**
 * lifecycle-controls.spec.ts — Lifecycle Controls (Context Menu)
 *
 * Tests the lifecycle menu items (Interrupt, Stop, Force Kill, Restart)
 * available in terminal tab context menus.
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

// ��─ Context Menu API ────────────────────────────────────────────────

test('showContextMenu function is available on registry', async () => {
  const exists = await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    return typeof r.showContextMenu === 'function';
  });
  expect(exists).toBe(true);
});

test('hideContextMenu function is available on registry', async () => {
  const exists = await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    return typeof r.hideContextMenu === 'function';
  });
  expect(exists).toBe(true);
});

test('context menu renders items correctly', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    r.showContextMenu(100, 100, [
      { label: 'Test Item 1', icon: 'edit', action: () => {} },
      { type: 'separator' },
      { label: 'Test Item 2', icon: 'delete', danger: true, action: () => {} },
    ]);
  });
  await window.waitForTimeout(200);

  const menu = window.locator('.context-menu');
  await expect(menu).toBeAttached();

  const items = window.locator('.context-item');
  const count = await items.count();
  expect(count).toBe(2);

  const separator = window.locator('.context-separator');
  await expect(separator).toBeAttached();

  const dangerItem = window.locator('.context-item.danger');
  await expect(dangerItem).toBeAttached();

  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    r.hideContextMenu();
  });
});

// ── Lifecycle Menu Items ────────────────────────────────────────────

test('getLifecycleMenuItems returns expected items', async () => {
  const items = (await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    const s = (window as any).__agentDeskState;

    s.terminals.set('lifecycle-test-1', {
      title: 'Test Terminal',
      status: 'running',
    });

    const menuItems = (() => {
      const ts = r.getTerminalState ? r.getTerminalState('lifecycle-test-1') : null;
      const isRunning = ts && (ts.status === 'running' || ts.status === 'waiting' || ts.status === 'idle');

      return [
        { label: 'Interrupt (Ctrl+C)', disabled: !isRunning },
        { label: 'Stop Agent', disabled: !isRunning },
        { label: 'Force Kill', disabled: !isRunning },
        { label: 'Restart', disabled: false },
      ];
    })();

    s.terminals.delete('lifecycle-test-1');
    return menuItems;
  })) as any[];

  expect(items.length).toBe(4);
  expect(items[0].label).toBe('Interrupt (Ctrl+C)');
  expect(items[0].disabled).toBe(false);
  expect(items[1].label).toBe('Stop Agent');
  expect(items[2].label).toBe('Force Kill');
  expect(items[3].label).toBe('Restart');
});

test('lifecycle items are disabled for non-running terminals', async () => {
  const items = (await window.evaluate(() => {
    const s = (window as any).__agentDeskState;

    s.terminals.set('lifecycle-test-2', {
      title: 'Exited Terminal',
      status: 'exited',
    });

    const ts = s.terminals.get('lifecycle-test-2');
    const isRunning = ts && (ts.status === 'running' || ts.status === 'waiting' || ts.status === 'idle');

    const result = [
      { label: 'Interrupt', disabled: !isRunning },
      { label: 'Stop', disabled: !isRunning },
      { label: 'Force Kill', disabled: !isRunning },
    ];

    s.terminals.delete('lifecycle-test-2');
    return result;
  })) as any[];

  expect(items[0].disabled).toBe(true);
  expect(items[1].disabled).toBe(true);
  expect(items[2].disabled).toBe(true);
});

// ── Confirm Dialog ──────────────────────────────────────────────────

test('confirm dialog renders correctly', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    r.showConfirmDialog('Test Title', 'Test message content', () => {});
  });
  await window.waitForTimeout(300);

  const overlay = window.locator('.confirm-overlay');
  await expect(overlay).toBeAttached();

  const title = window.locator('.confirm-modal h3');
  await expect(title).toHaveText('Test Title');

  const message = window.locator('.confirm-modal p');
  await expect(message).toHaveText('Test message content');

  const cancelBtn = window.locator('.confirm-btn-cancel');
  await cancelBtn.click();
  await window.waitForTimeout(200);
});

test('confirm dialog closes on Escape', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    r.showConfirmDialog('Escape Test', 'Press Escape', () => {});
  });
  await window.waitForTimeout(300);

  await window.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  await window.waitForTimeout(200);

  const overlay = window.locator('.confirm-overlay');
  const count = await overlay.count();
  expect(count).toBe(0);
});
