/**
 * Capture documentation screenshots of agent-desk.
 *
 * Usage:  node scripts/take-screenshots.mjs
 * Output: docs/screenshots/*.png + docs/public/screenshots/*.png
 *
 * All terminal content is FAKE — no real paths or personal info.
 */

import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, copyFileSync } from 'fs';
import { execSync } from 'child_process';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'screenshots');
const pubDir = path.join(root, 'docs', 'public', 'screenshots');
const tmpUserData = path.join(os.tmpdir(), 'agent-desk-screenshots');
mkdirSync(outDir, { recursive: true });
mkdirSync(pubDir, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Fake terminal content (Claude Code style) ──────────────────────

const ARCH_REVIEW = [
  `\x1b[1m\u23FA\x1b[0m I'll review the architecture of the authentication module.`,
  ``,
  `  \x1b[33mRead\x1b[0m(src/auth/middleware.ts)`,
  `  \x1b[90m\u23BF  (342 lines)\x1b[0m`,
  ``,
  `\x1b[1m\u23FA\x1b[0m The middleware follows a clean chain-of-responsibility pattern.`,
  ``,
  `  Key findings:`,
  `  \x1b[32m\u2713\x1b[0m JWT validation properly separated from session management`,
  `  \x1b[32m\u2713\x1b[0m Rate limiting applied before auth checks`,
  `  \x1b[31m\u2717\x1b[0m Missing CSRF token validation on state-changing endpoints`,
  ``,
  `  \x1b[33mEdit\x1b[0m(src/auth/middleware.ts)`,
  `  \x1b[90m\u23BF  Updated src/auth/middleware.ts (+15, -3)\x1b[0m`,
  ``,
  `\x1b[1m\u23FA\x1b[0m Added CSRF validation middleware. Running tests to verify...`,
  ``,
  `  \x1b[33mBash\x1b[0m(npm test -- --grep "csrf")`,
  `  \x1b[90m\u23BF  \x1b[32m3 tests passed\x1b[90m\x1b[0m`,
  ``,
].join('\r\n');

const SECURITY_SCAN = [
  `\x1b[1m\u23FA\x1b[0m Running security analysis on the API endpoints.`,
  ``,
  `  \x1b[33mBash\x1b[0m(npm audit --production)`,
  `  \x1b[90m\u23BF  found 0 vulnerabilities\x1b[0m`,
  ``,
  `  \x1b[33mGrep\x1b[0m("password|secret|api.key", src/)`,
  `  \x1b[90m\u23BF  src/config/env.ts:12: const API_KEY = process.env.API_KEY\x1b[0m`,
  `  \x1b[90m\u23BF  src/config/env.ts:13: const DB_SECRET = process.env.DB_SECRET\x1b[0m`,
  `  \x1b[90m\u23BF  src/auth/oauth.ts:8: const clientSecret = process.env.OAUTH_SECRET\x1b[0m`,
  ``,
  `\x1b[1m\u23FA\x1b[0m All secrets are loaded from environment variables \u2014 no hardcoded`,
  `  credentials found. The codebase follows security best practices.`,
  ``,
  `\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E`,
  `\u2502 \u273B Usage: 8.1k input, 2.3k output    \u2502`,
  `\u2502   Cost: \x1b[32m$0.31\x1b[0m                        \u2502`,
  `\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F`,
  ``,
].join('\r\n');

const TEST_RUNNER = [
  `\x1b[1m\u23FA\x1b[0m Running the full test suite.`,
  ``,
  `  \x1b[33mBash\x1b[0m(npm test)`,
  `  \x1b[90m\u23BF\x1b[0m`,
  `  \x1b[32m \u2713\x1b[0m auth/login.test.ts \x1b[90m(12 tests) 340ms\x1b[0m`,
  `  \x1b[32m \u2713\x1b[0m auth/middleware.test.ts \x1b[90m(8 tests) 220ms\x1b[0m`,
  `  \x1b[32m \u2713\x1b[0m auth/csrf.test.ts \x1b[90m(3 tests) 45ms\x1b[0m`,
  `  \x1b[32m \u2713\x1b[0m api/endpoints.test.ts \x1b[90m(24 tests) 1.2s\x1b[0m`,
  `  \x1b[32m \u2713\x1b[0m api/webhooks.test.ts \x1b[90m(6 tests) 180ms\x1b[0m`,
  `  \x1b[32m \u2713\x1b[0m api/rate-limit.test.ts \x1b[90m(10 tests) 530ms\x1b[0m`,
  ``,
  `  \x1b[1m\x1b[32m 63 tests passed\x1b[0m \x1b[90m(2.5s)\x1b[0m`,
  ``,
  `\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E`,
  `\u2502 \u273B Usage: 5.4k input, 1.8k output    \u2502`,
  `\u2502   Cost: \x1b[32m$0.22\x1b[0m (session: \x1b[32m$1.47\x1b[0m)     \u2502`,
  `\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F`,
  ``,
  `\x1b[90m> \x1b[0m`,
].join('\r\n');

const DB_MIGRATION = [
  `\x1b[1m\u23FA\x1b[0m Generating the database migration for the new user roles.`,
  ``,
  `  \x1b[33mRead\x1b[0m(prisma/schema.prisma)`,
  `  \x1b[90m\u23BF  (89 lines)\x1b[0m`,
  ``,
  `  \x1b[33mEdit\x1b[0m(prisma/schema.prisma)`,
  `  \x1b[90m\u23BF  Added Role enum and relation to User model\x1b[0m`,
  ``,
  `  \x1b[33mBash\x1b[0m(npx prisma migrate dev --name add-user-roles)`,
  `  \x1b[90m\u23BF\x1b[0m  \x1b[32mMigration created: 20260328_add_user_roles\x1b[0m`,
  `     \x1b[90mApplied 1 migration\x1b[0m`,
  ``,
  `\x1b[1m\u23FA\x1b[0m Migration applied successfully. The new schema adds:`,
  `  \u2022 Role enum with ADMIN, EDITOR, VIEWER`,
  `  \u2022 role field on User model (default: VIEWER)`,
  ``,
  `\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E`,
  `\u2502 \u273B Usage: 3.2k input, 1.1k output    \u2502`,
  `\u2502   Cost: \x1b[32m$0.14\x1b[0m (session: \x1b[32m$0.89\x1b[0m)     \u2502`,
  `\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F`,
  ``,
].join('\r\n');

// ── Build ────────────────────────────────────────────────────────────
console.log('Building app...');
execSync('npm run build', { cwd: root, stdio: 'pipe', timeout: 60_000 });
console.log('Build complete.');

// ── Launch ───────────────────────────────────────────────────────────
console.log('Launching Electron...');
const app = await electron.launch({
  args: ['.', `--user-data-dir=${tmpUserData}`],
  cwd: root,
});
const w = await app.firstWindow();
await w.waitForLoadState('domcontentloaded');
await sleep(500);

for (let i = 0; i < 20; i++) {
  const removed = await w.evaluate(() => {
    if (window.__agentDeskState?._cleanupOnData) {
      window.__agentDeskState._cleanupOnData();
      window.__agentDeskState._cleanupOnData = null;
      if (window.__agentDeskState._cleanupOnExit) {
        window.__agentDeskState._cleanupOnExit();
        window.__agentDeskState._cleanupOnExit = null;
      }
      return true;
    }
    return false;
  });
  if (removed) break;
  await sleep(200);
}
await sleep(2000);

await app.evaluate(({ BrowserWindow }) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.setSize(1280, 800);
    win.center();
    win.focus();
  }
});
await sleep(1500);

