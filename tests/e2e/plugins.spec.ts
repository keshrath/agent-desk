/**
 * Plugin views E2E.
 *
 * Launches the Electron app via the existing helpers and verifies that all
 * four agent-* plugin views (comm, tasks, knowledge, discover) load and respond
 * inside the host. Each view is switched to via its sidebar nav button (more
 * stable than keybindings, which are user-customizable), the plugin's global
 * is awaited (`window.AC` / `window.TaskBoard` / `window.Knowledge` / `window.AD`),
 * the wrapper inside the shadow DOM is asserted to render, and a screenshot is
 * captured into ~/.claude/tmp.
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { buildApp, launchApp, closeApp } from './helpers.js';

interface PluginView {
  key: 'comm' | 'tasks' | 'knowledge' | 'discover';
  globalName: 'AC' | 'TaskBoard' | 'Knowledge' | 'AD';
  containerId: string;
  wrapperClass: string;
}

const VIEWS: PluginView[] = [
  { key: 'comm', globalName: 'AC', containerId: 'view-comm', wrapperClass: '.ac-wrapper' },
  { key: 'tasks', globalName: 'TaskBoard', containerId: 'view-tasks', wrapperClass: '.tb-wrapper' },
  {
    key: 'knowledge',
    globalName: 'Knowledge',
    containerId: 'view-knowledge',
    wrapperClass: '.ak-wrapper',
  },
  { key: 'discover', globalName: 'AD', containerId: 'view-discover', wrapperClass: '.ad-wrapper' },
];

let app: ElectronApplication;
let window: Page;
const consoleErrors: { view: string; text: string }[] = [];
let currentView = 'init';

test.beforeAll(async () => {
  buildApp();
  const launched = await launchApp();
  app = launched.app;
  window = launched.window;

  window.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ view: currentView, text: msg.text() });
    }
  });

  // Confirm the renderer booted: sidebar must exist.
  await window.waitForSelector('.nav-btn[data-view="terminals"]', { timeout: 15_000 });
});

test.afterAll(async () => {
  if (app) await closeApp(app);
});

test.describe('agent-desk plugin views', () => {
  for (const view of VIEWS) {
    test(`plugin view "${view.key}" mounts and renders`, async () => {
      currentView = view.key;
      const errorsBefore = consoleErrors.length;

      // Click the sidebar nav button — more stable than the configurable keybind.
      await window.click(`.nav-btn[data-view="${view.key}"]`);

      // Wait for the container to become active.
      await expect(window.locator(`#${view.containerId}`)).toHaveClass(/\bactive\b/, {
        timeout: 10_000,
      });

      // The plugin script registers its global once loaded.
      await window.waitForFunction(
        (name: string) => (window as unknown as Record<string, unknown>)[name] !== undefined,
        view.globalName,
        { timeout: 15_000 },
      );

      // The plugin mounts its UI inside the container's shadow root (or directly
      // into the container as a fallback). Wait until the wrapper is present.
      await window.waitForFunction(
        ({ id, cls }: { id: string; cls: string }) => {
          const el = document.getElementById(id);
          if (!el) return false;
          const root = (el.shadowRoot as ShadowRoot | null) ?? el;
          return !!root.querySelector(cls);
        },
        { id: view.containerId, cls: view.wrapperClass },
        { timeout: 15_000 },
      );

      // Wrapper has visible content.
      const hasContent = await window.evaluate(
        ({ id, cls }: { id: string; cls: string }) => {
          const el = document.getElementById(id);
          if (!el) return false;
          const root = (el.shadowRoot as ShadowRoot | null) ?? el;
          const wrapper = root.querySelector(cls) as HTMLElement | null;
          if (!wrapper) return false;
          const rect = wrapper.getBoundingClientRect();
          return wrapper.children.length > 0 && rect.height > 0 && rect.width > 0;
        },
        { id: view.containerId, cls: view.wrapperClass },
      );
      expect(hasContent).toBe(true);

      // Screenshot the loaded view.
      const dir = join(homedir(), '.claude', 'tmp');
      mkdirSync(dir, { recursive: true });
      await window.screenshot({ path: join(dir, `e2e-agent-desk-${view.key}.png`), fullPage: true });

      // No new console errors while this view was active.
      const newErrors = consoleErrors
        .slice(errorsBefore)
        .map((e) => e.text)
        .filter((t) => !/favicon|404|DevTools|Autofill|Electron Security Warning/i.test(t));
      expect(newErrors).toEqual([]);
    });
  }
});
