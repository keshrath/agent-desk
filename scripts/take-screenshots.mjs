/**
 * Screenshot capture for agent-desk documentation.
 * Writes fake Claude Code content directly to xterm — no real Claude needed.
 */
import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, copyFileSync, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'screenshots');
const pubDir = path.join(root, 'docs', 'public', 'screenshots');
const tmpDir = path.join(os.tmpdir(), `desk-shots-${Date.now()}`);
mkdirSync(outDir, { recursive: true });
mkdirSync(pubDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  const p = path.join(outDir, name);
  await page.screenshot({ path: p, timeout: 30000 });
  copyFileSync(p, path.join(pubDir, name));
  console.log(`  -> ${name}`);
}

const ARCH_REVIEW = [
  "\x1b[1m\u23FA\x1b[0m I'll review the architecture of the authentication module.\r\n",
  '\r\n',
  '  \x1b[33mRead\x1b[0m(src/auth/middleware.ts)\r\n',
  '  \x1b[90m\u23BF  (342 lines)\x1b[0m\r\n',
  '\r\n',
  '\x1b[1m\u23FA\x1b[0m The middleware follows a clean chain-of-responsibility pattern.\r\n',
  '\r\n',
  '  Key findings:\r\n',
  '  \x1b[32m\u2713\x1b[0m JWT validation properly separated from session management\r\n',
  '  \x1b[32m\u2713\x1b[0m Rate limiting applied before auth checks\r\n',
  '  \x1b[31m\u2717\x1b[0m Missing CSRF token validation on state-changing endpoints\r\n',
  '\r\n',
  '  \x1b[33mEdit\x1b[0m(src/auth/middleware.ts)\r\n',
  '  \x1b[90m\u23BF  Updated src/auth/middleware.ts (+15, -3)\x1b[0m\r\n',
  '\r\n',
  '\x1b[1m\u23FA\x1b[0m Added CSRF validation. Running tests to verify...\r\n',
  '\r\n',
  '  \x1b[33mBash\x1b[0m(npm test -- --grep "csrf")\r\n',
  '  \x1b[90m\u23BF  \x1b[32m3 tests passed\x1b[0m\r\n',
  '\r\n',
  '\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E\r\n',
  '\u2502 \u273B Usage: 15.2k input, 3.4k output   \u2502\r\n',
  '\u2502   Cost: \x1b[32m$0.48\x1b[0m (session: \x1b[32m$1.92\x1b[0m)     \u2502\r\n',
  '\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F\r\n',
  '\r\n\x1b[90m> \x1b[0m',
].join('');

const SECURITY_SCAN = [
  '\x1b[1m\u23FA\x1b[0m Running security analysis on the API endpoints.\r\n',
  '\r\n',
  '  \x1b[33mBash\x1b[0m(npm audit --production)\r\n',
  '  \x1b[90m\u23BF  found 0 vulnerabilities\x1b[0m\r\n',
  '\r\n',
  '  \x1b[33mGrep\x1b[0m("password|secret|api.key", src/)\r\n',
  '  \x1b[90m\u23BF  src/config/env.ts:12 \u2014 const API_KEY = process.env.API_KEY\x1b[0m\r\n',
  '  \x1b[90m\u23BF  src/config/env.ts:13 \u2014 const DB_SECRET = process.env.DB_SECRET\x1b[0m\r\n',
  '  \x1b[90m\u23BF  src/auth/oauth.ts:8  \u2014 const clientSecret = process.env.OAUTH_SECRET\x1b[0m\r\n',
  '\r\n',
  '\x1b[1m\u23FA\x1b[0m All secrets loaded from environment variables.\r\n',
  '  No hardcoded credentials found.\r\n',
  '\r\n',
  '\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E\r\n',
  '\u2502 \u273B Usage: 8.1k input, 2.3k output    \u2502\r\n',
  '\u2502   Cost: \x1b[32m$0.31\x1b[0m                        \u2502\r\n',
  '\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F\r\n',
  '\r\n\x1b[90m> \x1b[0m',
].join('');

