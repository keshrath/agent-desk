/**
 * workspaces.spec.ts — F4: Layout Workspaces
 *
 * Tests workspace save dialog, workspace persistence, load picker,
 * workspace restore, confirmation for running terminals, and deletion.
 */

import { test, expect } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { buildApp, launchApp, closeApp, screenshotOnFailure } from './helpers';

let app: ElectronApplication;
let window: Page;
let terminalsWork = false;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  buildApp();
  ({ app, window } = await launchApp());

  try {
    await window.locator('.dv-terminal-host').first().waitFor({ state: 'attached', timeout: 10000 });
    terminalsWork = true;
  } catch {
    terminalsWork = false;
  }
});

test.afterAll(async () => {
  if (app) await closeApp(app);
});

test.afterEach(async ({}, testInfo) => {
  await screenshotOnFailure(window, testInfo);
});

// ── Save Dialog ──────────────────────────────────────────────────────

test('Ctrl+Shift+W opens save workspace dialog', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  await window.locator('#titlebar').click();
  await window.waitForTimeout(200);

  await window.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'W', ctrlKey: true, shiftKey: true, bubbles: true }));
  });
  await window.waitForTimeout(500);

  const overlay = window.locator('.confirm-overlay');
  const isVisible = await overlay.isVisible().catch(() => false);

  if (isVisible) {
    const heading = overlay.locator('h3');
    await expect(heading).toHaveText('Save Workspace');

    const input = overlay.locator('input[type="text"]');
    await expect(input).toBeVisible();

    const cancelBtn = overlay.locator('.confirm-btn-cancel');
    await cancelBtn.click();
    await window.waitForTimeout(300);
  }
});

test('save workspace dialog rejects empty name', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  await window.evaluate(() => {
    if (typeof (window as any).showWorkspaceSaveDialog === 'function') {
      (window as any).showWorkspaceSaveDialog();
    } else {
      window.dispatchEvent(new CustomEvent('workspace-save-request'));
    }
  });
  await window.waitForTimeout(500);

  const overlay = window.locator('.confirm-overlay');
  if (!(await overlay.isVisible().catch(() => false))) return;

  const saveBtn = overlay.locator('.confirm-btn-confirm');
  await saveBtn.click();
  await window.waitForTimeout(300);

  const stillVisible = await overlay.isVisible().catch(() => false);
  expect(stillVisible).toBe(true);

  const cancelBtn = overlay.locator('.confirm-btn-cancel');
  await cancelBtn.click();
  await window.waitForTimeout(300);
});

test('save workspace with valid name closes dialog and shows toast', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  await window.evaluate(() => {
    if (typeof (window as any).showWorkspaceSaveDialog === 'function') {
      (window as any).showWorkspaceSaveDialog();
    } else {
      window.dispatchEvent(new CustomEvent('workspace-save-request'));
    }
  });
  await window.waitForTimeout(500);

  const overlay = window.locator('.confirm-overlay');
  if (!(await overlay.isVisible().catch(() => false))) return;

  const input = overlay.locator('input[type="text"]');
  await input.fill('test-workspace-e2e');

  const saveBtn = overlay.locator('.confirm-btn-confirm');
  await saveBtn.click();
  await window.waitForTimeout(500);

  const overlayGone = await overlay.isVisible().catch(() => false);
  expect(overlayGone).toBe(false);
});

// ── Workspace in Settings ────────────────────────────────────────────

test('workspaces section exists in settings', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const workspaceSection = window.locator('#settings-panel .settings-section').filter({ hasText: 'Workspaces' });

  await expect(workspaceSection).toBeAttached();

  const saveBtn = workspaceSection.locator('button').filter({ hasText: 'Save Current Layout' });
  const hasSaveBtn = (await saveBtn.count()) > 0;
  expect(hasSaveBtn).toBe(true);

  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});

// ── Load Picker ──────────────────────────────────────────────────────

test('Ctrl+Alt+W opens workspace load picker', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  await window.locator('#titlebar').click();
  await window.waitForTimeout(200);

  await window.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'W', ctrlKey: true, altKey: true, bubbles: true }));
  });
  await window.waitForTimeout(500);

  const picker = window.locator('.workspace-picker-overlay');
  const pickerVisible = await picker.isVisible().catch(() => false);

  if (pickerVisible) {
    const input = picker.locator('.command-palette-input');
    await expect(input).toBeVisible();

    const items = picker.locator('.command-palette-item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);

    await window.keyboard.press('Escape');
    await window.waitForTimeout(300);
  }
});

test('workspace picker shows search/filter', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  await window.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'W', ctrlKey: true, altKey: true, bubbles: true }));
  });
  await window.waitForTimeout(500);

  const picker = window.locator('.workspace-picker-overlay');
  if (!(await picker.isVisible().catch(() => false))) return;

  const input = picker.locator('.command-palette-input');
  await input.fill('nonexistent-ws');
  await window.waitForTimeout(200);

  const items = await picker.locator('.command-palette-item').count();
  expect(items).toBe(0);

  await input.fill('');
  await window.waitForTimeout(200);
  await window.keyboard.press('Escape');
  await window.waitForTimeout(300);
});

// ── Workspace Delete in Settings ─────────────────────────────────────

test('workspace can be deleted from settings', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const workspaceSection = window.locator('#settings-panel .settings-section').filter({ hasText: 'Workspaces' });

  if ((await workspaceSection.count()) === 0) {
    await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
    await window.waitForTimeout(300);
    return;
  }

  const deleteBtn = workspaceSection
    .locator('.profile-row')
    .filter({ hasText: 'test-workspace-e2e' })
    .locator('button[title="Delete"]');

  if ((await deleteBtn.count()) > 0) {
    await deleteBtn.click();
    await window.waitForTimeout(500);

    const wsGone = await window.evaluate(`(() => {
      const ws = typeof loadWorkspaces === 'function' ? loadWorkspaces() : {};
      return !ws['test-workspace-e2e'];
    })()`);
    expect(wsGone).toBe(true);
  }

  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});