// Apply default dark theme BEFORE creating any terminals
await w.evaluate(() => {
  if (window.__agentDeskRegistry?.applyTheme) {
    window.__agentDeskRegistry.applyTheme('default-dark');
  }
});
await sleep(1000);

// ── Helpers ──────────────────────────────────────────────────────────

async function scrubPaths() {
  await w.evaluate(() => {
    const scrubText = (text) =>
      text
        .replace(/[A-Z]:\\WINDOWS\\system32\\cmd\.exe/gi, '/bin/bash')
        .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, '~/projects/my-app')
        .replace(/[A-Z]:\\/gi, '~/');
    const scrub = (el) => {
      const text = el.textContent || '';
      if (/[A-Z]:\\|\\Users\\|cmd\.exe|powershell/i.test(text)) {
        if (el.children.length === 0) {
          el.textContent = scrubText(text);
        } else {
          el.querySelectorAll('*').forEach((child) => {
            if (child.children.length === 0 && child.textContent) {
              const t = child.textContent;
              if (/[A-Z]:\\|\\Users\\|cmd\.exe|powershell/i.test(t)) {
                child.textContent = scrubText(t);
              }
            }
          });
        }
      }
    };
    document
      .querySelectorAll(
        '.dv-tab-label, .dv-default-tab-content, .status-left span, .status-right span, .app-title, [class*="es-event"], [class*="event-item"], [class*="event-text"]',
      )
      .forEach(scrub);
  });
}

