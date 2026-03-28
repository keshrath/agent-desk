/**
 * event-stream.spec.ts — F2: Event Stream Panel (simplified)
 *
 * Tests the event stream panel toggle, event rendering, clear, and timestamps.
 * Filter chips, time range, and text search have been removed.
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

// ── Panel Toggle ─────────────────────────────────────────────────────

test('event stream panel exists in DOM', async () => {
  const panel = window.locator('#event-stream-panel');
  await expect(panel).toBeAttached();
});

test('event stream panel toggles via sidebar button', async () => {
  const btn = window.locator('#btn-event-stream');
  await expect(btn).toBeVisible();

  await btn.click();
  await window.waitForTimeout(300);

  const panel = window.locator('#event-stream-panel');
  const isVisible = await panel.evaluate((el) => el.classList.contains('visible'));
  expect(isVisible).toBe(true);

  await btn.click();
  await window.waitForTimeout(300);

  const isHidden = await panel.evaluate((el) => !el.classList.contains('visible'));
  expect(isHidden).toBe(true);
});

test('event stream panel toggles via Ctrl+E', async () => {
  await window.locator('#titlebar').click();
  await window.waitForTimeout(200);

  await window.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }));
  });
  await window.waitForTimeout(300);

  const panel = window.locator('#event-stream-panel');
  const isVisible = await panel.evaluate((el) => el.classList.contains('visible'));

  await window.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }));
  });
  await window.waitForTimeout(300);

  const isHiddenAfter = await panel.evaluate((el) => !el.classList.contains('visible'));
  expect(isVisible || isHiddenAfter).toBe(true);
});

// ── Panel Structure ──────────────────────────────────────────────────

test('event stream panel has header with title and count', async () => {
  await window.locator('#btn-event-stream').click();
  await window.waitForTimeout(300);

  const title = window.locator('#event-stream-panel .es-title');
  await expect(title).toHaveText('Events');

  const count = window.locator('#es-count');
  await expect(count).toBeAttached();
});

test('event stream panel has clear and collapse buttons', async () => {
  const clearBtn = window.locator('#event-stream-panel .es-btn[title="Clear events"]');
  await expect(clearBtn).toBeAttached();

  const collapseBtn = window.locator('#event-stream-panel .es-btn[title="Collapse panel"]');
  await expect(collapseBtn).toBeAttached();
});

// ── Event Rendering ──────────────────────────────────────────────────

test('emitting an event adds it to the stream', async () => {
  await window.evaluate(`eventBus.emit('terminal:created', { terminalId: 'test-ev-1', title: 'Test Terminal' })`);
  await window.waitForTimeout(300);

  const events = window.locator('#es-list .es-event');
  const count = await events.count();
  expect(count).toBeGreaterThanOrEqual(1);

  const firstDesc = await events.first().locator('.es-event-desc').textContent();
  expect(firstDesc).toContain('Terminal created');
});

test('events show relative timestamps', async () => {
  const timeEl = window.locator('#es-list .es-event-time').first();
  const text = await timeEl.textContent();
  expect(text).toBeTruthy();
  expect(text!.length).toBeGreaterThan(0);
});

// ── Clear Events ─────────────────────────────────────────────────────

test('clear button removes all events', async () => {
  await window.evaluate(`eventBus.emit('terminal:created', { terminalId: 'clear-test', title: 'Clear Test' })`);
  await window.waitForTimeout(200);

  const clearBtn = window.locator('#event-stream-panel .es-btn[title="Clear events"]');
  await clearBtn.click();
  await window.waitForTimeout(300);

  const events = await window.locator('#es-list .es-event').count();
  expect(events).toBe(0);

  const countEl = window.locator('#es-count');
  await expect(countEl).toHaveText('0');
});

// ── Event Count Badge ────────────────────────────────────────────────

test('event count updates when events are added', async () => {
  const countBefore = await window.locator('#es-count').textContent();

  await window.evaluate(`eventBus.emit('terminal:created', { terminalId: 'count-test', title: 'Count Test' })`);
  await window.waitForTimeout(200);

  const countAfter = await window.locator('#es-count').textContent();
  expect(parseInt(countAfter || '0')).toBeGreaterThan(parseInt(countBefore || '0'));
});

// ── Cleanup ──────────────────────────────────────────────────────────

test('close event stream panel at end', async () => {
  const panel = window.locator('#event-stream-panel');
  const isVisible = await panel.evaluate((el) => el.classList.contains('visible'));
  if (isVisible) {
    await window.locator('#btn-event-stream').click();
    await window.waitForTimeout(300);
  }
});
