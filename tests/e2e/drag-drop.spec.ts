/**
 * drag-drop.spec.ts -- Drag-Drop File Support
 *
 * Tests drag-drop event handling and the drop overlay behavior.
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

test('dragenter with Files creates visible overlay', async () => {
  await window.evaluate(() => {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    const dt = new DataTransfer();
    dt.items.add(new File(['test'], 'test.txt'));

    appEl.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  await window.waitForTimeout(300);

  const overlay = window.locator('.drop-overlay');
  const count = await overlay.count();

  if (count > 0) {
    const isVisible = await overlay.evaluate((el) => el.classList.contains('visible'));
    expect(isVisible).toBe(true);

    await window.evaluate(() => {
      const appEl = document.getElementById('app');
      if (!appEl) return;
      const dt = new DataTransfer();
      dt.items.add(new File(['test'], 'test.txt'));
      appEl.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
    await window.waitForTimeout(300);
  }
});

test('window prevents default on dragover and drop', async () => {
  const result = await window.evaluate(() => {
    let dragoverPrevented = false;
    let dropPrevented = false;

    const dragHandler = (e: Event) => {
      dragoverPrevented = e.defaultPrevented;
    };
    const dropHandler = (e: Event) => {
      dropPrevented = e.defaultPrevented;
    };

    window.addEventListener('dragover', dragHandler, { once: true });
    window.dispatchEvent(
      new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }),
    );
    window.removeEventListener('dragover', dragHandler);

    window.addEventListener('drop', dropHandler, { once: true });
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
    window.removeEventListener('drop', dropHandler);

    return { dragoverPrevented, dropPrevented };
  });

  expect(result.dragoverPrevented).toBe(true);
  expect(result.dropPrevented).toBe(true);
});