const TEST_RUNNER = [
  '\x1b[1m\u23FA\x1b[0m Running the full test suite.\r\n',
  '\r\n',
  '  \x1b[33mBash\x1b[0m(npm test)\r\n',
  '  \x1b[90m\u23BF\x1b[0m\r\n',
  '  \x1b[32m \u2713\x1b[0m auth/login.test.ts \x1b[90m(12 tests) 340ms\x1b[0m\r\n',
  '  \x1b[32m \u2713\x1b[0m auth/middleware.test.ts \x1b[90m(8 tests) 220ms\x1b[0m\r\n',
  '  \x1b[32m \u2713\x1b[0m auth/csrf.test.ts \x1b[90m(3 tests) 45ms\x1b[0m\r\n',
  '  \x1b[32m \u2713\x1b[0m api/endpoints.test.ts \x1b[90m(24 tests) 1.2s\x1b[0m\r\n',
  '  \x1b[32m \u2713\x1b[0m api/webhooks.test.ts \x1b[90m(6 tests) 180ms\x1b[0m\r\n',
  '  \x1b[32m \u2713\x1b[0m api/rate-limit.test.ts \x1b[90m(10 tests) 530ms\x1b[0m\r\n',
  '\r\n',
  '  \x1b[1m\x1b[32m 63 tests passed\x1b[0m \x1b[90m(2.5s)\x1b[0m\r\n',
  '\r\n',
  '\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E\r\n',
  '\u2502 \u273B Usage: 5.4k input, 1.8k output    \u2502\r\n',
  '\u2502   Cost: \x1b[32m$0.22\x1b[0m (session: \x1b[32m$1.47\x1b[0m)     \u2502\r\n',
  '\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F\r\n',
  '\r\n\x1b[90m> \x1b[0m',
].join('');

const AGENT_MONITOR_HTML = `
<div style="padding:24px;height:100%;display:flex;flex-direction:column;gap:16px">
  <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--surface,#21252b);border-radius:12px">
    <div><span style="font-size:18px;font-weight:700">4 agents</span>
    <span style="color:var(--text-muted,#888);margin-left:8px">2 working, 1 idle, 1 completed</span></div>
    <button style="background:var(--accent,#5d8da8);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px">
      <span class="material-symbols-outlined" style="font-size:18px">add</span> Launch Agent
    </button>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;flex:1">
    <div style="background:var(--surface,#21252b);border-radius:12px;padding:16px;border-left:3px solid #5d8da8">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:8px;height:8px;border-radius:50%;background:#5d8da8;display:inline-block"></span>
          <span style="font-weight:600">arch-review</span>
        </div>
        <span style="background:#5d8da8;color:#fff;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600">AI</span>
      </div>
      <div style="color:#5d8da8;font-size:13px;margin-bottom:4px">Working</div>
      <div style="font-family:monospace;font-size:12px;color:var(--text-muted,#888)">Edit(src/auth/middleware.ts)</div>
      <div style="font-size:11px;color:var(--text-muted,#888);margin-top:12px;display:flex;gap:16px">
        <span>\uD83D\uDD27 12</span><span>\u23F1 4m 32s</span><span>\uD83D\uDCB0 $0.48</span>
      </div>
    </div>
    <div style="background:var(--surface,#21252b);border-radius:12px;padding:16px;border-left:3px solid #5d8da8">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:8px;height:8px;border-radius:50%;background:#5d8da8;display:inline-block"></span>
          <span style="font-weight:600">security-scan</span>
        </div>
        <span style="background:#5d8da8;color:#fff;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600">AI</span>
      </div>
      <div style="color:#5d8da8;font-size:13px;margin-bottom:4px">Working</div>
      <div style="font-family:monospace;font-size:12px;color:var(--text-muted,#888)">Grep("password|secret", src/)</div>
      <div style="font-size:11px;color:var(--text-muted,#888);margin-top:12px;display:flex;gap:16px">
        <span>\uD83D\uDD27 8</span><span>\u23F1 3m 15s</span><span>\uD83D\uDCB0 $0.31</span>
      </div>
    </div>
    <div style="background:var(--surface,#21252b);border-radius:12px;padding:16px;border-left:3px solid #4caf50">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:8px;height:8px;border-radius:50%;background:#4caf50;display:inline-block"></span>
          <span style="font-weight:600">test-runner</span>
        </div>
        <span style="background:#5d8da8;color:#fff;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600">AI</span>
      </div>
      <div style="color:#4caf50;font-size:13px;margin-bottom:4px">Completed (63 tests passed)</div>
      <div style="font-family:monospace;font-size:12px;color:var(--text-muted,#888)">npm test completed</div>
      <div style="font-size:11px;color:var(--text-muted,#888);margin-top:12px;display:flex;gap:16px">
        <span>\uD83D\uDD27 5</span><span>\u23F1 2m 48s</span><span>\uD83D\uDCB0 $0.22</span>
      </div>
    </div>
    <div style="background:var(--surface,#21252b);border-radius:12px;padding:16px;border-left:3px solid #888">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:8px;height:8px;border-radius:50%;background:#888;display:inline-block"></span>
          <span style="font-weight:600">docs-writer</span>
        </div>
      </div>
      <div style="color:#888;font-size:13px;margin-bottom:4px">Idle</div>
      <div style="font-family:monospace;font-size:12px;color:var(--text-muted,#888)">Waiting for task assignment</div>
      <div style="font-size:11px;color:var(--text-muted,#888);margin-top:12px;display:flex;gap:16px">
        <span>\uD83D\uDD27 0</span><span>\u23F1 0m 12s</span>
      </div>
    </div>
  </div>
</div>`;

