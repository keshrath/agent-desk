/**
 * templates.spec.ts — Agent Templates
 *
 * Tests template CRUD, default templates, settings section rendering,
 * and command palette integration.
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

// ── Default Templates ───────────────────────────────────────────────

test('default templates are loaded from localStorage or defaults', async () => {
  const templates = await window.evaluate(() => {
    const raw = localStorage.getItem('agent-desk-templates');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  });

  if (templates) {
    expect(Array.isArray(templates)).toBe(true);
  }
});

test('getTemplateCommands returns command palette entries', async () => {
  const commands = (await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.getTemplateCommands) {
      return r.getTemplateCommands().map((c: any) => c.label);
    }
    return [];
  })) as string[];

  expect(Array.isArray(commands)).toBe(true);
  for (const cmd of commands) {
    expect(cmd).toMatch(/^Launch Template:/);
  }
});

test('default templates include Quick Review and Parallel Tasks', async () => {
  const commands = (await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.getTemplateCommands) {
      return r.getTemplateCommands().map((c: any) => c.label);
    }
    return [];
  })) as string[];

  const hasQuickReview = commands.some((c) => c.includes('Quick Review'));
  const hasParallelTasks = commands.some((c) => c.includes('Parallel Tasks'));

  expect(hasQuickReview).toBe(true);
  expect(hasParallelTasks).toBe(true);
});

// ── Templates Settings Section ──────────────────────────────────────

test('templates section exists in settings', async () => {
  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const section = window.locator('#settings-panel .settings-section').filter({ hasText: 'Templates' });
  await expect(section).toBeAttached();
});

test('templates section shows template rows', async () => {
  const rows = window.locator('#settings-panel .template-row');
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(2);
});

test('template rows show name and description', async () => {
  const firstRow = window.locator('#settings-panel .template-row').first();
  const name = firstRow.locator('.template-name');
  await expect(name).toBeAttached();
  const nameText = await name.textContent();
  expect(nameText!.length).toBeGreaterThan(0);
});

test('template rows have edit and launch buttons', async () => {
  const firstRow = window.locator('#settings-panel .template-row').first();
  const editBtn = firstRow.locator('button[title="Edit"]');
  await expect(editBtn).toBeAttached();

  const launchBtn = firstRow.locator('button[title="Launch template"]');
  await expect(launchBtn).toBeAttached();
});

test('builtin templates do not have delete button', async () => {
  const builtinRow = window.locator('#settings-panel .template-row').first();
  const deleteBtn = builtinRow.locator('button[title="Delete"]');
  const count = await deleteBtn.count();
  expect(count).toBe(0);
});

test('Create Template button exists', async () => {
  const addBtn = window.locator('#settings-panel .template-btn-add');
  await expect(addBtn).toBeAttached();
  await expect(addBtn).toContainText('Create Template');
});

// ── Template Save Dialog ────────────────────────────────────────────

test('template save dialog opens from registry', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showTemplateSaveDialog) {
      r.showTemplateSaveDialog({ count: 3, namingPattern: 'test-{n}', profileId: 'claude' });
    }
  });
  await window.waitForTimeout(300);

  const overlay = window.locator('.template-save-overlay');
  await expect(overlay).toBeAttached();

  const header = window.locator('.template-save-header');
  await expect(header).toHaveText('Save as Template');
});

test('template save dialog has name and description inputs', async () => {
  const inputs = window.locator('.template-save-modal .template-field-input');
  const count = await inputs.count();
  expect(count).toBeGreaterThanOrEqual(2);
});

test('template save dialog closes on Cancel', async () => {
  const cancelBtn = window.locator('.template-save-modal .batch-launcher-btn-secondary').filter({ hasText: 'Cancel' });
  await cancelBtn.click();
  await window.waitForTimeout(300);

  const overlay = window.locator('.template-save-overlay');
  const count = await overlay.count();
  expect(count).toBe(0);
});

// ── Cleanup ─────────────────────────────────────────────────────────

test('switch back to terminals view after template tests', async () => {
  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});
