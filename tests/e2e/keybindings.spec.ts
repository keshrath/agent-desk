/**
 * keybindings.spec.ts -- Keyboard Shortcuts
 *
 * Tests default keybindings, key parsing, setting/resetting bindings,
 * unbinding, and the keybindings settings section.
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

test('default bindings include essential shortcuts in correct categories', async () => {
  const result = (await window.evaluate(`(() => {
    const bindings = KeybindingManager.getBindings();
    const ids = bindings.map(b => b.id);
    const categories = [...new Set(bindings.map(b => b.category))];
    const newTermKeys = bindings.find(b => b.id === 'terminal.new')?.effectiveKeys;
    return { ids, categories, newTermKeys };
  })()`)) as any;

  expect(result.ids).toContain('terminal.new');
  expect(result.ids).toContain('terminal.newAgent');
  expect(result.ids).toContain('terminal.close');
  expect(result.ids).toContain('general.commandPalette');
  expect(result.ids).toContain('general.eventStream');
  expect(result.ids).toContain('workspace.save');
  expect(result.ids).toContain('workspace.load');
  expect(result.categories).toContain('Terminals');
  expect(result.categories).toContain('Views');
  expect(result.categories).toContain('General');
  expect(result.newTermKeys).toBe('Ctrl+Shift+T');
});

test('parseKeyCombo handles valid combos and empty string', async () => {
  const result = await window.evaluate(`(() => {
    const combo = KeybindingManager.parseKeyCombo('Ctrl+Shift+T');
    const empty = KeybindingManager.parseKeyCombo('');
    return {
      valid: combo && combo.ctrl && combo.shift && combo.key === 'T',
      emptyIsNull: empty === null,
    };
  })()`);
  expect((result as any).valid).toBe(true);
  expect((result as any).emptyIsNull).toBe(true);
});

test('setBindingKeys overrides and resetBinding restores', async () => {
  await window.evaluate(`KeybindingManager.setBindingKeys('terminal.new', 'Ctrl+Shift+N')`);
  let keys = await window.evaluate(`KeybindingManager.getBindings().find(b => b.id === 'terminal.new').effectiveKeys`);
  expect(keys).toBe('Ctrl+Shift+N');

  await window.evaluate(`KeybindingManager.resetBinding('terminal.new')`);
  keys = await window.evaluate(`KeybindingManager.getBindings().find(b => b.id === 'terminal.new').effectiveKeys`);
  expect(keys).toBe('Ctrl+Shift+T');
});

test('resetAll restores all defaults after multiple changes', async () => {
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

test('setting empty keys unbinds a shortcut', async () => {
  await window.evaluate(`KeybindingManager.setBindingKeys('terminal.new', '')`);

  const keys = await window.evaluate(
    `KeybindingManager.getBindings().find(b => b.id === 'terminal.new').effectiveKeys`,
  );
  expect(keys).toBe('');

  await window.evaluate(`KeybindingManager.resetAll()`);
});

test('keyboard shortcuts section exists in settings', async () => {
  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const section = window.locator('#settings-panel .settings-section').filter({ hasText: 'Keyboard Shortcuts' });
  await expect(section).toBeAttached();

  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});
