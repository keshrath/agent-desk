/**
 * workspace.spec.ts — task #93a: project-centric workspace records.
 *
 * Exercises the new workspace:* channel bucket end-to-end through the
 * Electron window. We drive the flows via `window.agentDesk.workspace.*`
 * so the test is independent of the migration-aware save dialog DOM
 * (another agent may be wiring that into the sidebar in parallel).
 *
 * Covered:
 *   1. Golden path — create a workspace with root + env + color + agents,
 *      verify it shows up in list() and get(), reload the window, and
 *      confirm the record survived the round-trip to config.json.
 *   2. Recent ordering edge case — two workspaces, one pinned, verify
 *      getRecentWorkspaces returns pinned first and touches lastOpened
 *      on open().
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
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

// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  await screenshotOnFailure(window, testInfo);
});

// Wipes every workspace in the config so each test sees a clean slate. The
// channel bucket makes this a two-call sequence — list then delete.
async function clearWorkspaces(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = (
      window as unknown as { agentDesk: { workspace: Record<string, (...args: unknown[]) => Promise<unknown>> } }
    ).agentDesk;
    const list = (await api.workspace.list()) as Array<{ id: string }>;
    for (const w of list) await api.workspace.delete(w.id);
  });
}

test('create workspace with folder + env + color, reload, verify restored', async () => {
  await clearWorkspaces(window);

  const created = await window.evaluate(async () => {
    const api = (
      window as unknown as { agentDesk: { workspace: Record<string, (...args: unknown[]) => Promise<unknown>> } }
    ).agentDesk;
    const ws = {
      id: 'ws-e2e-golden',
      name: 'e2e-golden',
      rootPath: 'C:/tmp/e2e-golden',
      color: '#a855f7',
      env: { NODE_ENV: 'test', FOO: 'bar' },
      agents: ['default-shell'],
      pinned: true,
      lastOpened: 0,
      terminals: [],
      layout: null,
    };
    const ok = await api.workspace.save(ws);
    const list = (await api.workspace.list()) as Array<{ id: string }>;
    const fetched = await api.workspace.get('ws-e2e-golden');
    return { ok, listLen: list.length, fetched };
  });

  expect(created.ok).toBe(true);
  expect(created.listLen).toBeGreaterThanOrEqual(1);
  expect(created.fetched).toMatchObject({
    id: 'ws-e2e-golden',
    name: 'e2e-golden',
    rootPath: 'C:/tmp/e2e-golden',
    color: '#a855f7',
    env: { NODE_ENV: 'test', FOO: 'bar' },
    pinned: true,
  });

  // Reload the window and verify the record survived config.json round-trip.
  await window.reload();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(1500);

  const restored = await window.evaluate(async () => {
    const api = (
      window as unknown as { agentDesk: { workspace: Record<string, (...args: unknown[]) => Promise<unknown>> } }
    ).agentDesk;
    return api.workspace.get('ws-e2e-golden');
  });

  expect(restored).toMatchObject({
    id: 'ws-e2e-golden',
    name: 'e2e-golden',
    rootPath: 'C:/tmp/e2e-golden',
    color: '#a855f7',
    env: { NODE_ENV: 'test', FOO: 'bar' },
    pinned: true,
  });
});

test('recent() returns pinned first, open() bumps lastOpened', async () => {
  await clearWorkspaces(window);

  const before = await window.evaluate(async () => {
    const api = (
      window as unknown as { agentDesk: { workspace: Record<string, (...args: unknown[]) => Promise<unknown>> } }
    ).agentDesk;
    await api.workspace.save({
      id: 'ws-e2e-alpha',
      name: 'alpha',
      rootPath: '',
      color: '#22c55e',
      env: {},
      agents: [],
      pinned: false,
      lastOpened: 0,
      terminals: [],
      layout: null,
    });
    await api.workspace.save({
      id: 'ws-e2e-beta',
      name: 'beta',
      rootPath: '',
      color: '#3b82f6',
      env: {},
      agents: [],
      pinned: true,
      lastOpened: 0,
      terminals: [],
      layout: null,
    });
    const recent = (await api.workspace.recent(10)) as Array<{ id: string; pinned: boolean; lastOpened: number }>;
    return recent;
  });

  // Pinned must be first, regardless of lastOpened.
  expect(before[0].id).toBe('ws-e2e-beta');

  const afterOpen = await window.evaluate(async () => {
    const api = (
      window as unknown as { agentDesk: { workspace: Record<string, (...args: unknown[]) => Promise<unknown>> } }
    ).agentDesk;
    await api.workspace.open('ws-e2e-alpha');
    const fetched = (await api.workspace.get('ws-e2e-alpha')) as { lastOpened: number } | null;
    return fetched;
  });

  expect(afterOpen).not.toBeNull();
  expect(afterOpen!.lastOpened).toBeGreaterThan(0);
});