console.log('Building...');
execSync('npm run build', { cwd: root, stdio: 'pipe', timeout: 30000 });

console.log('Launching...');
const app = await electron.launch({
  args: ['.', `--user-data-dir=${tmpDir}`],
  cwd: root,
});
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');

win.on('console', (msg) => {
  const t = msg.type();
  if (t === 'error' || t === 'warning') console.log(`  [${t}] ${msg.text().substring(0, 200)}`);
});
win.on('pageerror', (err) => {
  console.log(`  [pageerror] ${err.message.substring(0, 200)}`);
});

await sleep(3000);

await win.evaluate(() => {
  const o = document.querySelector('.onboarding-overlay');
  if (o) o.remove();
});

for (let i = 0; i < 60; i++) {
  const status = await win.evaluate(() => {
    const reg = window.__agentDeskRegistry;
    const state = window.__agentDeskState;
    return {
      hasReg: !!reg,
      regKeys: reg ? Object.keys(reg).slice(0, 5) : [],
      hasState: !!state,
      termCount: state?.terminals?.size ?? -1,
      hasDockview: !!state?.dockview,
    };
  });
  if (i === 0 || i === 20) {
    const allKeys = await win.evaluate(() => Object.keys(window.__agentDeskRegistry || {}).join(', '));
    console.log(`  [${i * 0.5}s] ALL KEYS: ${allKeys}`);
  }
  if (i % 5 === 0)
    console.log(
      `  [${i * 0.5}s] reg=${status.hasReg} state=${status.hasState} terms=${status.termCount} dv=${status.hasDockview}`,
    );
  if (status.hasReg && status.termCount > 0 && status.hasDockview) {
    console.log(`  Registry ready after ${i * 0.5}s`);
    break;
  }
  if (i % 10 === 0 && i > 0) {
    await win.evaluate(() => {
      const o = document.querySelector('.onboarding-overlay');
      if (o) o.remove();
    });
  }
  await sleep(500);
}
await sleep(2000);

await app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows()[0];
  if (w) {
    w.setSize(1280, 800);
    w.center();
    w.focus();
  }
});
await sleep(1000);

await win.evaluate(() => {
  const o = document.querySelector('.onboarding-overlay');
  if (o) o.remove();
});
await sleep(300);

await win.evaluate(() => {
  const reg = window.__agentDeskRegistry;
  if (reg?.applyTheme) reg.applyTheme('default-dark');
});
await sleep(1000);

let startupIds = await win.evaluate(() => [...(window.__agentDeskState?.terminals?.keys() || [])]);
for (let i = 0; i < 20 && startupIds.length === 0; i++) {
  await sleep(500);
  startupIds = await win.evaluate(() => [...(window.__agentDeskState?.terminals?.keys() || [])]);
}
console.log(`  Startup terminals: ${startupIds.length}`);

if (startupIds.length > 3) {
  for (const tid of startupIds.slice(3)) {
    await win.evaluate(
      ({ id }) => {
        const state = window.__agentDeskState;
        const ts = state?.terminals?.get(id);
        if (ts?.panelId && state?.dockview) {
          try {
            const p = state.dockview.getGroupPanel(ts.panelId);
            if (p) state.dockview.removePanel(p);
          } catch {}
        }
        state?.terminals?.delete(id);
        window.agentDesk.terminal.kill(id);
      },
      { id: tid },
    );
  }
  startupIds = startupIds.slice(0, 3);
}

for (const tid of startupIds) {
  await win.evaluate(
    ({ id }) => {
      window.agentDesk.terminal.unsubscribe(id);
    },
    { id: tid },
  );
}
await sleep(1000);

let _availableTerminals = [...startupIds];

