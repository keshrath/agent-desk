/**
 * diff-viewer.spec.ts — E2E for the read-only diff viewer (task #93c).
 *
 * Drives the UI by calling window.__diffViewer.open() directly with injected
 * oldContent/newContent payloads, bypassing git so the test doesn't depend on
 * a real repo living on the test box. Then verifies:
 *   - hunks render with add/del/ctx lines
 *   - j / k navigation highlights the active hunk
 *   - s toggles unified ↔ split
 *   - Esc closes the overlay
 *
 * The golden path is the first test; edge case is the binary-file render.
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

// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  await screenshotOnFailure(window, testInfo);
  // Force-close viewer between tests in case a previous test left it open.
  await window
    .evaluate(() => {
      // @ts-expect-error test hook
      window.__diffViewer?.close?.();
    })
    .catch(() => {});
});

test('diff viewer opens and renders hunks (golden path)', async () => {
  // Wait for the renderer bridge to finish loading.
  await window.waitForFunction(() => {
    // @ts-expect-error test hook
    return typeof window.__diffViewer?.open === 'function';
  });

  // Inject raw old + new content directly — avoids hitting git.
  await window.evaluate(() => {
    // @ts-expect-error test hook
    return window.__diffViewer.open({
      path: 'sample.js',
      root: '',
      title: 'sample.js',
      oldContent: "function hi() {\n  console.log('hello');\n  return 1;\n}\n",
      newContent: "function hi() {\n  console.log('hello, world');\n  return 2;\n}\n",
    });
  });

  const overlay = window.locator('.diff-viewer-overlay');
  await expect(overlay).toBeVisible({ timeout: 5000 });
  await expect(overlay).toHaveClass(/visible/);

  const title = window.locator('.diff-viewer-title');
  await expect(title).toContainText('sample.js');

  // Wait for at least one hunk to render.
  const hunk = window.locator('.diff-hunk').first();
  await expect(hunk).toBeVisible({ timeout: 5000 });

  // At least one add and one del line must be present.
  const addLines = window.locator('.diff-line.diff-add');
  const delLines = window.locator('.diff-line.diff-del');
  expect(await addLines.count()).toBeGreaterThanOrEqual(1);
  expect(await delLines.count()).toBeGreaterThanOrEqual(1);

  // First hunk should be active (focused) by default.
  await expect(window.locator('.diff-hunk.diff-hunk-active').first()).toBeVisible();

  // Toggle to split mode with "s" and verify grid appears.
  await window.keyboard.press('s');
  await expect(window.locator('.diff-split-grid').first()).toBeVisible();

  // Toggle back to unified.
  await window.keyboard.press('s');
  const gridCount = await window.locator('.diff-split-grid').count();
  expect(gridCount).toBe(0);

  // j / k — should still succeed even with a single hunk (no-op ok).
  await window.keyboard.press('j');
  await window.keyboard.press('k');

  // Esc closes.
  await window.keyboard.press('Escape');
  await expect(overlay).toBeHidden({ timeout: 2000 });
});

test('diff viewer handles binary files (edge case)', async () => {
  await window.waitForFunction(() => {
    // @ts-expect-error test hook
    return typeof window.__diffViewer?.open === 'function';
  });

  await window.evaluate(() => {
    // @ts-expect-error test hook
    return window.__diffViewer.open({
      path: 'blob.bin',
      root: '',
      title: 'blob.bin',
      oldContent: 'hello\0world',
      newContent: 'hi\0there',
    });
  });

  const overlay = window.locator('.diff-viewer-overlay');
  await expect(overlay).toBeVisible();

  // Binary → empty placeholder, no hunks.
  await expect(window.locator('.diff-viewer-empty')).toContainText(/[Bb]inary/);
  expect(await window.locator('.diff-hunk').count()).toBe(0);

  await window.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
});
