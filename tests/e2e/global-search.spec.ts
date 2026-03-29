/**
 * global-search.spec.ts -- Cross-Terminal Global Search
 *
 * Tests the global search overlay: open, input, toggles,
 * status messages, dismissal, and no-duplicate behavior.
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

test('global search opens with focused input and toggle buttons', async () => {
  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.showGlobalSearch();
  });
  await window.waitForTimeout(300);

  await expect(window.locator('.global-search-overlay')).toBeAttached();

  const input = window.locator('.global-search-input');
  await expect(input).toBeVisible();
  expect(await input.getAttribute('placeholder')).toContain('Search all terminals');

  const isFocused = await window.evaluate(() => {
    return document.querySelector('.global-search-input') === document.activeElement;
  });
  expect(isFocused).toBe(true);

  await expect(window.locator('.global-search-toggle[title="Case Sensitive"]')).toBeAttached();
  await expect(window.locator('.global-search-toggle[title="Regex"]')).toBeAttached();
});

test('toggles activate on click', async () => {
  const caseBtn = window.locator('.global-search-toggle[title="Case Sensitive"]');
  await caseBtn.click();
  await window.waitForTimeout(100);
  expect(await caseBtn.evaluate((el) => el.classList.contains('active'))).toBe(true);
  await caseBtn.click();
  await window.waitForTimeout(100);

  const regexBtn = window.locator('.global-search-toggle[title="Regex"]');
  await regexBtn.click();
  await window.waitForTimeout(100);
  expect(await regexBtn.evaluate((el) => el.classList.contains('active'))).toBe(true);
  await regexBtn.click();
  await window.waitForTimeout(100);
});

test('status shows hint for short queries and no-match message', async () => {
  const input = window.locator('.global-search-input');
  await input.fill('a');
  await window.waitForTimeout(500);

  const status = window.locator('.global-search-status');
  expect(await status.textContent()).toContain('at least 2 characters');

  await input.fill('xyzzy_nonexistent_string_12345');
  await window.waitForTimeout(800);

  const text = await status.textContent();
  expect(text!.includes('No matches') || text!.includes('at least')).toBe(true);
});

test('Escape closes global search', async () => {
  await window.locator('.global-search-input').press('Escape');
  await window.waitForTimeout(300);
  expect(await window.locator('.global-search-overlay').count()).toBe(0);
});

test('clicking overlay background closes global search', async () => {
  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.showGlobalSearch();
  });
  await window.waitForTimeout(300);

  await window.locator('.global-search-overlay').click({ position: { x: 5, y: 5 } });
  await window.waitForTimeout(300);
  expect(await window.locator('.global-search-overlay').count()).toBe(0);
});

test('opening global search twice does not create duplicates', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    r.showGlobalSearch();
    r.showGlobalSearch();
  });
  await window.waitForTimeout(300);

  expect(await window.locator('.global-search-overlay').count()).toBe(1);

  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.hideGlobalSearch();
  });
  await window.waitForTimeout(200);
});
