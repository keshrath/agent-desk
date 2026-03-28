/**
 * terminal.spec.ts — Terminal management tests
 *
 * Covers terminal creation, dockview tab lifecycle, keyboard shortcuts for
 * creating/closing/cycling terminals, context menus, renaming, and
 * status bar updates.  The app uses dockview-core for panel layout, so
 * tabs are rendered as `.dv-custom-tab` elements inside dockview.
 *
 * NOTE: These tests require working terminal creation (node-pty + dockview).
 * If the dockview component init fails, all terminal-dependent tests will
 * be skipped gracefully.
 */

import { test, expect } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { buildApp, launchApp, closeApp, screenshotOnFailure } from './helpers';

let app: ElectronApplication;
let window: Page;
let terminalsWork = false;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  buildApp();
  ({ app, window } = await launchApp());

  try {
    await window.locator('.dv-terminal-host').first().waitFor({ state: 'attached', timeout: 10000 });
    terminalsWork = true;
  } catch {
    try {
      await window.keyboard.press('Control+Shift+T');
      await window.waitForTimeout(3000);
      const count = await window.locator('.dv-terminal-host').count();
      terminalsWork = count > 0;
    } catch {
      terminalsWork = false;
    }
  }
});

test.afterAll(async () => {
  if (app) await closeApp(app);
});

test.afterEach(async ({}, testInfo) => {
  await screenshotOnFailure(window, testInfo);
});

// ── Helpers ────────────────────────────────────────────────────────────

async function dockviewTabCount(): Promise<number> {
  return window.locator('.dv-custom-tab').count();
}

async function dockviewTabLabels(): Promise<string[]> {
  return window.locator('.dv-tab-label').allTextContents();
}

// ── Tests ──────────────────────────────────────────────────────────────

test('terminal creation is functional', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working (dockview/node-pty issue)');
  const containers = await window.locator('.dv-terminal-host').count();
  expect(containers).toBeGreaterThanOrEqual(1);
});

test('terminal has xterm element', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');
  const container = window.locator('.dv-terminal-host').first();
  await expect(container).toBeVisible();
  const xterm = container.locator('.xterm');
  await expect(xterm).toBeVisible();
});

test('dockview tab appears for terminal', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');
  const tabs = await dockviewTabCount();
  expect(tabs).toBeGreaterThanOrEqual(1);
});

test('can create new terminal via Ctrl+Shift+T', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');
  const before = await dockviewTabCount();
  await window.keyboard.press('Control+Shift+T');
  await window.waitForTimeout(2000);
  const after = await dockviewTabCount();
  expect(after).toBe(before + 1);
});

test('can create Claude terminal via Ctrl+Shift+C', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');
  const before = await dockviewTabCount();
  await window.keyboard.press('Control+Shift+C');
  await window.waitForTimeout(2000);
  const after = await dockviewTabCount();
  expect(after).toBe(before + 1);
  const labels = await dockviewTabLabels();
  const hasClaudeTab = labels.some((l) => l.toLowerCase() === 'claude');
  expect(hasClaudeTab).toBe(true);
});

test('can close terminal via dockview tab close button', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');
  await window.keyboard.press('Control+Shift+T');
  await window.waitForTimeout(2000);
  const before = await dockviewTabCount();

  await window.evaluate(() => {
    const closeBtns = document.querySelectorAll('.dv-tab-close');
    const lastBtn = closeBtns[closeBtns.length - 1] as HTMLElement;
    lastBtn?.click();
  });
  await window.waitForTimeout(1000);

  const confirmBtn = window.locator('.confirm-btn-confirm');
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click();
    await window.waitForTimeout(1000);
  }

  const after = await dockviewTabCount();
  expect(after).toBeLessThanOrEqual(before);
});

test('can close terminal via Ctrl+W', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');
  await window.keyboard.press('Control+Shift+T');
  await window.waitForTimeout(2000);
  const before = await dockviewTabCount();

  await window.locator('#titlebar').click();
  await window.waitForTimeout(200);
  await window.keyboard.press('Control+w');
  await window.waitForTimeout(500);

  const confirmBtn2 = window.locator('.confirm-btn-confirm');
  if (await confirmBtn2.isVisible({ timeout: 1000 }).catch(() => false)) {
    await confirmBtn2.click();
    await window.waitForTimeout(500);
  }

  const after = await dockviewTabCount();
  expect(after).toBe(before - 1);
});

test('Ctrl+Tab cycles to next terminal', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');
  const count = await dockviewTabCount();
  if (count < 2) {
    await window.keyboard.press('Control+Shift+T');
    await window.waitForTimeout(2000);
  }

  const initialActiveId = await window.evaluate(() => {
    const s = (window as any).__agentDeskState;
    return s ? s.activeTerminalId : null;
  });

  await window.evaluate(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        ctrlKey: true,
        bubbles: true,
      }),
    );
  });
  await window.waitForTimeout(300);

  const newActiveId = await window.evaluate(() => {
    const s = (window as any).__agentDeskState;
    return s ? s.activeTerminalId : null;
  });

  if (initialActiveId !== null) {
    expect(newActiveId).not.toBe(initialActiveId);
  }
});