async function shot(name) {
  await scrubPaths();
  await sleep(100);
  const p = path.join(outDir, name);
  await w.screenshot({ path: p });
  const pp = path.join(pubDir, name);
  copyFileSync(p, pp);
  console.log(`  -> ${name}`);
}

async function navTo(view) {
  await w.evaluate((v) => {
    if (window.__agentDeskRegistry?.switchView) {
      window.__agentDeskRegistry.switchView(v);
    } else {
      const btn = document.querySelector(`.nav-btn[data-view="${v}"]`);
      if (btn) btn.click();
    }
  }, view);
  await sleep(1500);
}

async function writeToTerminal(termId, content) {
  await w.evaluate(
    ({ id, text }) => {
      const ts = window.__agentDeskState?.terminals?.get(id);
      if (ts && ts.term) {
        ts.term.clear();
        ts.term.write('\x1b[2J\x1b[H');
        ts.term.write(text);
      }
    },
    { id: termId, text: content },
  );
  await sleep(100);
}

async function renameTab(termId, name) {
  await w.evaluate(
    ({ id, newName }) => {
      const reg = window.__agentDeskRegistry;
      if (reg?.renameTerminal) {
        reg.renameTerminal(id, newName, true);
      }

      const ts = window.__agentDeskState?.terminals?.get(id);
      if (!ts) return;

      ts.title = newName;
      ts.manualTitle = true;
      if (ts._tabLabel) ts._tabLabel.textContent = newName;

      if (ts._tabIcon) ts._tabIcon.textContent = 'smart_toy';

      const dv = window.__agentDeskState?.dockview;
      if (dv && ts.panelId) {
        try {
          const panel = dv.getGroupPanel(ts.panelId);
          if (panel) {
            panel.api.updateParameters({ title: newName, terminalId: id });
            panel.api.setTitle(newName);
          }
        } catch (_) {}
      }
    },
    { id: termId, newName: name },
  );
}

async function setTabStatus(termId, status) {
  await w.evaluate(
    ({ id, s }) => {
      const ts = window.__agentDeskState?.terminals?.get(id);
      if (!ts) return;
      ts.status = s;
      if (ts._statusDot) {
        ts._statusDot.className = 'status-dot status-' + (s === 'running' || s === 'working' ? 'working' : s === 'idle' || s === 'success' ? 'idle' : s);
        // Also set inline style as fallback
        const colors = {
          working: '#5d8da8',
          running: '#5d8da8',
          idle: '#4caf50',
          success: '#4caf50',
          waiting: '#ff9800',
          error: '#d45050',
        };
        ts._statusDot.style.background = colors[s] || colors.idle;
        ts._statusDot.title = s;
      }
    },
    { id: termId, s: status },
  );
}

async function createTerminal() {
  const before = await getTerminalIds();

  // Fire-and-forget the terminal creation (don't await — it may hang)
  w.evaluate(async () => {
    if (window.__agentDeskRegistry?.createTerminal) {
      await window.__agentDeskRegistry.createTerminal();
    }
  }).catch(() => {});

  // Poll until a new terminal appears
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const after = await getTerminalIds();
    const newId = after.find((x) => !before.includes(x));
    if (newId) return newId;
  }

  // Fallback: click button
  await w.click('#btn-new-terminal').catch(() => {});
  await sleep(2000);
  const after = await getTerminalIds();
  const newId = after.find((x) => !before.includes(x));
  return newId || after[after.length - 1];
}

async function getTerminalIds() {
  return await w.evaluate(() => {
    return [...(window.__agentDeskState?.terminals?.keys() || [])];
  });
}

// ── 1. Overview — 3 agent terminals with Claude Code content ────────
console.log('1. Overview (3 agent terminals)');

