/**
 * batch-launcher.spec.ts — Batch Agent Launcher
 *
 * Tests the batch launcher dialog (Ctrl+Shift+B), form inputs,
 * naming patterns, template save, and dialog dismissal.
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

// ── Dialog Open/Close ───────────────────────────────────────────────

test('batch launcher opens via registry', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showBatchLauncher) r.showBatchLauncher();
  });
  await window.waitForTimeout(300);

  const overlay = window.locator('.batch-launcher-overlay');
  await expect(overlay).toBeAttached();

  const modal = window.locator('.batch-launcher-modal');
  await expect(modal).toBeAttached();
});

test('batch launcher has header with title', async () => {
  const header = window.locator('.batch-launcher-header h2');
  await expect(header).toHaveText('Launch Agent Batch');
});

test('batch launcher has count input defaulting to 3', async () => {
  const countInput = window.locator('.batch-launcher-input[type="number"]').first();
  await expect(countInput).toBeVisible();
  const value = await countInput.inputValue();
  expect(value).toBe('3');
});

test('count input accepts values 1-20', async () => {
  const countInput = window.locator('.batch-launcher-input[type="number"]').first();
  const min = await countInput.getAttribute('min');
  const max = await countInput.getAttribute('max');
  expect(min).toBe('1');
  expect(max).toBe('20');
});

test('count input can be changed', async () => {
  const countInput = window.locator('.batch-launcher-input[type="number"]').first();
  await countInput.fill('5');
  const value = await countInput.inputValue();
  expect(value).toBe('5');
});

test('batch launcher has profile dropdown', async () => {
  const select = window.locator('.batch-launcher-select');
  await expect(select).toBeAttached();

  const options = await select.locator('option').count();
  expect(options).toBeGreaterThanOrEqual(1);
});

test('batch launcher has naming pattern input with default', async () => {
  const nameInput = window.locator('.batch-launcher-input[placeholder="agent-{n}"]');
  await expect(nameInput).toBeAttached();
  const value = await nameInput.inputValue();
  expect(value).toBe('agent-{n}');
});

test('naming pattern can be customized', async () => {
  const nameInput = window.locator('.batch-launcher-input[placeholder="agent-{n}"]');
  await nameInput.fill('worker-{n}');
  const value = await nameInput.inputValue();
  expect(value).toBe('worker-{n}');
});

test('batch launcher has stagger delay input', async () => {
  const delayInputs = window.locator('.batch-launcher-input[type="number"]');
  const count = await delayInputs.count();
  expect(count).toBeGreaterThanOrEqual(2);
});

// ── Buttons ─────────────────────────────────────────────────────────

test('batch launcher has Launch button', async () => {
  const launchBtn = window.locator('.batch-launcher-btn-primary');
  await expect(launchBtn).toBeVisible();
  await expect(launchBtn).toContainText('Launch');
});

test('batch launcher has Cancel button', async () => {
  const cancelBtn = window.locator('.batch-launcher-btn-secondary').filter({ hasText: 'Cancel' });
  await expect(cancelBtn).toBeVisible();
});

test('batch launcher has Save as Template button', async () => {
  const saveBtn = window.locator('.batch-launcher-btn-secondary').filter({ hasText: 'Save as Template' });
  await expect(saveBtn).toBeAttached();
});

// ── Dialog Dismissal ────────────────────────────────────────────────

test('Escape closes batch launcher', async () => {
  const modal = window.locator('.batch-launcher-modal');
  await modal.press('Escape');
  await window.waitForTimeout(300);

  const overlay = window.locator('.batch-launcher-overlay');
  const count = await overlay.count();
  expect(count).toBe(0);
});

test('Cancel button closes batch launcher', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showBatchLauncher) r.showBatchLauncher();
  });
  await window.waitForTimeout(300);

  const cancelBtn = window.locator('.batch-launcher-btn-secondary').filter({ hasText: 'Cancel' });
  await cancelBtn.click();
  await window.waitForTimeout(300);

  const overlay = window.locator('.batch-launcher-overlay');
  const count = await overlay.count();
  expect(count).toBe(0);
});

test('clicking overlay background closes batch launcher', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showBatchLauncher) r.showBatchLauncher();
  });
  await window.waitForTimeout(300);

  const overlay = window.locator('.batch-launcher-overlay');
  await overlay.click({ position: { x: 5, y: 5 } });
  await window.waitForTimeout(300);

  const count = await overlay.count();
  expect(count).toBe(0);
});

// ── Prefill ─────────────────────────────────────────────────────────

test('batch launcher accepts prefill options', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showBatchLauncher) {
      r.showBatchLauncher({ count: 7, namingPattern: 'dev-{n}' });
    }
  });
  await window.waitForTimeout(300);

  const countInput = window.locator('.batch-launcher-input[type="number"]').first();
  const value = await countInput.inputValue();
  expect(value).toBe('7');

  const nameInput = window.locator('.batch-launcher-input[placeholder="agent-{n}"]');
  const nameValue = await nameInput.inputValue();
  expect(nameValue).toBe('dev-{n}');

  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.hideBatchLauncher) r.hideBatchLauncher();
  });
  await window.waitForTimeout(200);
});

// ── No Duplicate Dialogs ────────────────────────────────────────────

test('opening batch launcher twice does not create duplicates', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showBatchLauncher) {
      r.showBatchLauncher();
      r.showBatchLauncher();
    }
  });
  await window.waitForTimeout(300);

  const overlays = await window.locator('.batch-launcher-overlay').count();
  expect(overlays).toBe(1);

  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.hideBatchLauncher) r.hideBatchLauncher();
  });
  await window.waitForTimeout(200);
});