async function setTermContent(id, name, content, status) {
  await win.evaluate(
    ({ id, content }) => {
      const ts = window.__agentDeskState?.terminals?.get(id);
      if (ts?.term) {
        ts.term.clear();
        ts.term.write('\x1b[2J\x1b[H' + content);
      }
    },
    { id, content },
  );
  await win.evaluate(
    ({ id, name, status }) => {
      const reg = window.__agentDeskRegistry;
      if (reg?.renameTerminal) reg.renameTerminal(id, name, true);
      const ts = window.__agentDeskState?.terminals?.get(id);
      if (ts) {
        if (ts._tabIcon) ts._tabIcon.textContent = 'smart_toy';
        ts.status = status;
        if (ts._statusDot) {
          ts._statusDot.className = 'status-dot status-' + (status === 'running' ? 'working' : 'idle');
          ts._statusDot.style.background = status === 'running' ? '#5d8da8' : '#4caf50';
        }
      }
    },
    { id, name, status },
  );
  await sleep(300);
}

async function createAgent(name, content, status) {
  if (_availableTerminals.length > 0) {
    const id = _availableTerminals.shift();
    await setTermContent(id, name, content, status);
    return id;
  }

  const before = await win.evaluate(() => [...(window.__agentDeskState?.terminals?.keys() || [])]);
  win
    .evaluate(async () => {
      if (window.__agentDeskRegistry?.createTerminal) {
        await window.__agentDeskRegistry.createTerminal();
      }
    })
    .catch(() => {});

  let id = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const after = await win.evaluate(() => [...(window.__agentDeskState?.terminals?.keys() || [])]);
    id = after.find((x) => !before.includes(x));
    if (id) break;
  }
  if (!id) {
    console.log(`  WARN: failed to create terminal for ${name}`);
    return null;
  }

  await win.evaluate(({ id }) => window.agentDesk.terminal.unsubscribe(id), { id });
  await sleep(500);
  await setTermContent(id, name, content, status);
  return id;
}

async function navTo(view) {
  await win.evaluate((v) => {
    const reg = window.__agentDeskRegistry;
    if (reg?.switchView) {
      reg.switchView(v);
    } else {
      const btn = document.querySelector(`.nav-btn[data-view="${v}"]`);
      if (btn) btn.click();
    }
  }, view);
  await sleep(1500);
}