let ids = await getTerminalIds();
while (ids.length === 0) {
  await sleep(1000);
  ids = await getTerminalIds();
}
let term1Id = ids[0];

const term2Id = await createTerminal();
const term3Id = await createTerminal();
await sleep(3000);

// Close any extra terminals beyond our 3
const allIds = await getTerminalIds();
console.log(`  Found ${allIds.length} terminals, keeping 3`);
const keepIds = new Set([term1Id, term2Id, term3Id]);
for (const tid of allIds) {
  if (!keepIds.has(tid)) {
    await w.evaluate(
      ({ id }) => {
        const state = window.__agentDeskState;
        const ts = state?.terminals?.get(id);
        if (ts && ts.panelId && state.dockview) {
          try {
            const panel = state.dockview.getGroupPanel(ts.panelId);
            if (panel) state.dockview.removePanel(panel);
          } catch (_) {}
        }
        state?.terminals?.delete(id);
        window.agentDesk.terminal.kill(id);
      },
      { id: tid },
    );
  }
}
await sleep(500);

// Unsubscribe from pty so real shell output doesn't overwrite fake content
for (const tid of [term1Id, term2Id, term3Id]) {
  await w.evaluate(({ id }) => window.agentDesk.terminal.unsubscribe(id), { id: tid });
}
await sleep(2000);

// Write fake Claude Code content
await writeToTerminal(term1Id, ARCH_REVIEW);
await renameTab(term1Id, 'arch-review');
await setTabStatus(term1Id, 'working');

await writeToTerminal(term2Id, SECURITY_SCAN);
await renameTab(term2Id, 'security-scan');
await setTabStatus(term2Id, 'working');

await writeToTerminal(term3Id, TEST_RUNNER);
await renameTab(term3Id, 'test-runner');
await setTabStatus(term3Id, 'idle');

// Second pass to ensure pty didn't overwrite
await sleep(1000);
await writeToTerminal(term1Id, ARCH_REVIEW);
await writeToTerminal(term2Id, SECURITY_SCAN);
await writeToTerminal(term3Id, TEST_RUNNER);
await sleep(300);

// Scrub any lingering Windows paths from tab labels
await w.evaluate(() => {
  document.querySelectorAll('.dv-tab-label, .dv-default-tab-content').forEach((el) => {
    const text = el.textContent || '';
    if (text.includes('\\') || text.includes('cmd.exe') || text.includes('powershell')) {
      el.textContent = 'shell';
    }
  });
});
await sleep(300);

// Click first terminal tab to make it active
await w.evaluate(
  ({ id }) => {
    const ts = window.__agentDeskState?.terminals?.get(id);
    if (ts && ts._tabEl) ts._tabEl.click();
  },
  { id: term1Id },
);
await sleep(500);

await shot('overview.png');

// ── 2. Agent Monitor ────────────────────────────────────────────────
console.log('2. Agent Monitor');
await navTo('monitor');
await sleep(1000);

await w.evaluate(() => {
  const container = document.querySelector('#view-monitor');
  if (!container) return;

  let grid = container.querySelector('.agent-monitor-grid');
  if (!grid) {
    const empty = container.querySelector('.agent-monitor-empty');
    if (empty) empty.remove();
    grid = document.createElement('div');
    grid.className = 'agent-monitor-grid';
    container.appendChild(grid);
  }

  const agents = [
    {
      name: 'arch-review',
      status: 'Working',
      statusColor: '#5d8da8',
      activity: 'Edit(src/auth/middleware.ts)',
      toolCalls: 12,
      uptime: '4m 32s',
      isAgent: true,
    },
    {
      name: 'security-scan',
      status: 'Working',
      statusColor: '#5d8da8',
      activity: 'Grep("password|secret", src/)',
      toolCalls: 8,
      uptime: '3m 15s',
      isAgent: true,
    },
    {
      name: 'test-runner',
      status: 'Idle (63 tests passed)',
      statusColor: '#4caf50',
      activity: 'npm test completed',
      toolCalls: 5,
      uptime: '2m 48s',
      isAgent: true,
    },
    {
      name: 'docs-writer',
      status: 'Idle',
      statusColor: '#6b7785',
      activity: '',
      toolCalls: 0,
      uptime: '0m 12s',
      isAgent: false,
    },
  ];

  grid.innerHTML = agents
    .map(
      (a) => `
    <div class="agent-monitor-card">
      <div class="agent-monitor-card-header">
        <span class="agent-monitor-dot" style="background:${a.statusColor}"></span>
        <span class="agent-monitor-name">${a.name}</span>
        ${a.isAgent ? '<span class="agent-monitor-badge-agent">AI</span>' : ''}
      </div>
      <div class="agent-monitor-card-status">${a.status}</div>
      ${a.activity ? `<div class="agent-monitor-card-activity">${a.activity}</div>` : ''}
      <div class="agent-monitor-card-meta">
        <span><span class="material-symbols-outlined">build</span>${a.toolCalls}</span>
        <span><span class="material-symbols-outlined">schedule</span>${a.uptime}</span>
      </div>
    </div>
  `,
    )
    .join('');
});
await sleep(500);
await shot('agent-monitor.png');

