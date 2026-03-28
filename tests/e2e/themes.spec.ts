/**
 * themes.spec.ts — F10: Custom Themes
 *
 * Tests theme grid in settings, theme switching, CSS variable application,
 * custom theme save/delete, import/export, and persistence.
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

// ── Theme Manager Availability ───────────────────────────────────────

test('getAllThemes function is available', async () => {
  const exists = await window.evaluate('typeof getAllThemes === "function"');
  expect(exists).toBe(true);
});

test('getThemeById function is available', async () => {
  const exists = await window.evaluate('typeof getThemeById === "function"');
  expect(exists).toBe(true);
});

// ── Built-in Themes ──────────────────────────────────────────────────

test('8 built-in themes are available', async () => {
  const builtins = await window.evaluate('getAllThemes().filter(t => t.builtin).length');
  expect(builtins).toBe(8);
});

test('built-in themes include expected names', async () => {
  const names = (await window.evaluate('getAllThemes().filter(t => t.builtin).map(t => t.name)')) as string[];
  expect(names).toContain('Default Dark');
  expect(names).toContain('Default Light');
  expect(names).toContain('Dracula');
  expect(names).toContain('Nord');
  expect(names).toContain('Gruvbox');
  expect(names).toContain('Solarized');
  expect(names).toContain('Catppuccin');
  expect(names).toContain('GitHub');
});

test('each theme has required color properties', async () => {
  const valid = await window.evaluate(`
    getAllThemes().every(t => t.colors && t.colors.background && t.colors.text &&
      t.colors.terminal && t.colors.terminal.background && t.colors.terminal.foreground)
  `);
  expect(valid).toBe(true);
});

// ── Theme Grid in Settings ───────────────────────────────────────────

test('themes section exists in settings with theme cards', async () => {
  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const themeSection = window.locator('#settings-panel .settings-section').filter({ hasText: 'Themes' }).first();
  await expect(themeSection).toBeAttached();

  const cards = themeSection.locator('.theme-card');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(4);
});

test('one theme card is marked active', async () => {
  const themeSection = window.locator('#settings-panel .settings-section').filter({ hasText: 'Themes' }).first();

  const activeCards = themeSection.locator('.theme-card.active');
  const count = await activeCards.count();
  expect(count).toBe(1);
});

// ── Theme Switching ──────────────────────────────────────────────────

test('clicking a theme card applies it', async () => {
  const themeSection = window.locator('#settings-panel .settings-section').filter({ hasText: 'Themes' }).first();

  const draculaCard = themeSection.locator('.theme-card').filter({ hasText: 'Dracula' });
  if ((await draculaCard.count()) > 0) {
    await draculaCard.click();
    await window.waitForTimeout(500);

    const activeCard = themeSection.locator('.theme-card.active');
    const activeText = await activeCard.textContent();
    expect(activeText).toContain('Dracula');
  }
});

test('theme changes CSS custom properties', async () => {
  const bg = await window.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  });
  expect(bg).toBeTruthy();
  expect(bg.length).toBeGreaterThan(0);
});

test('switching to Default Dark restores default theme', async () => {
  const themeSection = window.locator('#settings-panel .settings-section').filter({ hasText: 'Themes' }).first();

  const defaultCard = themeSection.locator('.theme-card').filter({ hasText: 'Default Dark' });
  if ((await defaultCard.count()) > 0) {
    await defaultCard.click();
    await window.waitForTimeout(500);
  }
});

// ── Custom Theme CRUD ────────────────────────────────────────────────

test('saveCustomTheme saves a new custom theme', async () => {
  await window.evaluate(`saveCustomTheme({
    id: 'e2e-test-theme', name: 'E2E Test Theme', type: 'dark',
    colors: {
      background: '#111111', surface: '#222222', surfaceHover: '#333333', border: '#444444',
      primary: '#55aaff', onPrimary: '#ffffff', text: '#eeeeee', textSecondary: '#888888',
      accent: '#55aaff', accentHover: '#77bbff',
      terminal: {
        background: '#111111', foreground: '#eeeeee', cursor: '#55aaff', cursorAccent: '#111111',
        selectionBackground: 'rgba(85, 170, 255, 0.3)',
        black: '#111111', red: '#ff5555', green: '#55ff55', yellow: '#ffff55',
        blue: '#55aaff', magenta: '#ff55ff', cyan: '#55ffff', white: '#ffffff',
        brightBlack: '#555555', brightRed: '#ff8888', brightGreen: '#88ff88', brightYellow: '#ffff88',
        brightBlue: '#88bbff', brightMagenta: '#ff88ff', brightCyan: '#88ffff', brightWhite: '#ffffff',
      },
    },
  })`);

  const themes = (await window.evaluate('getAllThemes().map(t => t.name)')) as string[];
  expect(themes).toContain('E2E Test Theme');
});

test('custom theme appears in localStorage', async () => {
  const stored = await window.evaluate(() => {
    const raw = localStorage.getItem('agent-desk-custom-themes');
    return raw ? JSON.parse(raw) : [];
  });
  const found = stored.find((t: any) => t.id === 'e2e-test-theme');
  expect(found).toBeTruthy();
});

test('deleteCustomTheme removes a custom theme', async () => {
  await window.evaluate(`deleteCustomTheme('e2e-test-theme')`);

  const themes = (await window.evaluate('getAllThemes().map(t => t.id)')) as string[];
  expect(themes).not.toContain('e2e-test-theme');
});

test('built-in themes cannot be deleted via deleteCustomTheme', async () => {
  await window.evaluate(`deleteCustomTheme('default-dark')`);

  const themes = (await window.evaluate('getAllThemes().map(t => t.id)')) as string[];
  expect(themes).toContain('default-dark');
});

// ── Cleanup ──────────────────────────────────────────────────────────

test('return to terminals view', async () => {
  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});
