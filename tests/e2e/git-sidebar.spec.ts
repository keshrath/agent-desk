/**
 * git-sidebar.spec.ts — E2E for the read-only git sidebar (task #93b).
 *
 * Creates a temporary git repo on disk via the main process, points the
 * sidebar at it with setGitSidebarRoot(), and verifies:
 *   1. Golden path — sidebar renders the branch + modified file row,
 *      clicking the row dispatches `diff:open` with the right payload.
 *   2. Edge case — pointing at a non-git directory renders the empty state.
 */

import { test, expect } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { simpleGit } from 'simple-git';
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

async function initFixtureRepo(): Promise<{ dir: string }> {
  const repo = mkdtempSync(join(tmpdir(), 'agent-desk-e2e-git-'));
  const git = simpleGit({ baseDir: repo });
  await git.init();
  await git.addConfig('user.email', 'test@example.com');
  await git.addConfig('user.name', 'Test');
  await git.addConfig('commit.gpgsign', 'false');
  try {
    await git.raw(['checkout', '-b', 'main']);
  } catch {
    /* default already main */
  }
  writeFileSync(join(repo, 'seed.txt'), 'seed\n', 'utf8');
  await git.add('.');
  await git.commit('initial');
  return { dir: repo };
}

test('git sidebar renders branch + files and emits diff:open on click (golden path)', async () => {
  const { dir } = await initFixtureRepo();

  await window.waitForFunction(() => {
    return (
      typeof (window as unknown as { __agentDeskRegistry?: { setGitSidebarRoot?: unknown } }).__agentDeskRegistry !==
      'undefined'
    );
  });

  writeFileSync(join(dir, 'seed.txt'), 'modified-content\n', 'utf8');
  writeFileSync(join(dir, 'fresh.txt'), 'new\n', 'utf8');

  await window.evaluate((root) => {
    const w = window as unknown as {
      __agentDeskRegistry?: { setGitSidebarRoot?: (r: string) => void; refreshGitSidebar?: () => Promise<void> };
      __gitDiffOpenEvents?: Array<{ path: string; root: string }>;
    };
    w.__gitDiffOpenEvents = [];
    window.addEventListener('diff:open', (e) => {
      const detail = (e as CustomEvent).detail;
      w.__gitDiffOpenEvents!.push({ path: detail.path, root: detail.root });
    });
    if (w.__agentDeskRegistry && w.__agentDeskRegistry.setGitSidebarRoot) {
      w.__agentDeskRegistry.setGitSidebarRoot(root);
    }
  }, dir);

  const sidebar = window.locator('#git-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 5000 });

  const branch = sidebar.locator('.git-branch-name');
  await expect(branch).toHaveText(/main/, { timeout: 5000 });

  const fileRows = sidebar.locator('.git-file-row');
  await expect(fileRows.first()).toBeVisible({ timeout: 5000 });
  const count = await fileRows.count();
  expect(count).toBeGreaterThanOrEqual(2);

  const seedRow = sidebar.locator('.git-file-row[data-path="seed.txt"]').first();
  await expect(seedRow).toBeVisible();
  await seedRow.click();

  const events = await window.evaluate(() => {
    return (window as unknown as { __gitDiffOpenEvents?: Array<{ path: string; root: string }> }).__gitDiffOpenEvents;
  });
  expect(events).toBeDefined();
  expect(events!.length).toBeGreaterThanOrEqual(1);
  expect(events![0].path).toBe('seed.txt');
  expect(events![0].root).toBe(dir);
});

test('git sidebar shows empty state for non-git directory (edge case)', async () => {
  const nonGit = mkdtempSync(join(tmpdir(), 'agent-desk-e2e-nogit-'));
  writeFileSync(join(nonGit, 'plain.txt'), 'plain\n', 'utf8');

  await window.evaluate((root) => {
    const w = window as unknown as {
      __agentDeskRegistry?: { setGitSidebarRoot?: (r: string) => void };
    };
    if (w.__agentDeskRegistry && w.__agentDeskRegistry.setGitSidebarRoot) {
      w.__agentDeskRegistry.setGitSidebarRoot(root);
    }
  }, nonGit);

  const empty = window.locator('#git-sidebar .git-sidebar-empty');
  // Post-#113-git-tree: the sidebar now scans a workspace folder for git
  // repos and shows "No git repositories found in this workspace." when
  // none are discovered, instead of the old single-root "Not a git
  // repository" message.
  await expect(empty).toContainText(/No git repositories found/i, { timeout: 5000 });

  const fileRows = window.locator('#git-sidebar .git-file-row');
  expect(await fileRows.count()).toBe(0);
});
