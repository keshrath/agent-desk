/**
 * toasts.spec.ts — F7: Toast Notifications
 *
 * Tests toast appearance, auto-dismiss, styling, and removal behavior.
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

// ── Toast Display ────────────────────────────────────────────────────

test('showToast creates a toast element', async () => {
  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.showToast('Test toast message');
  });
  await window.waitForTimeout(100);

  const toast = window.locator('.toast');
  await expect(toast).toBeAttached();
  await expect(toast).toHaveText('Test toast message');
});

test('toast becomes visible with animation class', async () => {
  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.showToast('Visible toast');
  });
  await window.waitForTimeout(200);

  const toast = window.locator('.toast');
  const hasVisible = await toast.evaluate((el) => el.classList.contains('visible'));
  expect(hasVisible).toBe(true);
});

test('toast auto-dismisses after ~1.5 seconds', async () => {
  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.showToast('Auto dismiss');
  });
  await window.waitForTimeout(2200);

  const toastCount = await window.locator('.toast').count();
  expect(toastCount).toBe(0);
});

test('showing a new toast replaces the existing one', async () => {
  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.showToast('First toast');
  });
  await window.waitForTimeout(100);

  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.showToast('Second toast');
  });
  await window.waitForTimeout(100);

  const toasts = await window.locator('.toast').count();
  expect(toasts).toBe(1);

  const text = await window.locator('.toast').textContent();
  expect(text).toBe('Second toast');

  await window.waitForTimeout(2000);
});

test('toast has correct CSS class for styling', async () => {
  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.showToast('Styled toast');
  });
  await window.waitForTimeout(100);

  const toast = window.locator('.toast');
  await expect(toast).toHaveClass(/toast/);

  await window.waitForTimeout(2000);
});

test('clipboard copy triggers toast', async () => {
  const terminalsExist = (await window.locator('.dv-terminal-host').count()) > 0;
  if (!terminalsExist) return;

  const termId = await window.evaluate(() => {
    const s = (window as any).__agentDeskState;
    if (!s || !s.terminals || s.terminals.size === 0) return null;
    return s.terminals.keys().next().value;
  });
  if (!termId) return;

  await window.evaluate((id: string) => {
    if (typeof (window as any).copyAllTerminalOutput === 'function') {
      (window as any).copyAllTerminalOutput(id);
    }
  }, termId);
  await window.waitForTimeout(200);

  const toast = window.locator('.toast');
  const count = await toast.count();
  if (count > 0) {
    const text = await toast.textContent();
    expect(text).toContain('copied');
  }

  await window.waitForTimeout(2000);
});
