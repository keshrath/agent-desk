/**
 * comm-graph.spec.ts — Communication Graph
 *
 * Tests the canvas-based agent communication graph panel,
 * open/close toggle, and empty state rendering.
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

// ── Panel Open/Close ────────────────────────────────────────────────

test('showCommGraph function is available on registry', async () => {
  const exists = await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    return typeof r.showCommGraph === 'function';
  });
  expect(exists).toBe(true);
});

test('comm graph panel opens via registry', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showCommGraph) r.showCommGraph();
  });
  await window.waitForTimeout(500);

  const panel = window.locator('.comm-graph-panel');
  await expect(panel).toBeAttached();
});

test('comm graph panel has header with title', async () => {
  const title = window.locator('.comm-graph-title');
  await expect(title).toHaveText('Agent Communication');
});

test('comm graph panel has close button', async () => {
  const closeBtn = window.locator('.comm-graph-close');
  await expect(closeBtn).toBeAttached();
});

test('comm graph panel has canvas element', async () => {
  const canvas = window.locator('.comm-graph-canvas');
  await expect(canvas).toBeAttached();
});

test('canvas has dimensions set', async () => {
  const dimensions = await window.evaluate(() => {
    const canvas = document.querySelector('.comm-graph-canvas') as HTMLCanvasElement;
    if (!canvas) return null;
    return { width: canvas.width, height: canvas.height };
  });
  expect(dimensions).not.toBeNull();
  expect(dimensions!.width).toBeGreaterThan(0);
  expect(dimensions!.height).toBeGreaterThan(0);
});

// ── Toggle Behavior ─────────────────────────────────────────────────

test('calling showCommGraph again hides the panel', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showCommGraph) r.showCommGraph();
  });
  await window.waitForTimeout(300);

  const isHidden = await window.evaluate(() => {
    const panel = document.querySelector('.comm-graph-panel');
    return panel ? panel.classList.contains('comm-graph-hidden') : true;
  });
  expect(isHidden).toBe(true);
});

test('close button hides the panel', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.showCommGraph) r.showCommGraph();
  });
  await window.waitForTimeout(300);

  const closeBtn = window.locator('.comm-graph-close');
  await closeBtn.click();
  await window.waitForTimeout(300);

  const isHidden = await window.evaluate(() => {
    const panel = document.querySelector('.comm-graph-panel');
    return panel ? panel.classList.contains('comm-graph-hidden') : true;
  });
  expect(isHidden).toBe(true);
});

// ── Destroy ─────────────────────────────────────────────────────────

test('destroyCommGraph removes the panel from DOM', async () => {
  await window.evaluate(() => {
    const r = (window as any).__agentDeskRegistry;
    if (r && r.destroyCommGraph) r.destroyCommGraph();
  });
  await window.waitForTimeout(200);

  const panel = window.locator('.comm-graph-panel');
  const count = await panel.count();
  expect(count).toBe(0);
});