// ── 3. Dashboard: agent-comm ────────────────────────────────────────
console.log('3. Dashboard: agent-comm');
await navTo('comm');
await sleep(2000);

await w.evaluate(() => {
  const container = document.getElementById('view-comm');
  if (!container) return;

  const wv = container.querySelector('webview');
  if (wv) wv.style.display = 'none';

  const fake = document.createElement('div');
  fake.style.cssText =
    'position:absolute;inset:0;background:var(--bg);color:var(--text);font-family:Inter,sans-serif;padding:20px;overflow:auto;';
  fake.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <span class="material-symbols-outlined" style="font-size:28px;color:var(--accent);">forum</span>
      <h2 style="margin:0;font-size:18px;font-weight:600;">Agent Communication</h2>
      <span style="font-size:12px;color:var(--text-muted);margin-left:auto;">4 agents online</span>
    </div>
    <div style="display:flex;gap:16px;height:calc(100% - 60px);">
      <div style="width:200px;flex-shrink:0;">
        <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;font-weight:600;">Channels</div>
        <div style="padding:8px 12px;background:var(--accent);color:#fff;border-radius:6px;font-size:13px;margin-bottom:4px;cursor:pointer;"># general</div>
        <div style="padding:8px 12px;color:var(--text-muted);border-radius:6px;font-size:13px;margin-bottom:4px;cursor:pointer;"># team-review</div>
        <div style="padding:8px 12px;color:var(--text-muted);border-radius:6px;font-size:13px;margin-bottom:4px;cursor:pointer;"># alerts</div>
        <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);margin:16px 0 8px;font-weight:600;">Online</div>
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;"><span style="width:8px;height:8px;border-radius:50%;background:#5d8da8;"></span> arch-review</div>
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;"><span style="width:8px;height:8px;border-radius:50%;background:#5d8da8;"></span> security-scan</div>
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;"><span style="width:8px;height:8px;border-radius:50%;background:#4caf50;"></span> test-runner</div>
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;"><span style="width:8px;height:8px;border-radius:50%;background:#6b7785;"></span> docs-writer</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;border-left:1px solid var(--border);padding-left:16px;">
        <div style="font-size:14px;font-weight:600;padding-bottom:12px;border-bottom:1px solid var(--border);margin-bottom:12px;"># general</div>
        <div style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:12px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-weight:600;font-size:13px;color:var(--accent);">arch-review</span>
              <span style="font-size:11px;color:var(--text-muted);">2 min ago</span>
            </div>
            <div style="font-size:13px;color:var(--text);padding-left:4px;">Starting architecture review of auth module. Will post findings to #general when done.</div>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-weight:600;font-size:13px;color:var(--accent);">security-scan</span>
              <span style="font-size:11px;color:var(--text-muted);">1 min ago</span>
            </div>
            <div style="font-size:13px;color:var(--text);padding-left:4px;">Running npm audit + secret detection on src/. No vulnerabilities found so far.</div>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-weight:600;font-size:13px;color:#4caf50;">test-runner</span>
              <span style="font-size:11px;color:var(--text-muted);">30s ago</span>
            </div>
            <div style="font-size:13px;color:var(--text);padding-left:4px;">All 63 tests passed in 2.5s. No regressions detected.</div>
          </div>
        </div>
        <div style="padding-top:12px;border-top:1px solid var(--border);">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-muted);font-size:13px;">Type a message...</div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(fake);
});
await sleep(500);
await shot('dashboard-comm.png');

