/**
 * command-history.spec.ts -- Command History
 *
 * Tests the command history IPC API: get, clear, search, and callback.
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

test('history API is available and returns arrays', async () => {
  const result = await window.evaluate(async () => {
    const ad = (window as any).agentDesk;
    if (!ad?.history?.get) return null;
    const entries = await ad.history.get();
    const limited = await ad.history.get(5);
    const searched = await ad.history.get(100, 'nonexistent-search-xyz');
    return {
      isArray: Array.isArray(entries),
      limitedCount: limited.length,
      searchedIsArray: Array.isArray(searched),
      hasOnNew: typeof ad.history.onNew === 'function',
    };
  });

  expect(result).not.toBeNull();
  expect(result!.isArray).toBe(true);
  expect(result!.limitedCount).toBeLessThanOrEqual(5);
  expect(result!.searchedIsArray).toBe(true);
  expect(result!.hasOnNew).toBe(true);
});

test('history.clear empties the history', async () => {
  await window.evaluate(async () => {
    await (window as any).agentDesk.history.clear();
  });

  const entries = await window.evaluate(async () => {
    return await (window as any).agentDesk.history.get();
  });
  expect(entries.length).toBe(0);
});
