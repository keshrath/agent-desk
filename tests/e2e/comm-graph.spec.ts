/**
 * comm-graph.spec.ts -- Communication Graph
 *
 * Tests the canvas-based agent communication graph panel:
 * open, structure, toggle, close button, and destroy.
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

test('comm graph panel opens with header, canvas, and close button', async () => {
  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.showCommGraph();
  });
  await window.waitForTimeout(500);

  await expect(window.locator('.comm-graph-panel')).toBeAttached();
  await expect(window.locator('.comm-graph-title')).toHaveText('Agent Communication');
  await expect(window.locator('.comm-graph-close')).toBeAttached();

  const dimensions = await window.evaluate(() => {
    const canvas = document.querySelector('.comm-graph-canvas') as HTMLCanvasElement;
    return canvas ? { width: canvas.width, height: canvas.height } : null;
  });
  expect(dimensions).not.toBeNull();
  expect(dimensions!.width).toBeGreaterThan(0);
  expect(dimensions!.height).toBeGreaterThan(0);
});

test('calling showCommGraph again hides the panel', async () => {
  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.showCommGraph();
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
    (window as any).__agentDeskRegistry.showCommGraph();
  });
  await window.waitForTimeout(300);

  await window.locator('.comm-graph-close').click();
  await window.waitForTimeout(300);

  const isHidden = await window.evaluate(() => {
    const panel = document.querySelector('.comm-graph-panel');
    return panel ? panel.classList.contains('comm-graph-hidden') : true;
  });
  expect(isHidden).toBe(true);
});

test('destroyCommGraph removes the panel from DOM', async () => {
  await window.evaluate(() => {
    (window as any).__agentDeskRegistry.destroyCommGraph();
  });
  await window.waitForTimeout(200);
  expect(await window.locator('.comm-graph-panel').count()).toBe(0);
});
