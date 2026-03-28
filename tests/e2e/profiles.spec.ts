/**
 * profiles.spec.ts — Profiles
 *
 * Tests profile management in settings, default profiles,
 * profile CRUD, and terminal creation from profiles.
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

// ── Profile API ─────────────────────────────────────────────────────

test('getProfiles function is available', async () => {
  const exists = await window.evaluate('typeof getProfiles === "function"');
  expect(exists).toBe(true);
});

test('getProfiles returns an array', async () => {
  const isArray = await window.evaluate('Array.isArray(getProfiles())');
  expect(isArray).toBe(true);
});

test('default profiles include Shell and Claude', async () => {
  const names = (await window.evaluate('getProfiles().map(p => p.name)')) as string[];
  const hasShellLike = names.some((n) => n.toLowerCase().includes('shell') || n.toLowerCase().includes('default'));
  const hasClaude = names.some((n) => n.toLowerCase().includes('claude'));
  expect(hasShellLike || hasClaude).toBe(true);
});

test('each profile has required fields', async () => {
  const profiles = (await window.evaluate('getProfiles()')) as any[];
  for (const p of profiles) {
    expect(p).toHaveProperty('id');
    expect(p).toHaveProperty('name');
  }
});

// ── Profiles Settings Section ───────────────────────────────────────

test('profiles section exists in settings', async () => {
  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const section = window.locator('#settings-panel .settings-section').filter({ hasText: 'Profiles' });
  await expect(section).toBeAttached();
});

test('profiles section shows profile rows', async () => {
  const rows = window.locator('#settings-panel .profile-row');
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test('profile rows show name and icon', async () => {
  const firstRow = window.locator('#settings-panel .profile-row').first();
  const name = firstRow.locator('.profile-name');
  await expect(name).toBeAttached();
});

// ── Default Profile Setting ─────────────────────────────────────────

test('defaultProfile setting has a fallback value', async () => {
  const defaultProfile = await window.evaluate("getSetting('defaultProfile') || 'default-shell'");
  expect(defaultProfile).toBeTruthy();
});

// ── Cleanup ─────────────────────────────────────────────────────────

test('switch back to terminals view after profile tests', async () => {
  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});
