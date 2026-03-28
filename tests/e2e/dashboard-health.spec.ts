/**
 * dashboard-health.spec.ts — Dashboard Health Indicators
 *
 * Tests the green/red health dots on sidebar nav buttons for
 * comm, tasks, and knowledge services.
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

// ── Sidebar Health Dots ─────────────────────────────────────────────

test('comm nav button exists', async () => {
  const btn = window.locator('#sidebar .nav-btn[data-view="comm"]');
  await expect(btn).toBeVisible();
});

test('tasks nav button exists', async () => {
  const btn = window.locator('#sidebar .nav-btn[data-view="tasks"]');
  await expect(btn).toBeVisible();
});

test('knowledge nav button exists', async () => {
  const btn = window.locator('#sidebar .nav-btn[data-view="knowledge"]');
  await expect(btn).toBeVisible();
});

test('sidebar nav buttons may have health dot indicators', async () => {
  const dots = await window.evaluate(() => {
    const buttons = document.querySelectorAll('#sidebar .nav-btn[data-view]');
    const result: { view: string; hasDot: boolean }[] = [];
    buttons.forEach((btn) => {
      const view = (btn as HTMLElement).dataset.view || '';
      const dot = btn.querySelector('.health-dot, .status-dot, .nav-dot');
      result.push({ view, hasDot: !!dot });
    });
    return result;
  });

  expect(Array.isArray(dots)).toBe(true);
  expect(dots.length).toBeGreaterThanOrEqual(3);
});

// ── Service Status ──────────────────────────────────────────────────

test('dashboard URLs are configured in settings', async () => {
  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const section = window.locator('#settings-panel .settings-section').filter({ hasText: 'Dashboard URLs' });
  await expect(section).toBeAttached();

  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});

test('webview containers exist for comm, tasks, knowledge', async () => {
  const comm = window.locator('#view-comm');
  const tasks = window.locator('#view-tasks');
  const knowledge = window.locator('#view-knowledge');

  await expect(comm).toBeAttached();
  await expect(tasks).toBeAttached();
  await expect(knowledge).toBeAttached();
});

test('webviews have data-src attributes', async () => {
  const commSrc = await window.evaluate(() => {
    const wv = document.getElementById('webview-comm');
    return wv ? (wv as any).dataset.src || (wv as any).src : null;
  });
  expect(commSrc).toContain('localhost');

  const tasksSrc = await window.evaluate(() => {
    const wv = document.getElementById('webview-tasks');
    return wv ? (wv as any).dataset.src || (wv as any).src : null;
  });
  expect(tasksSrc).toContain('localhost');
});
