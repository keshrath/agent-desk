// Drive the running agent-desk instance via CDP on port 9222. No restarts.
// Connects to the already-launched Electron, finds the main renderer page,
// walks every sidebar view, opens the workspace save dialog, inspects the git
// sidebar tree (after triggering workspace-opened for ~/.claude), clicks a
// file inside a submodule to verify diff:open routes correctly, and screenshots
// each step into ~/.claude/tmp/agent-desk-cdp-drive/.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const OUT_DIR = join(homedir(), '.claude', 'tmp', 'agent-desk-cdp-drive');
mkdirSync(OUT_DIR, { recursive: true });

const log = [];
function step(name, obj) {
  log.push({ t: Date.now(), name, ...(obj || {}) });
  console.log('STEP', name, obj ? JSON.stringify(obj) : '');
}

async function shot(page, name) {
  const path = join(OUT_DIR, name + '.png');
  await page.screenshot({ path, fullPage: false });
  step('screenshot', { name });
}

async function main() {
  step('connect', { url: 'http://localhost:9222' });
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctxs = browser.contexts();
  if (ctxs.length === 0) throw new Error('No browser contexts');

  // Find the main renderer page — it's the one whose URL starts with file://
  // and whose title is "Agent Desk". Skip devtools pages.
  let page = null;
  for (const ctx of ctxs) {
    for (const p of ctx.pages()) {
      const url = p.url();
      const title = await p.title().catch(() => '');
      if (title === 'Agent Desk' || url.startsWith('file://')) {
        if (!url.includes('devtools')) {
          page = p;
          break;
        }
      }
    }
    if (page) break;
  }
  if (!page) {
    const allPages = [];
    for (const ctx of ctxs) {
      for (const p of ctx.pages()) {
        allPages.push({ url: p.url(), title: await p.title().catch(() => '') });
      }
    }
    throw new Error('No Agent Desk page found. Pages: ' + JSON.stringify(allPages));
  }
  step('page', { url: page.url() });

  // Baseline screenshot.
  await page.waitForTimeout(500);
  await shot(page, '00-initial');

  // Capture console errors + pageerrors from now on.
  page.on('console', (msg) => {
    if (msg.type() === 'error') log.push({ t: Date.now(), name: 'console-error', text: msg.text() });
  });
  page.on('pageerror', (e) => log.push({ t: Date.now(), name: 'pageerror', text: e.message, stack: e.stack }));

  // Dismiss session-restore banner if present (new non-blocking banner from item F).
  try {
    const startFresh = page.locator('.session-restore-btn-no');
    if ((await startFresh.count()) > 0) {
      await startFresh.first().click({ timeout: 1000 });
      step('session-restore-dismissed');
      await page.waitForTimeout(300);
    }
  } catch {
    /* no banner */
  }

  // Walk every sidebar view.
  const views = [
    { key: '1', name: 'terminals' },
    { key: '2', name: 'comm' },
    { key: '3', name: 'tasks' },
    { key: '4', name: 'knowledge' },
    { key: '5', name: 'discover' },
    { key: '6', name: 'events' },
    { key: '7', name: 'settings' },
  ];
  for (const v of views) {
    await page.keyboard.press(`Control+${v.key}`);
    await page.waitForTimeout(800);
    await shot(page, `0${v.key}-${v.name}`);
  }

  // Verify agent-monitor nav slot is gone.
  const monitorExists = await page.evaluate(() => {
    return {
      navBtn: !!document.querySelector('.nav-btn[data-view="monitor"]'),
      view: !!document.getElementById('view-monitor'),
    };
  });
  step('monitor-check', monitorExists);

  // Walk the dom inventory of the sidebar (labels + aria-labels).
  const sidebarInventory = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.nav-btn')).map((b) => ({
      aria: b.getAttribute('aria-label'),
      view: b.dataset.view || '',
    })),
  );
  step('sidebar-inventory', { buttons: sidebarInventory });
  writeFileSync(join(OUT_DIR, 'sidebar.json'), JSON.stringify(sidebarInventory, null, 2));

  // Back to terminals view and exercise the git sidebar directly — fire
  // workspace-opened for the real ~/.claude repo so the tree populates with
  // real submodule data.
  await page.keyboard.press('Control+1');
  await page.waitForTimeout(400);

  const claudeRoot = join(homedir(), '.claude').replace(/\\/g, '/');
  const setResult = await page.evaluate(async (rootPath) => {
    const w = window;
    if (w.__agentDeskRegistry?.setGitSidebarRoot) {
      w.__agentDeskRegistry.setGitSidebarRoot(rootPath);
      return 'setGitSidebarRoot';
    }
    window.dispatchEvent(new CustomEvent('workspace-opened', { detail: { rootPath } }));
    return 'workspace-opened event';
  }, claudeRoot);
  step('git-sidebar-wire', { method: setResult, root: claudeRoot });

  const maxWait = 45000;
  const pollInterval = 1000;
  let waited = 0;
  let readyCount = 0;
  while (waited < maxWait) {
    readyCount = await page.evaluate(() => document.querySelectorAll('.git-repo-node').length);
    const loading = await page.evaluate(() => !!document.querySelector('.git-sidebar-loading'));
    if (readyCount > 0 && !loading) break;
    await page.waitForTimeout(pollInterval);
    waited += pollInterval;
  }
  step('git-sidebar-poll', { waited, readyCount });
  await shot(page, '10-git-sidebar-populated');

  const body = await page.evaluate(() => {
    const el = document.querySelector('.git-sidebar-body');
    return el ? el.innerHTML.slice(0, 2000) : null;
  });
  writeFileSync(join(OUT_DIR, 'git-sidebar-body.html'), body || '(missing)', 'utf8');

  // Inspect the tree structure.
  const tree = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.git-repo-node')).map((n) => ({
      depth: Number(n.getAttribute('data-depth')),
      root: n.getAttribute('data-repo-root'),
      name: n.querySelector('.git-repo-name')?.textContent?.trim() || '',
      branch: n.querySelector('.git-branch-name')?.textContent?.trim() || '',
      submodule: n.classList.contains('git-repo-submodule'),
      error: n.querySelector('.git-repo-error')?.textContent?.trim() || null,
      uninit: !!n.querySelector('.git-repo-uninit'),
    })),
  );
  step('repo-tree', { count: tree.length });
  writeFileSync(join(OUT_DIR, 'tree.json'), JSON.stringify(tree, null, 2));

  // Try to find a submodule row with at least one file and click it to verify
  // diff:open routes through the submodule's own root.
  const clickTarget = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.git-repo-submodule .git-file-row'));
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      path: row.getAttribute('data-path'),
      repoRoot: row.getAttribute('data-repo-root'),
    };
  });
  step('submodule-file-target', clickTarget);

  let diffCaptured = null;
  if (clickTarget) {
    await page.evaluate(() => {
      window.__lastDiffOpen = null;
      window.addEventListener(
        'diff:open',
        (ev) => {
          window.__lastDiffOpen = ev.detail;
        },
        { once: true },
      );
    });
    await page
      .locator('.git-repo-submodule .git-file-row')
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(800);
    diffCaptured = await page.evaluate(() => window.__lastDiffOpen);
    step('diff-open-captured', diffCaptured);
    await shot(page, '11-submodule-file-clicked');
  } else {
    step('submodule-file-target', { note: 'no dirty files in any submodule — skipping click test' });
  }

  // Also click a top-level repo file row (if any) to sanity-check non-submodule routing.
  const topTarget = await page.evaluate(() => {
    const rows = Array.from(
      document.querySelectorAll('.git-repo-node:not(.git-repo-submodule) .git-file-row'),
    );
    if (rows.length === 0) return null;
    return {
      path: rows[0].getAttribute('data-path'),
      repoRoot: rows[0].getAttribute('data-repo-root'),
    };
  });
  step('toplevel-file-target', topTarget);

  // Open the save workspace dialog.
  await page.keyboard.press('Control+Shift+W');
  await page.waitForTimeout(700);
  await shot(page, '12-save-workspace-dialog');
  await page.keyboard.press('Escape');

  writeFileSync(join(OUT_DIR, 'log.json'), JSON.stringify(log, null, 2));
  step('done', { logPath: join(OUT_DIR, 'log.json') });

  // Intentionally do NOT close the browser — the user is driving the window
  // on desktop 2 and we don't want to kill their app.
}

main().catch((e) => {
  log.push({ t: Date.now(), name: 'error', message: e.message, stack: e.stack });
  writeFileSync(join(OUT_DIR, 'log.json'), JSON.stringify(log, null, 2));
  console.error('FATAL', e);
  process.exit(1);
});
