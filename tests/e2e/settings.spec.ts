/**
 * settings.spec.ts -- Settings panel E2E tests
 *
 * Tests settings panel structure, field changes with persistence,
 * profile CRUD workflow, and reset to defaults.
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

function settingsField(label: string) {
  return window.locator('#settings-panel .settings-field').filter({ hasText: label });
}

// -- Structure --

test('settings panel renders with all expected sections', async () => {
  const panel = window.locator('#settings-panel');
  await expect(panel).toHaveClass(/active/);

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

// -- Terminal settings: change and persist workflow --

test('changing font size and cursor style persists to localStorage', async () => {
  const fontSizeInput = settingsField('Font Size').locator('input[type="number"]');
  await fontSizeInput.fill('18');
  await fontSizeInput.dispatchEvent('change');
  await window.waitForTimeout(200);

  const cursorSelect = settingsField('Cursor Style').locator('select');
  await cursorSelect.selectOption('block');
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => {
    return JSON.parse(localStorage.getItem('agent-desk-settings') || '{}');
  });
  expect(stored.fontSize).toBe(18);
  expect(stored.cursorStyle).toBe('block');

  await fontSizeInput.fill('14');
  await fontSizeInput.dispatchEvent('change');
  await cursorSelect.selectOption('bar');
  await window.waitForTimeout(200);
});

test('font size is clamped to min/max bounds', async () => {
  const input = settingsField('Font Size').locator('input[type="number"]');

  // Below min
  await input.fill('5');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);
  let stored = await window.evaluate(() => JSON.parse(localStorage.getItem('agent-desk-settings') || '{}'));
  expect(stored.fontSize).toBe(10);

  // Above max
  await input.fill('50');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);
  stored = await window.evaluate(() => JSON.parse(localStorage.getItem('agent-desk-settings') || '{}'));
  expect(stored.fontSize).toBe(24);

  // Reset
  await input.fill('14');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);
});

test('toggle fields persist correctly', async () => {
  // Toggle cursor blink off
  const cursorBlinkToggle = settingsField('Cursor Blink').locator('.settings-toggle');
  await cursorBlinkToggle.click();
  await window.waitForTimeout(200);

  // Toggle bell sound on
  const bellSoundToggle = settingsField('Bell Sound (system beep)').locator('.settings-toggle');
  await bellSoundToggle.click();
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => JSON.parse(localStorage.getItem('agent-desk-settings') || '{}'));
  expect(stored.cursorBlink).toBe(false);
  expect(stored.bellSound).toBe(true);

  // Reset
  await cursorBlinkToggle.click();
  await bellSoundToggle.click();
  await window.waitForTimeout(200);
});

// -- Dashboard URLs --

test('dashboard URL defaults are correct and changes persist', async () => {
  expect(await settingsField('Agent Comm URL').locator('input').inputValue()).toBe('http://localhost:3421');
  expect(await settingsField('Agent Tasks URL').locator('input').inputValue()).toBe('http://localhost:3422');
  expect(await settingsField('Agent Knowledge URL').locator('input').inputValue()).toBe('http://localhost:3423');

  const input = settingsField('Agent Comm URL').locator('input');
  await input.fill('http://localhost:9999');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);

  const stored = await window.evaluate(() => JSON.parse(localStorage.getItem('agent-desk-settings') || '{}'));
  expect(stored.agentCommUrl).toBe('http://localhost:9999');

  await input.fill('http://localhost:3421');
  await input.dispatchEvent('change');
  await window.waitForTimeout(200);
});

// -- Profile CRUD workflow --

test('profile CRUD: create, verify, delete', async () => {
  // Verify defaults exist
  const namesBefore = await window.locator('#settings-panel .profile-name').allTextContents();
  expect(namesBefore).toContain('Default Shell');
  expect(namesBefore).toContain('Claude');

  const profileSection = window.locator('#settings-panel .settings-section').filter({ hasText: 'Profiles' });
  await profileSection.locator('.profile-btn-add').click();
  await window.waitForTimeout(300);

  const form = window.locator('#settings-panel .profile-form');
  await expect(form).toBeVisible();

  await form.locator('input').first().fill('My Test Profile');
  await form.locator('input').nth(1).fill('node');
  await form.locator('.profile-btn-save').click();
  await window.waitForTimeout(500);

  // Verify profile was added
  const namesAfter = await window.locator('#settings-panel .profile-name').allTextContents();
  expect(namesAfter).toContain('My Test Profile');

  // Verify custom profile has delete button
  const testRow = profileSection.locator('.profile-row').filter({ hasText: 'My Test Profile' });
  await expect(testRow.locator('button[title="Delete"]')).toBeVisible();

  await testRow.locator('button[title="Delete"]').click();
  await window.waitForTimeout(500);

  const namesDeleted = await window.locator('#settings-panel .profile-name').allTextContents();
  expect(namesDeleted).not.toContain('My Test Profile');
});

// -- Reset to Defaults --

test('Reset to Defaults restores all settings', async () => {
  // Change several settings
  await settingsField('Font Size').locator('input[type="number"]').fill('20');
  await settingsField('Font Size').locator('input[type="number"]').dispatchEvent('change');
  await settingsField('Cursor Style').locator('select').selectOption('underline');
  await window.waitForTimeout(200);

  // Reset
  await window.getByRole('button', { name: 'Reset to Defaults' }).click();
  await window.waitForTimeout(500);

  const stored = await window.evaluate(() => JSON.parse(localStorage.getItem('agent-desk-settings') || '{}'));
  expect(stored.fontSize).toBe(14);
  expect(stored.cursorStyle).toBe('bar');
  expect(stored.cursorBlink).toBe(true);
  expect(stored.sidebarPosition).toBe('left');
});

// -- Persistence across view switches --

test('settings survive view switches', async () => {
  await settingsField('Font Size').locator('input[type="number"]').fill('16');
  await settingsField('Font Size').locator('input[type="number"]').dispatchEvent('change');
  await window.waitForTimeout(200);

  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  expect(await settingsField('Font Size').locator('input[type="number"]').inputValue()).toBe('16');

  await window.getByRole('button', { name: 'Reset to Defaults' }).click();
  await window.waitForTimeout(300);
});