try {
  console.log('1. Overview');
  await createAgent('arch-review', ARCH_REVIEW, 'running');
  await createAgent('security-scan', SECURITY_SCAN, 'running');
  await createAgent('test-runner', TEST_RUNNER, 'idle');
  await sleep(1000);
  await shot(win, 'overview.png');

  console.log('2. Agent Monitor');
  await navTo('monitor');
  await sleep(1000);
  await win.evaluate((html) => {
    const c = document.getElementById('view-monitor');
    if (c) {
      c.innerHTML = html;
    }
  }, AGENT_MONITOR_HTML);
  await sleep(500);
  await shot(win, 'agent-monitor.png');

  console.log('3. Dashboards');
  try {
    await navTo('comm');
    await sleep(3000);
    await shot(win, 'dashboard-comm.png');
  } catch (e) {
    console.log(`  comm dashboard failed: ${e.message}`);
  }
  try {
    await navTo('tasks');
    await sleep(3000);
    await shot(win, 'dashboard-tasks.png');
  } catch (e) {
    console.log(`  tasks dashboard failed: ${e.message}`);
  }

  console.log('4. Event stream');
  try {
    await navTo('events');
    await sleep(2000);
    await shot(win, 'event-stream.png');
  } catch (e) {
    console.log(`  event stream failed: ${e.message}`);
  }

  console.log('5. Batch launcher');
  try {
    await navTo('terminals');
    await sleep(500);
    await win.evaluate(() => {
      const r = window.__agentDeskRegistry;
      if (r?.showBatchLauncher) r.showBatchLauncher();
    });
    await sleep(1000);
    await shot(win, 'batch-launcher.png');
    await win.keyboard.press('Escape');
    await sleep(500);
  } catch (e) {
    console.log(`  batch launcher failed: ${e.message}`);
  }

  console.log('6. Global search');
  try {
    await win.evaluate(() => {
      const r = window.__agentDeskRegistry;
      if (r?.showGlobalSearch) r.showGlobalSearch();
    });
    await sleep(500);
    await win.keyboard.type('middleware', { delay: 50 });
    await sleep(1000);
    await shot(win, 'global-search.png');
    await win.keyboard.press('Escape');
    await sleep(500);
  } catch (e) {
    console.log(`  global search failed: ${e.message}`);
  }

  console.log('7. Dracula theme');
  try {
    await win.evaluate(() => window.__agentDeskRegistry?.applyTheme('dracula'));
    await sleep(1500);
    await shot(win, 'dark-theme.png');
  } catch (e) {
    console.log(`  dracula theme failed: ${e.message}`);
  }

  console.log('8. GitHub Light theme');
  try {
    await win.evaluate(() => window.__agentDeskRegistry?.applyTheme('github-light'));
    await sleep(1500);
    await shot(win, 'light-theme.png');
  } catch (e) {
    console.log(`  github light theme failed: ${e.message}`);
  }

  console.log('9. Settings');
  try {
    await win.evaluate(() => window.__agentDeskRegistry?.applyTheme('default-dark'));
    await sleep(500);
    await navTo('settings');
    await sleep(2000);
    await shot(win, 'settings-themes.png');

    await win.evaluate(() => {
      const sections = document.querySelectorAll('.settings-section');
      for (const s of sections) {
        const title = s.querySelector('.settings-section-title');
        if (title && title.textContent?.includes('Profile')) {
          s.scrollIntoView({ behavior: 'instant', block: 'start' });
          break;
        }
      }
    });
    await sleep(1000);
    await shot(win, 'settings-profiles.png');
  } catch (e) {
    console.log(`  settings failed: ${e.message}`);
  }

  console.log('10. Split view');
  await navTo('terminals');
  await sleep(500);
  const DB_MIGRATION = [
    '\x1b[1m\u23FA\x1b[0m Generating database migration for user roles.\r\n',
    '\r\n',
    '  \x1b[33mRead\x1b[0m(prisma/schema.prisma)\r\n',
    '  \x1b[90m\u23BF  (89 lines)\x1b[0m\r\n',
    '\r\n',
    '  \x1b[33mEdit\x1b[0m(prisma/schema.prisma)\r\n',
    '  \x1b[90m\u23BF  Added Role enum and relation to User model\x1b[0m\r\n',
    '\r\n',
    '  \x1b[33mBash\x1b[0m(npx prisma migrate dev --name add-user-roles)\r\n',
    '  \x1b[90m\u23BF\x1b[0m  \x1b[32mMigration created: 20260328_add_user_roles\x1b[0m\r\n',
    '     \x1b[90mApplied 1 migration\x1b[0m\r\n',
    '\r\n',
    '\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E\r\n',
    '\u2502 \u273B Usage: 3.2k input, 1.1k output    \u2502\r\n',
    '\u2502   Cost: \x1b[32m$0.14\x1b[0m (session: \x1b[32m$0.89\x1b[0m)     \u2502\r\n',
    '\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F\r\n',
    '\r\n\x1b[90m> \x1b[0m',
  ].join('');
  await createAgent('db-migrate', DB_MIGRATION, 'running');
  await sleep(1000);

  // Arrange into 2x2 grid via dockview API
  await win.evaluate(() => {
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
    } catch {}
  });
  await sleep(1000);
  // Fit all terminals after split
  await win.evaluate(() => {
    const state = window.__agentDeskState;
    if (state?.terminals) {
      for (const [, ts] of state.terminals) {
        if (ts.fitAddon)
          try {
            ts.fitAddon.fit();
          } catch {}
      }
    }
  });
  await sleep(500);
  await shot(win, 'split-view.png');
} catch (err) {
  console.error('Error:', err.message);
} finally {
  try {
    await Promise.race([app.evaluate(({ app: a }) => a.exit(0)), sleep(3000)]);
  } catch {}
  try {
    const pid = app.process().pid;
    if (pid && process.platform === 'win32') {
      execSync(`cmd.exe /c taskkill /F /T /PID ${pid}`, { stdio: 'pipe', timeout: 5000 });
    }
  } catch {}
}

console.log('\nResults:');
const expected = [
  'overview.png',
  'agent-monitor.png',
  'dashboard-comm.png',
  'dashboard-tasks.png',
  'event-stream.png',
  'batch-launcher.png',
  'global-search.png',
  'dark-theme.png',
  'light-theme.png',
  'settings-themes.png',
  'settings-profiles.png',
  'split-view.png',
];
for (const f of expected) {
  const p = path.join(outDir, f);
  if (!existsSync(p)) {
    console.error(`MISSING: ${f}`);
    continue;
  }
  const sz = statSync(p).size;
  console.log(`  ${f}: ${(sz / 1024).toFixed(0)} KB ${sz < 10000 ? '!! SMALL' : 'OK'}`);
}
