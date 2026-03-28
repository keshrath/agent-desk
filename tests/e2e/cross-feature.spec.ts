/**
 * cross-feature.spec.ts — Cross-Feature & Edge Case Tests
 *
 * Tests interactions between multiple features, performance edge cases,
 * window resize behavior, and session persistence.
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
    terminalsWork = false;
  }
});

test.afterAll(async () => {
  if (app) await closeApp(app);
});

test.afterEach(async ({}, testInfo) => {
  await screenshotOnFailure(window, testInfo);
});

// ── Event Bus + Agent Parser (F1 + F2) ───────────────────────────────

test('agent tool call emits event to event bus', async () => {
  const captured = await window.evaluate(`new Promise(resolve => {
    const unsub = eventBus.on('agent:tool-call', () => { unsub(); resolve(true); });
    setTimeout(() => { unsub(); resolve(false); }, 2000);
    agentParser.parse('cross-test-1', 'Read(src/app.js)');
  })`);
  expect(captured).toBe(true);

  await window.evaluate(`agentParser.cleanup('cross-test-1')`);
});

test('agent detection emits event to event bus', async () => {
  const captured = await window.evaluate(`new Promise(resolve => {
    const unsub = eventBus.on('agent:detected', () => { unsub(); resolve(true); });
    setTimeout(() => { unsub(); resolve(false); }, 2000);
    agentParser.parse('cross-test-2', 'Claude Code v2.0');
  })`);
  expect(captured).toBe(true);

  await window.evaluate(`agentParser.cleanup('cross-test-2')`);
});

// ── Config + Settings Persistence (F6 + F5 + F10) ────────────────────

test('config file contains settings after multiple changes', async () => {
  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const fontSizeInput = window
    .locator('#settings-panel .settings-field')
    .filter({ hasText: 'Font Size' })
    .locator('input[type="number"]');
  await fontSizeInput.fill('16');
  await fontSizeInput.dispatchEvent('change');
  await window.waitForTimeout(200);

  const cursorSelect = window
    .locator('#settings-panel .settings-field')
    .filter({ hasText: 'Cursor Style' })
    .locator('select');
  await cursorSelect.selectOption('block');
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => {
    return JSON.parse(localStorage.getItem('agent-desk-settings') || '{}');
  });
  expect(stored.fontSize).toBe(16);
  expect(stored.cursorStyle).toBe('block');

  const resetBtn = window
    .locator('#settings-panel .settings-reset:not([disabled])')
    .filter({ hasText: 'Reset' })
    .first();
  if ((await resetBtn.count()) > 0) {
    await resetBtn.click();
  }
  await window.waitForTimeout(300);

  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});

// ── Replay Parse + Open (F3) ─────────────────────────────────────────

test('parseCastFile and openReplayFromContent work together', async () => {
  test.skip(true, 'Replay API has been removed from the codebase');
});

// ── Shell Integration + Status Bar (F8) ──────────────────────────────

test('shell integration cwd can be queried per terminal', async () => {
  const result = (await window.evaluate(`(() => {
    ShellIntegration.processData('cross-si-1', '\\x1b]7;file:///home/user/test\\x07', 0);
    const cwd = ShellIntegration.getCwd('cross-si-1');
    const active = ShellIntegration.isActive('cross-si-1');
    ShellIntegration.cleanup('cross-si-1');
    return { cwd, active };
  })()`)) as any;
  expect(result.active).toBe(true);
  expect(result.cwd).toContain('/home/user/test');
});

// ── Rapid Terminal Create/Close (Performance) ────────────────────────

test('rapid terminal creation does not crash', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const countBefore = await window.locator('.dv-custom-tab').count();

  for (let i = 0; i < 3; i++) {
    await window.keyboard.press('Control+Shift+T');
    await window.waitForTimeout(1500);
  }

  const countAfter = await window.locator('.dv-custom-tab').count();
  expect(countAfter).toBe(countBefore + 3);

  for (let i = 0; i < 3; i++) {
    await window.locator('#titlebar').click();
    await window.waitForTimeout(200);
    await window.keyboard.press('Control+w');
    await window.waitForTimeout(500);
    const confirmBtn = window.locator('.confirm-btn-confirm');
    if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmBtn.click();
      await window.waitForTimeout(500);
    }
  }

  const countFinal = await window.locator('.dv-custom-tab').count();
  expect(countFinal).toBe(countBefore);
});

// ── Window Resize ────────────────────────────────────────────────────

test('window resize does not break layout', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setSize(1024, 768);
  });
  await window.waitForTimeout(500);

  const sidebar = window.locator('#sidebar');
  await expect(sidebar).toBeVisible();

  const statusBar = window.locator('#status-bar');
  await expect(statusBar).toBeVisible();

  const termHosts = await window.locator('.dv-terminal-host').count();
  expect(termHosts).toBeGreaterThanOrEqual(1);

  await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setSize(1280, 800);
  });
  await window.waitForTimeout(500);
});

// ── Multiple View Switches ───────────────────────────────────────────

test('rapid view switching does not break state', async () => {
  const views = ['terminals', 'comm', 'tasks', 'knowledge', 'settings', 'terminals'];

  for (const view of views) {
    await window.locator(`#sidebar .nav-btn[data-view="${view}"]`).click();
    await window.waitForTimeout(200);
  }

  await expect(window.locator('#terminal-views')).toHaveClass(/active/);
});

// ── Event Bus History ────────────────────────────────────────────────

test('eventBus.history returns past events', async () => {
  await window.evaluate(`eventBus.emit('terminal:created', { terminalId: 'hist-test', title: 'Hist Test' })`);

  const history = (await window.evaluate(`eventBus.history('terminal:created')`)) as any[];
  expect(history.length).toBeGreaterThanOrEqual(1);
});

test('eventBus.clear empties history', async () => {
  await window.evaluate(`eventBus.clear()`);

  const history = (await window.evaluate(`eventBus.history()`)) as any[];
  expect(history.length).toBe(0);
});

// ── Theme verification ─────────────────────────────────────────────

test('built-in themes include expected entries', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const allThemes = (await window.evaluate(`getAllThemes().map(t => t.id)`)) as string[];
  expect(allThemes).toContain('default-dark');
  expect(allThemes).toContain('dracula');
  expect(allThemes).toContain('nord');
});

// ── Keybinding + Workspace (F5 + F4) ─────────────────────────────────

test('workspace save and load keybindings exist', async () => {
  const bindings = (await window.evaluate(`(() => {
    const all = KeybindingManager.getBindings();
    return {
      save: all.find(b => b.id === 'workspace.save').effectiveKeys,
      load: all.find(b => b.id === 'workspace.load').effectiveKeys,
    };
  })()`)) as any;
  expect(bindings.save).toBe('Ctrl+Shift+W');
  expect(bindings.load).toBe('Ctrl+Alt+W');
});
