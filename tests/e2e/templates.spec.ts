/**
 * templates.spec.ts -- Agent Templates
 *
 * Tests default templates, command palette integration,
 * settings section rendering, and template save dialog.
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

test('default templates include Quick Review and Parallel Tasks in command palette', async () => {
  const commands = (await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    return r?.getTemplateCommands ? r.getTemplateCommands().map((c: any) => c.label) : [];
  })) as string[];

  expect(commands.some((c) => c.includes('Quick Review'))).toBe(true);
  expect(commands.some((c) => c.includes('Parallel Tasks'))).toBe(true);
  for (const cmd of commands) {
    expect(cmd).toMatch(/^Launch Template:/);
  }
});

test('templates section in settings shows rows with edit/launch buttons', async () => {
  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const section = window.locator('#settings-panel .settings-section').filter({ hasText: 'Templates' });
  await expect(section).toBeAttached();

  const rows = window.locator('#settings-panel .template-row');
  expect(await rows.count()).toBeGreaterThanOrEqual(2);

  const firstRow = rows.first();
  await expect(firstRow.locator('.template-name')).toBeAttached();
  await expect(firstRow.locator('button[title="Edit"]')).toBeAttached();
  await expect(firstRow.locator('button[title="Launch template"]')).toBeAttached();

  expect(await firstRow.locator('button[title="Delete"]').count()).toBe(0);

  await expect(window.locator('#settings-panel .template-btn-add')).toContainText('Create Template');
});

test('template save dialog opens and closes', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r?.showTemplateSaveDialog) {
      r.showTemplateSaveDialog({ count: 3, namingPattern: 'test-{n}', profileId: 'claude' });
    }
  });
  await window.waitForTimeout(300);

  await expect(window.locator('.template-save-overlay')).toBeAttached();
  await expect(window.locator('.template-save-header')).toHaveText('Save as Template');

  const inputs = window.locator('.template-save-modal .template-field-input');
  expect(await inputs.count()).toBeGreaterThanOrEqual(2);

  await window.locator('.template-save-modal .batch-launcher-btn-secondary').filter({ hasText: 'Cancel' }).click();
  await window.waitForTimeout(300);
  expect(await window.locator('.template-save-overlay').count()).toBe(0);

  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});
