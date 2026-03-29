/**
 * event-stream.spec.ts -- Event Stream Panel
 *
 * Tests the event stream panel toggle, event rendering,
 * clear, timestamps, and count badge.
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

test('event stream panel toggles via sidebar button', async () => {
  const btn = window.locator('#btn-event-stream');
  await expect(btn).toBeVisible();

  await btn.click();
  await window.waitForTimeout(300);

  const panel = window.locator('#event-stream-panel');
  expect(await panel.evaluate((el) => el.classList.contains('visible'))).toBe(true);

  await expect(panel.locator('.es-title')).toHaveText('Events');
  await expect(panel.locator('#es-count')).toBeAttached();
  await expect(panel.locator('.es-btn[title="Clear events"]')).toBeAttached();
  await expect(panel.locator('.es-btn[title="Collapse panel"]')).toBeAttached();
});

test('emitting an event adds it to the stream with timestamp', async () => {
  await window.evaluate(`eventBus.emit('terminal:created', { terminalId: 'test-ev-1', title: 'Test Terminal' })`);
  await window.waitForTimeout(300);

  const events = window.locator('#es-list .es-event');
  expect(await events.count()).toBeGreaterThanOrEqual(1);

  const firstDesc = await events.first().locator('.es-event-desc').textContent();
  expect(firstDesc).toContain('Terminal created');

  const timeText = await events.first().locator('.es-event-time').textContent();
  expect(timeText).toBeTruthy();
  expect(timeText!.length).toBeGreaterThan(0);
});

test('clear button removes all events and resets count', async () => {
  await window.evaluate(`eventBus.emit('terminal:created', { terminalId: 'clear-test', title: 'Clear Test' })`);
  await window.waitForTimeout(200);

  await window.locator('#event-stream-panel .es-btn[title="Clear events"]').click();
  await window.waitForTimeout(300);

  expect(await window.locator('#es-list .es-event').count()).toBe(0);
  await expect(window.locator('#es-count')).toHaveText('0');
});

test('event count updates when events are added', async () => {
  const countBefore = parseInt((await window.locator('#es-count').textContent()) || '0');

  await window.evaluate(`eventBus.emit('terminal:created', { terminalId: 'count-test', title: 'Count Test' })`);
  await window.waitForTimeout(200);

  const countAfter = parseInt((await window.locator('#es-count').textContent()) || '0');
  expect(countAfter).toBeGreaterThan(countBefore);

  await window.locator('#btn-event-stream').click();
  await window.waitForTimeout(300);
});
