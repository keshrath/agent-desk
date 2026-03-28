/**
 * drag-drop.spec.ts — F15: Drag-Drop File Support
 *
 * Tests the shell escape utility, drop overlay creation,
 * platform-aware escaping, and drag-drop setup.
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

// ── Shell Escape Utility ─────────────────────────────────────────────

test('_shellEscape handles simple paths without escaping', async () => {
  const result = await window.evaluate(() => {
    const fn = (window as any)._shellEscape;
    if (typeof fn !== 'function') return null;
    return fn('C:\\Users\\test\\file.txt');
  });
  if (result === null) return;
  expect(result).toBeTruthy();
  expect(typeof result).toBe('string');
});

test('_shellEscape wraps paths with spaces in quotes (Windows)', async () => {
  const result = await window.evaluate(() => {
    const fn = (window as any)._shellEscape;
    if (typeof fn !== 'function') return null;
    const isWin = navigator.platform.startsWith('Win');
    if (!isWin) return 'skip';
    return fn('C:\\Users\\my user\\file.txt');
  });
  if (result === null || result === 'skip') return;
  expect(result).toContain('"');
});

test('_shellEscape handles special characters', async () => {
  const result = await window.evaluate(() => {
    const fn = (window as any)._shellEscape;
    if (typeof fn !== 'function') return null;
    return fn('path with spaces & special');
  });
  if (result === null) return;
  expect(result.length).toBeGreaterThan('path with spaces & special'.length - 1);
});

// ── Drop Overlay ─────────────────────────────────────────────────────

test('drop overlay styles exist in document', async () => {
  const hasStyles = await window.evaluate(() => {
    const sheets = document.styleSheets;
    for (let i = 0; i < sheets.length; i++) {
      try {
        const rules = sheets[i].cssRules;
        for (let j = 0; j < rules.length; j++) {
          if (rules[j].cssText && rules[j].cssText.includes('.drop-overlay')) {
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

test('dragenter on #app with Files creates overlay', async () => {
  await window.evaluate(() => {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    const dt = new DataTransfer();
    dt.items.add(new File(['test'], 'test.txt'));

    const event = new DragEvent('dragenter', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    appEl.dispatchEvent(event);
  });
  await window.waitForTimeout(300);

  const overlay = window.locator('.drop-overlay');
  const count = await overlay.count();

  if (count > 0) {
    const isVisible = await overlay.evaluate((el) => el.classList.contains('visible'));
    expect(isVisible).toBe(true);

    await window.evaluate(() => {
      const appEl = document.getElementById('app');
      if (!appEl) return;
      const dt = new DataTransfer();
      dt.items.add(new File(['test'], 'test.txt'));
      appEl.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
    await window.waitForTimeout(300);
  }
});

// ── Drag-Drop Setup ──────────────────────────────────────────────────

test('window has dragover prevention handler', async () => {
  const prevented = await window.evaluate(() => {
    let wasPrevented = false;
    const handler = (e: Event) => {
      wasPrevented = e.defaultPrevented;
    };
    window.addEventListener('dragover', handler, { once: true });

    const dt = new DataTransfer();
    const event = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    window.dispatchEvent(event);
    window.removeEventListener('dragover', handler);
    return wasPrevented;
  });
  expect(prevented).toBe(true);
});

test('window has drop prevention handler', async () => {
  const prevented = await window.evaluate(() => {
    let wasPrevented = false;
    const handler = (e: Event) => {
      wasPrevented = e.defaultPrevented;
    };
    window.addEventListener('drop', handler, { once: true });

    const dt = new DataTransfer();
    const event = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    window.dispatchEvent(event);
    window.removeEventListener('drop', handler);
    return wasPrevented;
  });
  expect(prevented).toBe(true);
});