// ── 4. Dashboard: agent-tasks ───────────────────────────────────────
console.log('4. Dashboard: agent-tasks');
await navTo('tasks');
await sleep(2000);

await w.evaluate(() => {
  const container = document.getElementById('view-tasks');
  if (!container) return;

  const wv = container.querySelector('webview');
  if (wv) wv.style.display = 'none';

  const fake = document.createElement('div');
  fake.style.cssText =
    'position:absolute;inset:0;background:var(--bg);color:var(--text);font-family:Inter,sans-serif;padding:20px;overflow:auto;';

  const stages = [
    { name: 'Backlog', count: 1, tasks: [{ title: 'Add WebSocket reconnection', priority: 'P2', assignee: '' }] },
    {
      name: 'Plan',
      count: 1,
      tasks: [{ title: 'Refactor token refresh logic', priority: 'P1', assignee: 'arch-review' }],
    },
    {
      name: 'Implement',
      count: 2,
      tasks: [
        { title: 'Security audit: API endpoints', priority: 'P0', assignee: 'security-scan' },
        { title: 'Write API documentation', priority: 'P2', assignee: 'docs-writer' },
      ],
    },
    { name: 'Test', count: 1, tasks: [{ title: 'Auth module test suite', priority: 'P1', assignee: 'test-runner' }] },
    { name: 'Review', count: 0, tasks: [] },
    { name: 'Done', count: 1, tasks: [{ title: 'Setup CI pipeline', priority: 'P1', assignee: 'test-runner' }] },
  ];

  const priorityColors = { P0: '#d45050', P1: '#ff9800', P2: '#5d8da8' };

  fake.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <span class="material-symbols-outlined" style="font-size:28px;color:var(--accent);">task_alt</span>
      <h2 style="margin:0;font-size:18px;font-weight:600;">Pipeline</h2>
      <span style="font-size:12px;color:var(--text-muted);margin-left:auto;">6 tasks total</span>
    </div>
    <div style="display:flex;gap:12px;overflow-x:auto;height:calc(100% - 60px);">
      ${stages
        .map(
          (stage) => `
        <div style="min-width:200px;flex:1;display:flex;flex-direction:column;background:var(--surface);border-radius:8px;padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <span style="font-size:12px;font-weight:600;text-transform:uppercase;color:var(--text-muted);">${stage.name}</span>
            <span style="font-size:11px;color:var(--text-dim);background:var(--surface-hover);padding:2px 6px;border-radius:4px;">${stage.count}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;flex:1;">
            ${stage.tasks
              .map(
                (t) => `
              <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:10px;">
                <div style="font-size:13px;font-weight:500;margin-bottom:6px;">${t.title}</div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-size:10px;font-weight:600;padding:1px 5px;border-radius:3px;background:${priorityColors[t.priority]};color:#fff;">${t.priority}</span>
                  ${t.assignee ? `<span style="font-size:11px;color:var(--text-muted);">${t.assignee}</span>` : ''}
                </div>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      `,
        )
        .join('')}
    </div>
  `;
  container.appendChild(fake);
});
await sleep(500);
await shot('dashboard-tasks.png');

// ── 5. Event stream ─────────────────────────────────────────────────
console.log('5. Event stream');
await navTo('events');
await sleep(1000);
await shot('event-stream.png');

// ── 6. Batch launcher ───────────────────────────────────────────────
console.log('6. Batch launcher');
await navTo('terminals');
await sleep(500);
await w.evaluate(() => {
  if (window.__agentDeskRegistry?.showBatchLauncher) {
    window.__agentDeskRegistry.showBatchLauncher({
      count: 3,
      namingPattern: 'review-{n}',
    });
  }
});
await sleep(500);
const batchModal = w.locator('.batch-launcher-overlay, .batch-modal, [class*="batch"]');
if ((await batchModal.count()) === 0) {
  await w.keyboard.press('Control+Shift+B');
  await sleep(800);
}
await sleep(500);
await shot('batch-launcher.png');
await w.keyboard.press('Escape');
await sleep(500);

// ── 7. Global search ────────────────────────────────────────────────
console.log('7. Global search');
await navTo('terminals');
await sleep(500);
await w.evaluate(() => {
  if (window.__agentDeskRegistry?.showGlobalSearch) {
    window.__agentDeskRegistry.showGlobalSearch();
  }
});
await sleep(800);
const searchInput = w.locator('.global-search-input, [class*="global-search"] input');
if ((await searchInput.count()) > 0) {
  await searchInput.first().fill('refreshToken');
  await sleep(800);
}
await shot('global-search.png');
await w.keyboard.press('Escape');
await sleep(500);

// ── 8. Dark theme (Dracula) ─────────────────────────────────────────
console.log('8. Dark theme (Dracula)');
await w.evaluate(() => {
  if (window.__agentDeskRegistry?.applyTheme) {
    window.__agentDeskRegistry.applyTheme('dracula');
  }
});
await sleep(1000);
// Re-write terminal content after theme change
await writeToTerminal(term1Id, ARCH_REVIEW);
await sleep(300);
await shot('dark-theme.png');

// ── 9. Light theme (GitHub) ─────────────────────────────────────────
console.log('9. Light theme (GitHub)');
await w.evaluate(() => {
  if (window.__agentDeskRegistry?.applyTheme) {
    window.__agentDeskRegistry.applyTheme('github-light');
  }
});
await sleep(1000);
await navTo('terminals');
await sleep(500);
await writeToTerminal(term1Id, ARCH_REVIEW);
await sleep(300);
await shot('light-theme.png');

// ── 10. Split view (2x2) ───────────────────────────────────────────
console.log('10. Split view (2x2)');

// Switch back to dark for split view
await w.evaluate(() => {
  if (window.__agentDeskRegistry?.applyTheme) {
    window.__agentDeskRegistry.applyTheme('default-dark');
  }
});
await sleep(500);

const term4Id = await createTerminal();
await sleep(2000);
await w.evaluate(({ id }) => window.agentDesk.terminal.unsubscribe(id), { id: term4Id });
await sleep(500);
await writeToTerminal(term4Id, DB_MIGRATION);
await renameTab(term4Id, 'db-migrate');
await setTabStatus(term4Id, 'working');
await sleep(500);

// Use dockview API to arrange into 2x2 grid
await w.evaluate(() => {
  const dv = window.__agentDeskState?.dockview;
  if (!dv) return;

  const panels = [...dv.panels];
  if (panels.length < 4) return;

  try {
    dv.moveGroupOrPanel({
      from: { groupId: panels[1].group.id, panelId: panels[1].id },
      to: { group: panels[0].group, position: 'right' },
    });

    dv.moveGroupOrPanel({
      from: { groupId: panels[2].group.id, panelId: panels[2].id },
      to: { group: panels[0].group, position: 'below' },
    });

    dv.moveGroupOrPanel({
      from: { groupId: panels[3].group.id, panelId: panels[3].id },
      to: { group: panels[2].group, position: 'right' },
    });
  } catch (e) {
    console.error('Split layout error:', e);
  }
});
await sleep(1000);

// Fit all terminals
await w.evaluate(() => {
  const state = window.__agentDeskState;
  if (state && state.terminals) {
    for (const [, ts] of state.terminals) {
      if (ts.fitAddon) {
        try {
          ts.fitAddon.fit();
        } catch (_) {}
      }
    }
  }
});
await sleep(500);

// Re-write all terminal content after layout change
await writeToTerminal(term1Id, ARCH_REVIEW);
await writeToTerminal(term2Id, SECURITY_SCAN);
await writeToTerminal(term3Id, TEST_RUNNER);
await writeToTerminal(term4Id, DB_MIGRATION);
await sleep(500);

await shot('split-view.png');

// ── Cleanup ──────────────────────────────────────────────────────────
console.log('\nAll screenshots saved to:');
console.log(`  ${outDir}`);
console.log(`  ${pubDir}`);
console.log('Closing app...');

try {
  await app.evaluate(({ app: a }) => a.exit(0));
} catch {
  /* process exits before evaluate resolves */
}
await sleep(1000);

try {
  const pid = app.process().pid;
  if (pid) {
    if (process.platform === 'win32') {
      execSync(`cmd.exe /c taskkill /F /T /PID ${pid}`, { stdio: 'pipe', timeout: 5000 });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  }
} catch {
  /* already dead */
}

process.exit(0);