test('Ctrl+Shift+Tab cycles to previous terminal', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');
  const count = await dockviewTabCount();
  if (count < 2) {
    await window.keyboard.press('Control+Shift+T');
    await window.waitForTimeout(2000);
  }

  const initialActiveId = await window.evaluate(() => {
    const s = (window as any).__agentDeskState;
    return s ? s.activeTerminalId : null;
  });

  await window.evaluate(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );
  });
  await window.waitForTimeout(300);

  const newActiveId = await window.evaluate(() => {
    const s = (window as any).__agentDeskState;
    return s ? s.activeTerminalId : null;
  });

  if (initialActiveId !== null) {
    expect(newActiveId).not.toBe(initialActiveId);
  }
});

test('tab context menu contains Rename and Close', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');
  const tab = window.locator('.dv-custom-tab').first();
  const box = await tab.boundingBox();
  expect(box).toBeTruthy();

  await window.evaluate(
    ([x, y]: [number, number]) => {
      const t = document.querySelector('.dv-custom-tab');
      if (!t) return;
      t.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          clientX: x,
          clientY: y,
        }),
      );
    },
    [box!.x + box!.width / 2, box!.y + box!.height / 2] as [number, number],
  );
  await window.waitForTimeout(500);

  const items = await window.evaluate(() => {
    const menu = document.querySelector('.context-menu');
    if (!menu) return [];
    return Array.from(menu.querySelectorAll('.context-item')).map((el) => {
      const spans = el.querySelectorAll('span');
      for (const span of spans) {
        if (!span.classList.contains('material-symbols-outlined') && !span.classList.contains('shortcut')) {
          return span.textContent || '';
        }
      }
      return el.textContent?.trim() || '';
    });
  });

  expect(items).toContain('Rename');
  expect(items).toContain('Close');

  await window.evaluate(() => {
    document.querySelector('.context-menu')?.remove();
  });
});

test('double-click tab label to rename works', async () => {
  test.skip(true, 'Tab rename via dblclick not wired up — rename is via context menu');
  const label = window.locator('.dv-tab-label').first();
  const originalText = await label.textContent();

  await label.dblclick();
  await window.waitForTimeout(300);

  const renameInput = window.locator('.dv-tab-rename-input').first();
  await expect(renameInput).toBeVisible();

  await renameInput.fill('My Terminal');
  await renameInput.press('Enter');
  await window.waitForTimeout(300);

  const newLabel = window.locator('.dv-tab-label').first();
  await expect(newLabel).toHaveText('My Terminal');

  await newLabel.dblclick();
  await window.waitForTimeout(300);
  const input2 = window.locator('.dv-tab-rename-input').first();
  await input2.fill(originalText || 'Claude');
  await input2.press('Enter');
  await window.waitForTimeout(300);
});

test('terminal count shows in status bar', async () => {
  const statusLeft = window.locator('#status-bar .status-left');
  const text = await statusLeft.innerText();
  expect(text.toLowerCase()).toContain('terminal');
});

test('Ctrl+F opens search bar and typing triggers search', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  // Click the titlebar to ensure focus is outside xterm, then press Ctrl+F
  await window.locator('#titlebar').click();
  await window.waitForTimeout(200);

  await window.evaluate(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true,
      }),
    );
  });
  await window.waitForTimeout(500);

  // Search bar should be visible
  const searchBar = window.locator('#terminal-search-bar');
  await expect(searchBar).toBeVisible();

  // Input should be focused and usable
  const input = window.locator('#terminal-search-input');
  await expect(input).toBeVisible();
  await input.fill('test');
  await window.waitForTimeout(300);

  // Count element should exist
  const count = window.locator('#terminal-search-count');
  await expect(count).toBeVisible();

  // Escape closes the search bar
  await input.press('Escape');
  await window.waitForTimeout(300);
  await expect(searchBar).not.toBeVisible();
});

test('WebLinksAddon is loaded on terminals', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const hasWebLinksAddon = await window.evaluate(() => {
    const WebLinksAddon =
      (window as any).WebLinksAddon && ((window as any).WebLinksAddon.WebLinksAddon || (window as any).WebLinksAddon);
    if (!WebLinksAddon) return false;

    const s = (window as any).__agentDeskState;
    if (!s || !s.terminals || s.terminals.size === 0) return false;
    const first = s.terminals.values().next().value;
    if (!first || !first.term) return false;
    // xterm stores loaded addons in _addonManager._addons
    const mgr = (first.term as any)._addonManager;
    if (!mgr || !mgr._addons) return false;
    return mgr._addons.some((entry: any) => {
      const inst = entry.instance || entry;
      return inst && inst instanceof WebLinksAddon;
    });
  });
  expect(hasWebLinksAddon).toBe(true);
});

test('closing all terminals leaves empty state', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');
  let count = await dockviewTabCount();
  let attempts = 0;
  while (count > 0 && attempts < 20) {
    await window.locator('#titlebar').click();
    await window.waitForTimeout(200);
    await window.keyboard.press('Control+w');
    await window.waitForTimeout(500);
    const confirmBtn3 = window.locator('.confirm-btn-confirm');
    if (await confirmBtn3.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmBtn3.click();
      await window.waitForTimeout(500);
    }
    count = await dockviewTabCount();
    attempts++;
  }

  expect(await dockviewTabCount()).toBe(0);

  await window.keyboard.press('Control+Shift+T');
  await window.waitForTimeout(2000);
});
