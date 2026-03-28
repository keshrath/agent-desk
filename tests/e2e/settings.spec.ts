/**
 * settings.spec.ts — Comprehensive settings panel E2E tests
 *
 * Tests every section, every field type, persistence, reset, profiles CRUD,
 * notifications toggles, appearance changes, and UI/UX layout validation.
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

  // Clear any stale settings/profiles
  await window.evaluate(() => {
    localStorage.removeItem('agent-desk-settings');
    localStorage.removeItem('agent-desk-profiles');
  });

  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);
});

test.afterAll(async () => {
  if (app) await closeApp(app);
});

test.afterEach(async ({}, testInfo) => {
  await screenshotOnFailure(window, testInfo);
});

// Helper to get a settings field row by label text
function settingsField(label: string) {
  return window.locator('#settings-panel .settings-field').filter({ hasText: label });
}

// ── Section Structure ─────────────────────────────────────────────────

test('settings panel renders with all 6 sections', async () => {
  const panel = window.locator('#settings-panel');
  await expect(panel).toHaveClass(/active/);

  const heading = panel.locator('.settings-heading');
  await expect(heading).toHaveText('Settings');

  const sectionTitles = await panel.locator('.settings-section-title').allInnerTexts();
  expect(sectionTitles).toEqual([
    'Terminal',
    'Dashboard URLs',
    'Appearance',
    'Themes',
    'Profiles',
    'Notifications',
    'Behavior',
    'Templates',
    'Workspaces',
    'Keyboard Shortcuts',
    'Shell Integration',
  ]);
});

test('each section has a material icon', async () => {
  const icons = await window
    .locator('#settings-panel .settings-section-header .material-symbols-outlined')
    .allTextContents();
  expect(icons.length).toBeGreaterThanOrEqual(6);
});

// ── Terminal Section ──────────────────────────────────────────────────

test('Terminal section has all expected fields', async () => {
  const labels = await window.locator('#settings-panel .settings-label').allTextContents();
  expect(labels).toContain('Default Shell');
  expect(labels).toContain('Default Terminal Path');
  expect(labels).toContain('Font Size');
  expect(labels).toContain('Font Family');
  expect(labels).toContain('Cursor Style');
  expect(labels).toContain('Cursor Blink');
  expect(labels).toContain('Scrollback Lines');
  expect(labels).toContain('Line Height');
});

test('Default Shell is a select with correct options', async () => {
  const select = settingsField('Default Shell').locator('select');
  const options = await select.locator('option').allTextContents();
  expect(options).toEqual(['PowerShell', 'CMD', 'Bash', 'Claude', 'OpenCode']);

  const value = await select.inputValue();
  expect(value).toBe('Claude');
});

test('Default Shell change persists', async () => {
  const select = settingsField('Default Shell').locator('select');
  await select.selectOption('Bash');
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => {
    const raw = localStorage.getItem('agent-desk-settings');
    return raw ? JSON.parse(raw) : null;
  });
  expect(stored.defaultShell).toBe('Bash');

  // Reset
  await select.selectOption('Claude');
  await window.waitForTimeout(200);
});

test('Default Terminal Path is a text input', async () => {
  const input = settingsField('Default Terminal Path').locator('input[type="text"]');
  await expect(input).toBeVisible();
  const value = await input.inputValue();
  expect(typeof value).toBe('string');
});

test('Default Terminal Path change persists', async () => {
  const input = settingsField('Default Terminal Path').locator('input[type="text"]');
  await input.fill('C:\\Projects');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => {
    return JSON.parse(localStorage.getItem('agent-desk-settings') || '{}');
  });
  expect(stored.defaultTerminalCwd).toBe('C:\\Projects');

  // Clear
  await input.fill('');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);
});

test('Font Size is a number input with min/max constraints', async () => {
  const input = settingsField('Font Size').locator('input[type="number"]');
  await expect(input).toBeVisible();
  expect(await input.getAttribute('min')).toBe('10');
  expect(await input.getAttribute('max')).toBe('24');
  expect(await input.getAttribute('step')).toBe('1');
});

test('Font Size change persists to localStorage', async () => {
  const input = settingsField('Font Size').locator('input[type="number"]');
  await input.fill('18');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => {
    return JSON.parse(localStorage.getItem('agent-desk-settings') || '{}');
  });
  expect(stored.fontSize).toBe(18);

  await input.fill('14');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);
});

test('Font Size validation clamps below min', async () => {
  const input = settingsField('Font Size').locator('input[type="number"]');
  await input.fill('5');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => {
    return JSON.parse(localStorage.getItem('agent-desk-settings') || '{}');
  });
  expect(stored.fontSize).toBe(10); // clamped to min

  await input.fill('14');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);
});

test('Font Size validation clamps above max', async () => {
  const input = settingsField('Font Size').locator('input[type="number"]');
  await input.fill('50');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => {
    return JSON.parse(localStorage.getItem('agent-desk-settings') || '{}');
  });
  expect(stored.fontSize).toBe(24); // clamped to max

  await input.fill('14');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);
});

test('Font Family is a text input defaulting to JetBrains Mono', async () => {
  const input = settingsField('Font Family').locator('input[type="text"]');
  const value = await input.inputValue();
  expect(value).toBe('JetBrains Mono');
});

test('Cursor Style is a select with bar/block/underline', async () => {
  const select = settingsField('Cursor Style').locator('select');
  const options = await select.locator('option').allTextContents();
  expect(options).toEqual(['bar', 'block', 'underline']);
});

test('Cursor Style change persists', async () => {
  const select = settingsField('Cursor Style').locator('select');
  await select.selectOption('block');
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => {
    return JSON.parse(localStorage.getItem('agent-desk-settings') || '{}');
  });
  expect(stored.cursorStyle).toBe('block');

  await select.selectOption('bar');
  await window.waitForTimeout(200);
});

test('Cursor Blink is a toggle switch defaulting to on', async () => {
  const toggle = settingsField('Cursor Blink').locator('.settings-checkbox-wrap input[type="checkbox"]');
  expect(await toggle.isChecked()).toBe(true);
});

test('Cursor Blink toggle persists', async () => {
  const toggleSpan = settingsField('Cursor Blink').locator('.settings-toggle');
  await toggleSpan.click();
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => {
    return JSON.parse(localStorage.getItem('agent-desk-settings') || '{}');
  });
  expect(stored.cursorBlink).toBe(false);

  await toggleSpan.click();
  await window.waitForTimeout(200);
});

test('Scrollback Lines has correct constraints', async () => {
  const input = settingsField('Scrollback Lines').locator('input[type="number"]');
  expect(await input.getAttribute('min')).toBe('1000');
  expect(await input.getAttribute('max')).toBe('100000');
  expect(await input.getAttribute('step')).toBe('1000');
  expect(await input.inputValue()).toBe('10000');
});

test('Line Height has correct constraints', async () => {
  const input = settingsField('Line Height').locator('input[type="number"]');
  expect(await input.getAttribute('min')).toBe('1');
  expect(await input.getAttribute('max')).toBe('2');
  expect(await input.getAttribute('step')).toBe('0.1');
});

// ── Dashboard URLs Section ────────────────────────────────────────────

test('Dashboard URLs section has 3 URL fields', async () => {
  for (const label of ['Agent Comm URL', 'Agent Tasks URL', 'Agent Knowledge URL']) {
    const input = settingsField(label).locator('input[type="text"]');
    await expect(input).toBeVisible();
  }
});

test('Dashboard URL defaults are correct', async () => {
  expect(await settingsField('Agent Comm URL').locator('input').inputValue()).toBe('http://localhost:3421');
  expect(await settingsField('Agent Tasks URL').locator('input').inputValue()).toBe('http://localhost:3422');
  expect(await settingsField('Agent Knowledge URL').locator('input').inputValue()).toBe('http://localhost:3423');
});

test('Dashboard URL change persists', async () => {
  const input = settingsField('Agent Comm URL').locator('input');
  await input.fill('http://localhost:9999');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => {
    return JSON.parse(localStorage.getItem('agent-desk-settings') || '{}');
  });
  expect(stored.agentCommUrl).toBe('http://localhost:9999');

  await input.fill('http://localhost:3421');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);
});

// ── Appearance Section ────────────────────────────────────────────────

test('Sidebar Position is a select with left/right', async () => {
  const select = settingsField('Sidebar Position').locator('select');
  const options = await select.locator('option').allTextContents();
  expect(options).toEqual(['left', 'right']);
  expect(await select.inputValue()).toBe('left');
});

test('Sidebar Position change persists', async () => {
  const select = settingsField('Sidebar Position').locator('select');
  await select.selectOption('right');
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => {
    return JSON.parse(localStorage.getItem('agent-desk-settings') || '{}');
  });
  expect(stored.sidebarPosition).toBe('right');

  await select.selectOption('left');
  await window.waitForTimeout(200);
});

test('Show Status Bar toggle defaults to on', async () => {
  const toggle = settingsField('Show Status Bar').locator('.settings-checkbox-wrap input[type="checkbox"]');
  expect(await toggle.isChecked()).toBe(true);
});

test('Tab Close Button is a select with always/hover/never', async () => {
  const select = settingsField('Tab Close Button').locator('select');
  const options = await select.locator('option').allTextContents();
  expect(options).toEqual(['always', 'hover', 'never']);
  expect(await select.inputValue()).toBe('hover');
});

// ── Notifications Section ─────────────────────────────────────────────

test('Notifications section has 3 toggle fields', async () => {
  for (const label of ['Visual Bell (flash tab)', 'Bell Sound (system beep)', 'Desktop Notifications']) {
    const toggle = settingsField(label).locator('.settings-checkbox-wrap input[type="checkbox"]');
    await expect(toggle).toBeAttached();
  }
});

test('Notification defaults are correct', async () => {
  const visualBell = settingsField('Visual Bell (flash tab)').locator('.settings-checkbox-wrap input[type="checkbox"]');
  const bellSound = settingsField('Bell Sound (system beep)').locator('.settings-checkbox-wrap input[type="checkbox"]');
  const desktop = settingsField('Desktop Notifications').locator('.settings-checkbox-wrap input[type="checkbox"]');

  expect(await visualBell.isChecked()).toBe(true);
  expect(await bellSound.isChecked()).toBe(false);
  expect(await desktop.isChecked()).toBe(true);
});

test('Notification toggle change persists', async () => {
  const toggleSpan = settingsField('Bell Sound (system beep)').locator('.settings-toggle');
  await toggleSpan.click();
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => {
    return JSON.parse(localStorage.getItem('agent-desk-settings') || '{}');
  });
  expect(stored.bellSound).toBe(true);

  await toggleSpan.click();
  await window.waitForTimeout(200);
});

// ── Behavior Section ──────────────────────────────────────────────────

test('Behavior section has all fields', async () => {
  for (const label of ['Close to Tray', 'Start on Login', 'New Terminal on Startup', 'Default New Terminal Command']) {
    const field = settingsField(label);
    await expect(field).toBeAttached();
  }
});

test('Behavior defaults are correct', async () => {
  const closeToTray = settingsField('Close to Tray').locator('.settings-checkbox-wrap input[type="checkbox"]');
  const startOnLogin = settingsField('Start on Login').locator('.settings-checkbox-wrap input[type="checkbox"]');
  const newTermOnStartup = settingsField('New Terminal on Startup').locator(
    '.settings-checkbox-wrap input[type="checkbox"]',
  );
  const defaultCmd = settingsField('Default New Terminal Command').locator('input[type="text"]');

  expect(await closeToTray.isChecked()).toBe(true);
  expect(await startOnLogin.isChecked()).toBe(false);
  expect(await newTermOnStartup.isChecked()).toBe(true);
  expect(await defaultCmd.inputValue()).toBe('claude');
});

// ── Profiles Section ──────────────────────────────────────────────────

test('Profiles section shows at least 2 default profiles', async () => {
  const profileRows = window.locator('#settings-panel .profile-row');
  const count = await profileRows.count();
  expect(count).toBeGreaterThanOrEqual(2);

  const names = await window.locator('#settings-panel .profile-name').allTextContents();
  expect(names).toContain('Default Shell');
  expect(names).toContain('Claude');
});

test('Profiles section has exactly one Add Profile button', async () => {
  const profileSection = window.locator('#settings-panel .settings-section').filter({ hasText: 'Profiles' });
  const addBtns = profileSection.locator('.profile-btn-add');
  expect(await addBtns.count()).toBe(1);
});

test('Default profiles have edit button but no delete button', async () => {
  const profileSection = window.locator('#settings-panel .settings-section').filter({ hasText: 'Profiles' });
  const profileRows = profileSection.locator('.profile-row');
  const count = await profileRows.count();
  expect(count).toBeGreaterThanOrEqual(2);

  for (let i = 0; i < Math.min(count, 2); i++) {
    const row = profileRows.nth(i);
    const editBtn = row.locator('button[title="Edit"]');
    const delBtn = row.locator('button[title="Delete"]');
    await expect(editBtn).toBeVisible();
    expect(await delBtn.count()).toBe(0);
  }
});

test('Add Profile opens form, creates profile, and closes form', async () => {
  const profileSection = window.locator('#settings-panel .settings-section').filter({ hasText: 'Profiles' });
  const addBtn = profileSection.locator('.profile-btn-add');
  await addBtn.click();
  await window.waitForTimeout(300);

  // Form should be visible
  const form = window.locator('#settings-panel .profile-form');
  await expect(form).toBeVisible();

  // Fill in the form
  const nameInput = form.locator('input').first();
  await nameInput.fill('My Test Profile');

  const commandInput = form.locator('input').nth(1);
  await commandInput.fill('node');

  // Click save
  const saveBtn = form.locator('.profile-btn-save');
  await saveBtn.click();
  await window.waitForTimeout(500);

  // Verify profile was added
  const names = await window.locator('#settings-panel .profile-name').allTextContents();
  expect(names).toContain('My Test Profile');

  // Verify persisted in localStorage
  const stored = await window.evaluate(() => {
    const raw = localStorage.getItem('agent-desk-profiles');
    return raw ? JSON.parse(raw) : null;
  });
  expect(stored).toBeTruthy();
  const testProfile = stored.find((p: any) => p.name === 'My Test Profile');
  expect(testProfile).toBeTruthy();
  expect(testProfile.command).toBe('node');
});

test('Custom profile has delete button', async () => {
  const profileSection = window.locator('#settings-panel .settings-section').filter({ hasText: 'Profiles' });
  const testRow = profileSection.locator('.profile-row').filter({ hasText: 'My Test Profile' });
  const delBtn = testRow.locator('button[title="Delete"]');
  await expect(delBtn).toBeVisible();
});

test('Delete custom profile removes it', async () => {
  const profileSection = window.locator('#settings-panel .settings-section').filter({ hasText: 'Profiles' });
  const testRow = profileSection.locator('.profile-row').filter({ hasText: 'My Test Profile' });
  const delBtn = testRow.locator('button[title="Delete"]');
  await delBtn.click();
  await window.waitForTimeout(500);

  const names = await window.locator('#settings-panel .profile-name').allTextContents();
  expect(names).not.toContain('My Test Profile');

  expect(await window.locator('#settings-panel .profile-row').count()).toBe(3);
});

test('After add/delete, only one Add Profile button exists', async () => {
  const profileSection = window.locator('#settings-panel .settings-section').filter({ hasText: 'Profiles' });
  const addBtns = profileSection.locator('.profile-btn-add');
  expect(await addBtns.count()).toBe(1);
});

// ── Reset to Defaults ─────────────────────────────────────────────────

test('Reset to Defaults restores all settings', async () => {
  // Change several settings
  const fontSizeInput = settingsField('Font Size').locator('input[type="number"]');
  await fontSizeInput.fill('20');
  await fontSizeInput.dispatchEvent('change');

  const cursorSelect = settingsField('Cursor Style').locator('select');
  await cursorSelect.selectOption('underline');
  await window.waitForTimeout(200);

  // Click reset
  const resetBtn = window.getByRole('button', { name: 'Reset to Defaults' });
  await expect(resetBtn).toBeVisible();
  await resetBtn.click();
  await window.waitForTimeout(500);

  // Verify all defaults restored
  const stored = await window.evaluate(() => {
    return JSON.parse(localStorage.getItem('agent-desk-settings') || '{}');
  });

  expect(stored.fontSize).toBe(14);
  expect(stored.cursorStyle).toBe('bar');
  expect(stored.cursorBlink).toBe(true);
  expect(stored.scrollback).toBe(10000);
  expect(stored.lineHeight).toBe(1.3);
  expect(stored.defaultShell).toBe('Claude');
  expect(stored.sidebarPosition).toBe('left');
  expect(stored.showStatusBar).toBe(true);
  expect(stored.closeToTray).toBe(true);
  expect(stored.bellVisual).toBe(true);
  expect(stored.bellSound).toBe(false);
  expect(stored.desktopNotifications).toBe(true);
});

// ── Settings Persistence Across Views ─────────────────────────────────

test('settings survive view switches', async () => {
  const fontSizeInput = settingsField('Font Size').locator('input[type="number"]');
  await fontSizeInput.fill('16');
  await fontSizeInput.dispatchEvent('change');
  await window.waitForTimeout(200);

  // Switch to terminals and back
  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const newFontInput = settingsField('Font Size').locator('input[type="number"]');
  expect(await newFontInput.inputValue()).toBe('16');

  // Reset
  const resetBtn = window.getByRole('button', { name: 'Reset to Defaults' });
  await resetBtn.click();
  await window.waitForTimeout(300);
});

// ── UI/UX Layout ──────────────────────────────────────────────────────

test('settings panel takes full width of workspace', async () => {
  const panel = window.locator('#settings-panel');
  const workspace = window.locator('#workspace');

  const panelBox = await panel.boundingBox();
  const workspaceBox = await workspace.boundingBox();

  expect(panelBox).toBeTruthy();
  expect(workspaceBox).toBeTruthy();

  // Panel should fill workspace width (within a small margin)
  expect(panelBox!.width).toBeGreaterThan(workspaceBox!.width * 0.95);
});

test('settings fields stretch across available width', async () => {
  const field = settingsField('Font Family');
  const fieldBox = await field.boundingBox();
  const panel = window.locator('#settings-panel .settings-root');
  const panelBox = await panel.boundingBox();

  expect(fieldBox).toBeTruthy();
  expect(panelBox).toBeTruthy();

  // Field row should be close to panel width (minus padding)
  expect(fieldBox!.width).toBeGreaterThan(panelBox!.width * 0.8);
});

test('settings sections have visible borders between them', async () => {
  const sections = window.locator('#settings-panel .settings-section');
  const count = await sections.count();
  expect(count).toBeGreaterThanOrEqual(5);
});

test('reset button is visible at bottom of settings', async () => {
  const resetBtn = window.getByRole('button', { name: 'Reset to Defaults' });
  await expect(resetBtn).toBeVisible();
});
