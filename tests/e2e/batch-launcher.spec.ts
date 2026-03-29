/**
 * batch-launcher.spec.ts -- Batch Agent Launcher
 *
 * Tests the batch launcher dialog: open, form interaction,
 * prefill, dismissal, and no-duplicate behavior.
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

test('batch launcher opens with correct form fields', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showBatchLauncher) r.showBatchLauncher();
  });
  await window.waitForTimeout(300);

  await expect(window.locator('.batch-launcher-overlay')).toBeAttached();
  await expect(window.locator('.batch-launcher-header h2')).toHaveText('Launch Agent Batch');

  const countInput = window.locator('.batch-launcher-input[type="number"]').first();
  expect(await countInput.inputValue()).toBe('3');
  expect(await countInput.getAttribute('min')).toBe('1');
  expect(await countInput.getAttribute('max')).toBe('20');

  await expect(window.locator('.batch-launcher-select')).toBeAttached();

  const nameInput = window.locator('.batch-launcher-input[placeholder="agent-{n}"]');
  expect(await nameInput.inputValue()).toBe('agent-{n}');

  await expect(window.locator('.batch-launcher-btn-primary')).toContainText('Launch');
});

test('batch launcher form inputs are editable', async () => {
  const countInput = window.locator('.batch-launcher-input[type="number"]').first();
  await countInput.fill('5');
  expect(await countInput.inputValue()).toBe('5');

  const nameInput = window.locator('.batch-launcher-input[placeholder="agent-{n}"]');
  await nameInput.fill('worker-{n}');
  expect(await nameInput.inputValue()).toBe('worker-{n}');
});

test('Escape closes batch launcher', async () => {
  await window.locator('.batch-launcher-modal').press('Escape');
  await window.waitForTimeout(300);
  expect(await window.locator('.batch-launcher-overlay').count()).toBe(0);
});

test('Cancel button closes batch launcher', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showBatchLauncher) r.showBatchLauncher();
  });
  await window.waitForTimeout(300);

  await window.locator('.batch-launcher-btn-secondary').filter({ hasText: 'Cancel' }).click();
  await window.waitForTimeout(300);
  expect(await window.locator('.batch-launcher-overlay').count()).toBe(0);
});

test('clicking overlay background closes batch launcher', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showBatchLauncher) r.showBatchLauncher();
  });
  await window.waitForTimeout(300);

  await window.locator('.batch-launcher-overlay').click({ position: { x: 5, y: 5 } });
  await window.waitForTimeout(300);
  expect(await window.locator('.batch-launcher-overlay').count()).toBe(0);
});

test('batch launcher accepts prefill options', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showBatchLauncher) r.showBatchLauncher({ count: 7, namingPattern: 'dev-{n}' });
  });
  await window.waitForTimeout(300);

  expect(await window.locator('.batch-launcher-input[type="number"]').first().inputValue()).toBe('7');
  expect(await window.locator('.batch-launcher-input[placeholder="agent-{n}"]').inputValue()).toBe('dev-{n}');

  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.hideBatchLauncher) r.hideBatchLauncher();
  });
  await window.waitForTimeout(200);
});

test('opening batch launcher twice does not create duplicates', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showBatchLauncher) {
      r.showBatchLauncher();
      r.showBatchLauncher();
    }
  });
  await window.waitForTimeout(300);

  expect(await window.locator('.batch-launcher-overlay').count()).toBe(1);

  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.hideBatchLauncher) r.hideBatchLauncher();
  });
  await window.waitForTimeout(200);
});
