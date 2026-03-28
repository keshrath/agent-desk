import { _electron as electron } from 'playwright';

const DURATIONS = JSON.parse(process.argv[2] || '{}');
const FPS = 25;
const FRAME_MS = 1000 / FPS;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function smoothMove(page, x, y, durationMs = 800) {
  const cur = await page.evaluate(() => ({ x: window._mouseX || 0, y: window._mouseY || 0 }));
  const dist = Math.sqrt((x - cur.x) ** 2 + (y - cur.y) ** 2);
  const scale = Math.max(0.4, Math.min(dist / 400, 1.5));
  const frames = Math.max(8, Math.floor(Math.max(300, durationMs * scale) / FRAME_MS));
  for (let i = 1; i <= frames; i++) {
    const t = i / frames;
    const e = t * t * t * (t * (6 * t - 15) + 10);
    await page.mouse.move(cur.x + (x - cur.x) * e, cur.y + (y - cur.y) * e);
    await sleep(FRAME_MS);
  }
  await page.evaluate(`() => { window._mouseX = ${x}; window._mouseY = ${y}; }`);
}

async function moveTo(page, sel) {
  const el = page.locator(sel).first();
  const box = await el.boundingBox();
  if (box) await smoothMove(page, box.x + box.width / 2, box.y + box.height / 2);
  return box;
}

async function clickEl(page, sel) {
  await moveTo(page, sel);
  await sleep(200);
  await page.click(sel);
}

async function injectCursor(page) {
  await page.evaluate(`() => {
    if (document.getElementById('mk-cursor')) return;
    const c = document.createElement('div'); c.id = 'mk-cursor';
    c.style.cssText = 'position:fixed;z-index:999999;pointer-events:none;width:24px;height:24px;border-radius:50%;background:rgba(255,87,34,0.45);border:2px solid rgba(255,87,34,0.8);transform:translate(-50%,-50%);transition:width 0.15s,height 0.15s,background 0.15s;left:-100px;top:-100px';
    document.body.appendChild(c);
    const r = document.createElement('div'); r.id = 'mk-cursor-ring';
    r.style.cssText = 'position:fixed;z-index:999998;pointer-events:none;width:40px;height:40px;border-radius:50%;border:1.5px solid rgba(255,87,34,0.25);transform:translate(-50%,-50%);transition:width 0.2s,height 0.2s;left:-100px;top:-100px';
    document.body.appendChild(r);
    document.addEventListener('mousemove', e => { requestAnimationFrame(() => { c.style.left=e.clientX+'px'; c.style.top=e.clientY+'px'; r.style.left=e.clientX+'px'; r.style.top=e.clientY+'px'; }); });
    document.addEventListener('mousedown', () => { c.style.width='32px'; c.style.height='32px'; c.style.background='rgba(255,87,34,0.7)'; r.style.width='52px'; r.style.height='52px'; });
    document.addEventListener('mouseup', () => { c.style.width='24px'; c.style.height='24px'; c.style.background='rgba(255,87,34,0.45)'; r.style.width='40px'; r.style.height='40px'; });
  }`);
}

function sceneDur(id) {
  return (DURATIONS[id] || 5) * 1000;
}

const app = await electron.launch({ args: ['.'], cwd: '.' });
const w = await app.firstWindow();
await w.waitForLoadState('domcontentloaded');
await sleep(3000);

await app.evaluate(({ BrowserWindow }) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.setSize(1280, 800);
    win.center();
    win.focus();
  }
});
await sleep(1000);
console.log('WINDOW_READY');
await sleep(4000);

await injectCursor(w);
await w.addStyleTag({ content: '* { cursor: none !important; }' });

console.log('Scene: intro');
await sleep(sceneDur('intro'));

console.log('Scene: open_settings');
await clickEl(w, '#sidebar .nav-btn[data-view="settings"]');
await sleep(800);
const ph = w.locator('.settings-section-title').filter({ hasText: 'Profiles' });
await ph.scrollIntoViewIfNeeded();
await sleep(600);
await moveTo(w, '.profile-row >> nth=0');
await sleep(700);
await moveTo(w, '.profile-row >> nth=1');
await sleep(700);
await moveTo(w, '.profile-launch-btn >> nth=0');
await sleep(400);
await moveTo(w, '.profile-action-btn[title="Edit"] >> nth=0');
await sleep(sceneDur('open_settings') - 4000);

console.log('Scene: create_profile');
await clickEl(w, '.profile-btn-add');
await sleep(800);
await clickEl(w, '.profile-form input >> nth=0');
await w.locator('.profile-form input').first().type('Node REPL', { delay: 60 });
await sleep(400);
await clickEl(w, '.profile-form input >> nth=1');
await w.locator('.profile-form input').nth(1).type('node', { delay: 60 });
await sleep(400);
await moveTo(w, '.profile-form select');
await sleep(400);
await w.locator('.profile-form select').selectOption('code');
await sleep(600);
await clickEl(w, '.profile-btn-save');
await sleep(sceneDur('create_profile') - 4000);

console.log('Scene: launch_profile');
const nodeRow = w.locator('.profile-row').filter({ hasText: 'Node REPL' });
await moveTo(w, '.profile-row >> nth=2');
await sleep(600);
const lb = nodeRow.locator('.profile-launch-btn');
if ((await lb.count()) > 0) {
  const box = await lb.boundingBox();
  if (box) await smoothMove(w, box.x + box.width / 2, box.y + box.height / 2);
  await sleep(300);
  await lb.click();
}
await sleep(sceneDur('launch_profile') - 1500);

console.log('Scene: right_click_menu');
await moveTo(w, '#btn-new-terminal');
await sleep(500);
await w.click('#btn-new-terminal', { button: 'right' });
await sleep(2000);
await w.keyboard.press('Escape');
await sleep(sceneDur('right_click_menu') - 3000);

console.log('Scene: outro');
await sleep(sceneDur('outro'));

console.log('Done.');
try {
  await app.evaluate(({ app: a }) => a.exit(0));
} catch {}
try {
  const pid = app.process().pid;
  if (pid) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
  }
} catch {}
process.exit(0);
