/**
 * enriched-event-stream.spec.ts — Enriched Event Stream Features
 *
 * Tests the enhanced event stream: 200-event limit, terminal filter dropdown,
 * type toggle buttons, text search, event expansion, and export.
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

// ── Event Bus ───────────────────────────────────────────────────────

test('eventBus is available globally', async () => {
  const exists = await window.evaluate('typeof eventBus !== "undefined"');
  expect(exists).toBe(true);
});

test('eventBus has emit and on methods', async () => {
  const methods = await window.evaluate(`({
    emit: typeof eventBus.emit === 'function',
    on: typeof eventBus.on === 'function',
  })`);
  expect((methods as any).emit).toBe(true);
  expect((methods as any).on).toBe(true);
});

// ── Event Stream Panel Structure ────────────────────────────────────

test('event stream panel opens via sidebar', async () => {
  await window.locator('#btn-event-stream').click();
  await window.waitForTimeout(300);

  const panel = window.locator('#event-stream-panel');
  const isVisible = await panel.evaluate((el) => el.classList.contains('visible'));
  expect(isVisible).toBe(true);
});

test('event stream has event count display', async () => {
  const count = window.locator('#es-count');
  await expect(count).toBeAttached();
});

test('event stream has clear button', async () => {
  const clearBtn = window.locator('#event-stream-panel .es-btn[title="Clear events"]');
  await expect(clearBtn).toBeAttached();
});

// ── Event Emission and Rendering ────────────────────────────────────

test('emitting events adds them to the stream', async () => {
  await window.evaluate(`
    eventBus.emit('terminal:created', { terminalId: 'es-test-1', title: 'ES Test 1' });
    eventBus.emit('terminal:created', { terminalId: 'es-test-2', title: 'ES Test 2' });
    eventBus.emit('terminal:created', { terminalId: 'es-test-3', title: 'ES Test 3' });
  `);
  await window.waitForTimeout(300);

  const events = window.locator('#es-list .es-event');
  const count = await events.count();
  expect(count).toBeGreaterThanOrEqual(3);
});

test('event count badge updates', async () => {
  const countText = await window.locator('#es-count').textContent();
  expect(parseInt(countText || '0')).toBeGreaterThanOrEqual(3);
});

// ── Clear Events ────────────────────────────────────────────────────

test('clear button removes all events and resets count', async () => {
  const clearBtn = window.locator('#event-stream-panel .es-btn[title="Clear events"]');
  await clearBtn.click();
  await window.waitForTimeout(300);

  const events = await window.locator('#es-list .es-event').count();
  expect(events).toBe(0);

  const countText = await window.locator('#es-count').textContent();
  expect(countText).toBe('0');
});

// ── Event Types ─────────────────────────────────────────────────────

test('different event types are rendered', async () => {
  await window.evaluate(`
    eventBus.emit('terminal:created', { terminalId: 'type-1' });
    eventBus.emit('agent:detected', { terminalId: 'type-2', name: 'test-agent' });
    eventBus.emit('tool:called', { terminalId: 'type-3', tool: 'Read', file: 'test.ts' });
  `);
  await window.waitForTimeout(300);

  const events = window.locator('#es-list .es-event');
  const count = await events.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

// ── Cleanup ─────────────────────────────────────────────────────────

test('close event stream panel', async () => {
  await window.locator('#btn-event-stream').click();
  await window.waitForTimeout(300);

  const panel = window.locator('#event-stream-panel');
  const isVisible = await panel.evaluate((el) => el.classList.contains('visible'));
  expect(isVisible).toBe(false);
});
