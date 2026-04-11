/**
 * ui-tour.spec.ts — Throwaway exploratory tour of every sidebar view.
 *
 * Launches the app, walks every sidebar button + Ctrl+N keybind, screenshots
 * each view, collects console errors, and saves the output to
 * ~/.claude/tmp/agent-desk-ui-tour/ so the lead can review UX coherence after
 * the #93 feature landing. NOT part of the CI suite — delete after review.
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { buildApp, launchApp, closeApp } from './helpers';
import { mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

let app: ElectronApplication;
let window: Page;
const outDir = join(homedir(), '.claude', 'tmp', 'agent-desk-ui-tour');
const consoleLog: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  mkdirSync(outDir, { recursive: true });
  buildApp();
  ({ app, window } = await launchApp());
  window.on('console', (msg) => {
    consoleLog.push(`[${msg.type()}] ${msg.text()}`);
  });
  window.on('pageerror', (err) => {
    consoleLog.push(`[pageerror] ${err.message}\n${err.stack || '(no stack)'}`);
  });
});

test.afterAll(async () => {
  writeFileSync(join(outDir, 'console.log'), consoleLog.join('\n'), 'utf-8');
  if (app) await closeApp(app);
});

test('initial state after boot', async () => {
  await window.waitForTimeout(1500);
  await window.screenshot({ path: join(outDir, '00-initial.png'), fullPage: true });
});

test('sidebar + top-level dom inventory', async () => {
  const inventory = await window.evaluate(() => {
    const sidebar = document.querySelector('#sidebar, .sidebar, [class*="sidebar"]');
    const sidebarButtons = Array.from(
      document.querySelectorAll(
        '#sidebar button, .sidebar button, .sidebar-item, .sidebar-btn, [class*="sidebar"] button',
      ),
    ).map((b) => ({
      text: (b.textContent || '').trim().slice(0, 40),
      title: b.getAttribute('title') || '',
      ariaLabel: b.getAttribute('aria-label') || '',
      dataView: b.getAttribute('data-view') || '',
      id: b.id || '',
    }));
    const topLevelIds = Array.from(document.body.querySelectorAll('[id]'))
      .slice(0, 60)
      .map((e) => e.id);
    return { sidebarFound: !!sidebar, sidebarButtons, topLevelIds };
  });
  writeFileSync(join(outDir, 'inventory.json'), JSON.stringify(inventory, null, 2), 'utf-8');
  expect(inventory.sidebarFound).toBe(true);
});

test('Ctrl+1 terminals view', async () => {
  await window.keyboard.press('Control+1');
  await window.waitForTimeout(800);
  await window.screenshot({ path: join(outDir, '01-terminals.png'), fullPage: true });
});

test('Ctrl+2 agent comm view', async () => {
  await window.keyboard.press('Control+2');
  await window.waitForTimeout(1500);
  await window.screenshot({ path: join(outDir, '02-comm.png'), fullPage: true });
});

test('Ctrl+3 agent tasks view', async () => {
  await window.keyboard.press('Control+3');
  await window.waitForTimeout(1500);
  await window.screenshot({ path: join(outDir, '03-tasks.png'), fullPage: true });
});

test('Ctrl+4 agent knowledge view', async () => {
  await window.keyboard.press('Control+4');
  await window.waitForTimeout(1500);
  await window.screenshot({ path: join(outDir, '04-knowledge.png'), fullPage: true });
});

test('Ctrl+5 agent discover view', async () => {
  await window.keyboard.press('Control+5');
  await window.waitForTimeout(1500);
  await window.screenshot({ path: join(outDir, '05-discover.png'), fullPage: true });
});

test('Ctrl+6 event stream', async () => {
  await window.keyboard.press('Control+6');
  await window.waitForTimeout(800);
  await window.screenshot({ path: join(outDir, '06-events.png'), fullPage: true });
});

test('Ctrl+7 settings', async () => {
  await window.keyboard.press('Control+7');
  await window.waitForTimeout(1200);
  await window.screenshot({ path: join(outDir, '07-settings.png'), fullPage: true });
});

test('no agent-monitor nav button or view remains', async () => {
  const found = await window.evaluate(() => {
    const navBtn = document.querySelector('.nav-btn[data-view="monitor"]');
    const viewEl = document.getElementById('view-monitor');
    return { navBtn: !!navBtn, viewEl: !!viewEl };
  });
  expect(found.navBtn).toBe(false);
  expect(found.viewEl).toBe(false);
});

test('workspace switcher dropdown (titlebar)', async () => {
  // Click the workspace switcher if present
  const sw = window.locator(
    '[class*="workspace-switcher"], [id*="workspace-switcher"], button:has-text("Workspace")',
  );
  if ((await sw.count()) > 0) {
    await sw.first().click();
    await window.waitForTimeout(600);
    await window.screenshot({ path: join(outDir, '09-workspace-switcher.png'), fullPage: true });
    await window.keyboard.press('Escape');
  }
});

test('Ctrl+Shift+W save workspace dialog', async () => {
  await window.keyboard.press('Control+Shift+W');
  await window.waitForTimeout(800);
  await window.screenshot({ path: join(outDir, '10-save-workspace.png'), fullPage: true });
  await window.keyboard.press('Escape');
});

test('git sidebar presence check', async () => {
  const gitSidebar = window.locator('.git-sidebar, [class*="git-sidebar"], #git-sidebar');
  const count = await gitSidebar.count();
  const visible = count > 0 ? await gitSidebar.first().isVisible().catch(() => false) : false;
  writeFileSync(
    join(outDir, 'git-sidebar-state.json'),
    JSON.stringify({ count, visible }, null, 2),
    'utf-8',
  );
  await window.screenshot({ path: join(outDir, '11-git-sidebar-state.png'), fullPage: true });
});

test('final console error dump', async () => {
  // Nothing to do here — afterAll writes the console log.
  expect(consoleLog.length).toBeGreaterThanOrEqual(0);
});
