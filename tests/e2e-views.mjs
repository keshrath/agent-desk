// E2E test: launch agent-desk, click each tab, screenshot
import { _electron as electron } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, '..');

console.log('Launching agent-desk...');
const app = await electron.launch({
  args: ['.'],
  cwd: appDir,
});

const window = await app.firstWindow();
await window.waitForLoadState('domcontentloaded');
await window.waitForTimeout(3000); // Wait for app init

console.log('Taking screenshots...');

// Screenshot initial state (terminals view)
await window.screenshot({ path: join(appDir, 'tests/screenshots/01-terminals.png') });
console.log('01-terminals.png');

// Click each nav tab and screenshot
const tabs = [
  { name: 'comm', selector: '[data-view="comm"]', wait: 2000 },
  { name: 'tasks', selector: '[data-view="tasks"]', wait: 2000 },
  { name: 'knowledge', selector: '[data-view="knowledge"]', wait: 2000 },
  { name: 'discover', selector: '[data-view="discover"]', wait: 2000 },
  { name: 'monitor', selector: '[data-view="monitor"]', wait: 1000 },
];

for (const tab of tabs) {
  try {
    const btn = await window.$(tab.selector);
    if (btn) {
      await btn.click();
      await window.waitForTimeout(tab.wait);
      await window.screenshot({ path: join(appDir, `tests/screenshots/02-${tab.name}.png`) });
      console.log(`02-${tab.name}.png - OK`);
    } else {
      console.log(`02-${tab.name}.png - SKIP (button not found)`);
    }
  } catch (err) {
    console.log(`02-${tab.name}.png - ERROR: ${err.message}`);
  }
}

const consoleErrors = [];
window.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

// Click back through to check for JS errors
for (const tab of tabs) {
  try {
    const btn = await window.$(tab.selector);
    if (btn) {
      await btn.click();
      await window.waitForTimeout(500);
    }
  } catch { /* skip */ }
}
await window.waitForTimeout(1000);

if (consoleErrors.length > 0) {
  console.log('\nConsole errors:');
  consoleErrors.forEach((e) => console.log('  ERROR:', e));
} else {
  console.log('\nNo console errors detected');
}

console.log('\nClosing...');
await app.close();
console.log('Done.');
