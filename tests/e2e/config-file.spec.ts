/**
 * config-file.spec.ts — F6: Config File
 *
 * Tests config file existence, settings persistence to config,
 * config sections, version field, and profile changes persisting.
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

// ── Config API ───────────────────────────────────────────────────────

test('config API is available via agentDesk.config', async () => {
  const hasApi = await window.evaluate(() => {
    const ad = (window as any).agentDesk;
    return !!(ad && ad.config && ad.config.read && ad.config.write && ad.config.getPath);
  });
  expect(hasApi).toBe(true);
});

test('config file path resolves to ~/.agent-desk/config.json', async () => {
  const configPath = await window.evaluate(async () => {
    return await (window as any).agentDesk.config.getPath();
  });
  expect(configPath).toBeTruthy();
  expect(configPath).toContain('config.json');
  expect(configPath).toContain('.agent-desk');
});

test('config file can be read and contains data', async () => {
  const config = await window.evaluate(async () => {
    return await (window as any).agentDesk.config.read();
  });
  expect(config).toBeTruthy();
  expect(typeof config).toBe('object');
});

test('config file has version field', async () => {
  const config = await window.evaluate(async () => {
    return await (window as any).agentDesk.config.read();
  });
  expect(config).toBeTruthy();
  expect(config.version).toBeTruthy();
});

test('config file contains settings section', async () => {
  const config = await window.evaluate(async () => {
    return await (window as any).agentDesk.config.read();
  });
  expect(config.settings).toBeTruthy();
  expect(typeof config.settings).toBe('object');
});

test('config file contains profiles section', async () => {
  const config = await window.evaluate(async () => {
    return await (window as any).agentDesk.config.read();
  });
  expect(config.profiles).toBeTruthy();
  expect(Array.isArray(config.profiles)).toBe(true);
});

// ── Settings Persistence to Config ───────────────────────────────────

test('changing a setting writes to config file', async () => {
  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const fontSizeInput = window
    .locator('#settings-panel .settings-field')
    .filter({ hasText: 'Font Size' })
    .locator('input[type="number"]');

  await fontSizeInput.fill('16');
  await fontSizeInput.dispatchEvent('change');
  await window.waitForTimeout(1000);

  const config = await window.evaluate(async () => {
    return await (window as any).agentDesk.config.read();
  });

  expect(config.settings.fontSize).toBe(16);

  await fontSizeInput.fill('14');
  await fontSizeInput.dispatchEvent('change');
  await window.waitForTimeout(500);

  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});

test('config survives localStorage clear (reads from file)', async () => {
  await window.evaluate(() => {
    localStorage.removeItem('agent-desk-settings');
  });

  const config = await window.evaluate(async () => {
    return await (window as any).agentDesk.config.read();
  });

  expect(config).toBeTruthy();
  expect(config.settings).toBeTruthy();
  expect(config.settings.fontSize).toBeDefined();
});

// ── Config Sections ───────────────────────────────────────────────��──

test('config workspaces section exists', async () => {
  const config = await window.evaluate(async () => {
    return await (window as any).agentDesk.config.read();
  });
  expect(config).toHaveProperty('workspaces');
});

test('config can be written and read back', async () => {
  const original = await window.evaluate(async () => {
    return await (window as any).agentDesk.config.read();
  });

  const testValue = 'e2e-test-' + Date.now();
  await window.evaluate(async (val: string) => {
    const config = await (window as any).agentDesk.config.read();
    config._e2eTest = val;
    await (window as any).agentDesk.config.write(config);
  }, testValue);

  await window.waitForTimeout(500);

  const updated = await window.evaluate(async () => {
    return await (window as any).agentDesk.config.read();
  });

  expect(updated._e2eTest).toBe(testValue);

  await window.evaluate(async () => {
    const config = await (window as any).agentDesk.config.read();
    delete config._e2eTest;
    await (window as any).agentDesk.config.write(config);
  });
});
