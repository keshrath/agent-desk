/**
 * command-history.spec.ts — F13: Command History
 *
 * Tests the command history IPC API, persistence, search/filter,
 * and the history overlay CSS classes.
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

// ── History API ──────────────────────────────────────────────────────

test('history API is available via agentDesk.history', async () => {
  const hasApi = await window.evaluate(() => {
    const ad = (window as any).agentDesk;
    return !!(ad && ad.history && ad.history.get && ad.history.clear);
  });
  expect(hasApi).toBe(true);
});

test('history.get returns an array', async () => {
  const result = await window.evaluate(async () => {
    const entries = await (window as any).agentDesk.history.get();
    return Array.isArray(entries);
  });
  expect(result).toBe(true);
});

test('history.get supports limit parameter', async () => {
  const entries = await window.evaluate(async () => {
    return await (window as any).agentDesk.history.get(5);
  });
  expect(Array.isArray(entries)).toBe(true);
  expect(entries.length).toBeLessThanOrEqual(5);
});

test('history.get supports search parameter', async () => {
  const entries = await window.evaluate(async () => {
    return await (window as any).agentDesk.history.get(100, 'nonexistent-search-xyz');
  });
  expect(Array.isArray(entries)).toBe(true);
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

test('history.onNew callback is a function', async () => {
  const isFunction = await window.evaluate(() => {
    return typeof (window as any).agentDesk.history.onNew === 'function';
  });
  expect(isFunction).toBe(true);
});

// ── History Overlay CSS ──────────────────────────────────────────────

test('history overlay styles exist in document', async () => {
  const hasStyles = await window.evaluate(() => {
    const sheets = document.styleSheets;
    for (let i = 0; i < sheets.length; i++) {
      try {
        const rules = sheets[i].cssRules;
        for (let j = 0; j < rules.length; j++) {
          if (rules[j].cssText && rules[j].cssText.includes('.history-overlay')) {
            return true;
          }
        }
      } catch {
        continue;
      }
    }
    return false;
  });
  expect(hasStyles).toBe(true);
});
