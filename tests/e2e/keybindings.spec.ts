/**
 * keybindings.spec.ts — F5: Keyboard Shortcuts
 *
 * Tests default keybindings, the keybindings settings section, editing,
 * resetting, conflict detection, and persistence.
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

// ── KeybindingManager Availability ───────────────────────────────────

test('KeybindingManager global is available', async () => {
  const exists = await window.evaluate('typeof KeybindingManager !== "undefined"');
  expect(exists).toBe(true);
});

test('KeybindingManager has all expected methods', async () => {
  const methods = (await window.evaluate(`({
    getBindings: typeof KeybindingManager.getBindings === 'function',
    setBindingKeys: typeof KeybindingManager.setBindingKeys === 'function',
    resetBinding: typeof KeybindingManager.resetBinding === 'function',
    resetAll: typeof KeybindingManager.resetAll === 'function',
    startCapture: typeof KeybindingManager.startCapture === 'function',
    parseKeyCombo: typeof KeybindingManager.parseKeyCombo === 'function',
  })`)) as Record<string, boolean>;
  Object.values(methods).forEach((v) => expect(v).toBe(true));
});

// ── Default Bindings ─────────────────────────────────────────────────

test('default bindings include essential shortcuts', async () => {
  const ids = (await window.evaluate(`KeybindingManager.getBindings().map(b => b.id)`)) as string[];
  expect(ids).toContain('terminal.new');
  expect(ids).toContain('terminal.newClaude');
  expect(ids).toContain('terminal.close');
  expect(ids).toContain('terminal.next');
  expect(ids).toContain('terminal.prev');
  expect(ids).toContain('general.commandPalette');
  expect(ids).toContain('general.eventStream');
  expect(ids).toContain('workspace.save');
  expect(ids).toContain('workspace.load');
});

test('default keybinding for new terminal is Ctrl+Shift+T', async () => {
  const keys = await window.evaluate(`(() => {
    const b = KeybindingManager.getBindings().find(b => b.id === 'terminal.new');
    return b ? b.effectiveKeys : null;
  })()`);
  expect(keys).toBe('Ctrl+Shift+T');
});

test('bindings are organized into categories', async () => {
  const categories = (await window.evaluate(
    `[...new Set(KeybindingManager.getBindings().map(b => b.category))]`,
  )) as string[];
  expect(categories).toContain('Terminals');
  expect(categories).toContain('Views');
  expect(categories).toContain('General');
  expect(categories).toContain('Navigation');
});

// ── Key Parsing ──────────────────────────────────────────────────────

test('parseKeyCombo handles single combo', async () => {
  const result = await window.evaluate(`(() => {
    const combo = KeybindingManager.parseKeyCombo('Ctrl+Shift+T');
    return combo && combo.ctrl && combo.shift && combo.key === 'T';
  })()`);
  expect(result).toBe(true);
});

test('parseKeyCombo returns null for empty string', async () => {
  const result = await window.evaluate(`KeybindingManager.parseKeyCombo('')`);
  expect(result).toBeNull();
});

// ── Setting and Resetting Bindings ───────────────────────────────────

test('setBindingKeys overrides a binding', async () => {
  await window.evaluate(`KeybindingManager.setBindingKeys('terminal.new', 'Ctrl+Shift+N')`);

  const newKeys = await window.evaluate(`(() => {
    const b = KeybindingManager.getBindings().find(b => b.id === 'terminal.new');
    return b ? b.effectiveKeys : null;
  })()`);
  expect(newKeys).toBe('Ctrl+Shift+N');
});

test('resetBinding restores default', async () => {
  await window.evaluate(`KeybindingManager.resetBinding('terminal.new')`);

  const keys = await window.evaluate(`(() => {
    const b = KeybindingManager.getBindings().find(b => b.id === 'terminal.new');
    return b ? b.effectiveKeys : null;
  })()`);
  expect(keys).toBe('Ctrl+Shift+T');
});

test('resetAll restores all defaults', async () => {
  await window.evaluate(`(() => {
    KeybindingManager.setBindingKeys('terminal.new', 'Ctrl+Shift+N');
    KeybindingManager.setBindingKeys('terminal.close', 'Ctrl+Shift+X');
    KeybindingManager.resetAll();
  })()`);

  const results = (await window.evaluate(`(() => {
    const bindings = KeybindingManager.getBindings();
    return {
      newTerm: bindings.find(b => b.id === 'terminal.new').effectiveKeys,
      closeTerm: bindings.find(b => b.id === 'terminal.close').effectiveKeys,
    };
  })()`)) as any;
  expect(results.newTerm).toBe('Ctrl+Shift+T');
  expect(results.closeTerm).toBe('Ctrl+W');
});

// ── Unbinding ────────────────────────────────────────────────────────

test('setting empty keys unbinds a shortcut', async () => {
  await window.evaluate(`KeybindingManager.setBindingKeys('terminal.new', '')`);

  const keys = await window.evaluate(`(() => {
    const b = KeybindingManager.getBindings().find(b => b.id === 'terminal.new');
    return b ? b.effectiveKeys : 'NOT_FOUND';
  })()`);
  expect(keys).toBe('');

  await window.evaluate(`KeybindingManager.resetAll()`);
});

// ── Settings Section ─────────────────────────────────────────────────

test('keyboard shortcuts section exists in settings', async () => {
  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const section = window.locator('#settings-panel .settings-section').filter({ hasText: 'Keyboard Shortcuts' });
  await expect(section).toBeAttached();

  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});
