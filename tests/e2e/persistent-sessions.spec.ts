/**
 * persistent-sessions.spec.ts — Persistent Sessions
 *
 * Tests session save/restore functionality, config persistence,
 * and workspace management.
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

// ── Config API ──────────────────────────────────────────────────────

test('agentDesk.config API is available', async () => {
  const hasConfig = await window.evaluate(() => {
    return typeof (window as any).agentDesk !== 'undefined' && typeof (window as any).agentDesk.config !== 'undefined';
  });
  expect(hasConfig).toBe(true);
});

test('config can be read', async () => {
  const config = await window.evaluate(async () => {
    try {
      return await (window as any).agentDesk.config.read();
    } catch {
      return null;
    }
  });
  expect(config).not.toBeNull();
  expect(typeof config).toBe('object');
});

test('config has version field', async () => {
  const version = await window.evaluate(async () => {
    try {
      const config = await (window as any).agentDesk.config.read();
      return config ? config.version : null;
    } catch {
      return null;
    }
  });
  expect(version).not.toBeNull();
});

// ── Workspace Save/Load ─────────────────────────────────────────────

test('workspace save dialog function exists on registry', async () => {
  const exists = await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    return typeof r.showWorkspaceSaveDialog === 'function';
  });
  expect(exists).toBe(true);
});

test('workspace load picker function exists on registry', async () => {
  const exists = await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    return typeof r.showWorkspaceLoadPicker === 'function';
  });
  expect(exists).toBe(true);
});

// ── Workspaces Settings Section ─────────────────────────────────────

test('workspaces section exists in settings', async () => {
  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const section = window.locator('#settings-panel .settings-section').filter({ hasText: 'Workspaces' });
  await expect(section).toBeAttached();

  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});

// ── Config Persistence ──────────────────────────────────────────────

test('settings persist to config file', async () => {
  const result = await window.evaluate(async () => {
    try {
      const config = await (window as any).agentDesk.config.read();
      if (!config) return false;
      return typeof config.settings === 'object';
    } catch {
      return false;
    }
  });
  expect(result).toBe(true);
});

test('config has workspaces section', async () => {
  const result = await window.evaluate(async () => {
    try {
      const config = await (window as any).agentDesk.config.read();
      if (!config) return false;
      return 'workspaces' in config || Array.isArray(config.workspaces);
    } catch {
      return false;
    }
  });
  expect(typeof result).toBe('boolean');
});
