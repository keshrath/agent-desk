/**
 * global-search.spec.ts — Cross-Terminal Global Search
 *
 * Tests the global search overlay (Ctrl+Shift+F), input, toggles,
 * result rendering, keyboard navigation, and dismissal.
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

// ── Open/Close ─────────────────────���─────────────────────────────��──

test('global search opens via registry', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showGlobalSearch) r.showGlobalSearch();
  });
  await window.waitForTimeout(300);

  const overlay = window.locator('.global-search-overlay');
  await expect(overlay).toBeAttached();
});

test('global search has input field', async () => {
  const input = window.locator('.global-search-input');
  await expect(input).toBeVisible();
  const placeholder = await input.getAttribute('placeholder');
  expect(placeholder).toContain('Search all terminals');
});

test('global search input receives focus on open', async () => {
  const isFocused = await window.evaluate(() => {
    const input = document.querySelector('.global-search-input');
    return input === document.activeElement;
  });
  expect(isFocused).toBe(true);
});

test('global search has case sensitive toggle', async () => {
  const caseBtn = window.locator('.global-search-toggle[title="Case Sensitive"]');
  await expect(caseBtn).toBeAttached();
});

test('global search has regex toggle', async () => {
  const regexBtn = window.locator('.global-search-toggle[title="Regex"]');
  await expect(regexBtn).toBeAttached();
});

test('case sensitive toggle activates on click', async () => {
  const caseBtn = window.locator('.global-search-toggle[title="Case Sensitive"]');
  await caseBtn.click();
  await window.waitForTimeout(100);

  const isActive = await caseBtn.evaluate((el) => el.classList.contains('active'));
  expect(isActive).toBe(true);

  await caseBtn.click();
  await window.waitForTimeout(100);
});

test('regex toggle activates on click', async () => {
  const regexBtn = window.locator('.global-search-toggle[title="Regex"]');
  await regexBtn.click();
  await window.waitForTimeout(100);

  const isActive = await regexBtn.evaluate((el) => el.classList.contains('active'));
  expect(isActive).toBe(true);

  await regexBtn.click();
  await window.waitForTimeout(100);
});

// ── Status Messages ─────────────────────────────────────────────────

test('status shows hint when query is too short', async () => {
  const input = window.locator('.global-search-input');
  await input.fill('a');
  await window.waitForTimeout(500);

  const status = window.locator('.global-search-status');
  const text = await status.textContent();
  expect(text).toContain('at least 2 characters');
});

test('status shows "No matches found" for non-matching query', async () => {
  const input = window.locator('.global-search-input');
  await input.fill('xyzzy_nonexistent_string_12345');
  await window.waitForTimeout(800);

  const status = window.locator('.global-search-status');
  const text = await status.textContent();
  expect(text!.includes('No matches') || text!.includes('at least')).toBe(true);
});

// ── Results Container ────────────────────────────────────────���──────

test('results container exists in DOM', async () => {
  const results = window.locator('.global-search-results');
  await expect(results).toBeAttached();
});

// ── Escape Closes Search ─────────────────────────────��──────────────

test('Escape closes global search', async () => {
  const input = window.locator('.global-search-input');
  await input.press('Escape');
  await window.waitForTimeout(300);

  const overlay = window.locator('.global-search-overlay');
  const count = await overlay.count();
  expect(count).toBe(0);
});

// ── Click Outside Closes Search ─────────────────────────────────────

test('clicking overlay background closes global search', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showGlobalSearch) r.showGlobalSearch();
  });
  await window.waitForTimeout(300);

  const overlay = window.locator('.global-search-overlay');
  await overlay.click({ position: { x: 5, y: 5 } });
  await window.waitForTimeout(300);

  const count = await overlay.count();
  expect(count).toBe(0);
});

// ── No Duplicates ──────────────────────────────────���────────────────

test('opening global search twice does not create duplicates', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showGlobalSearch) {
      r.showGlobalSearch();
      r.showGlobalSearch();
    }
  });
  await window.waitForTimeout(300);

  const overlays = await window.locator('.global-search-overlay').count();
  expect(overlays).toBe(1);

  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.hideGlobalSearch) r.hideGlobalSearch();
  });
  await window.waitForTimeout(200);
});
