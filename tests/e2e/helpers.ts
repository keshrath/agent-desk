/**
 * Shared helpers for Agent Desk Electron E2E tests.
 *
 * Provides a reusable launch/teardown lifecycle so every spec file
 * doesn't have to repeat the boilerplate.
 */

import { _electron as electron, ElectronApplication, Page } from 'playwright';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * Build the TypeScript sources (main + preload) so `dist/` is up-to-date.
 * This is a no-op if the build is already current (tsc is fast for incremental).
 */
export function buildApp(): void {
  execSync('npm run build', {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
    timeout: 30_000,
  });
}

/**
 * Launch the Electron app and return the application handle + first window.
 *
 * The caller is responsible for calling `app.close()` when done (typically
 * in an `afterAll` / `afterEach` hook).
 */
export async function launchApp(retries = 3): Promise<{ app: ElectronApplication; window: Page }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 2000));
      }

      const app = await electron.launch({
        args: ['.'],
        cwd: PROJECT_ROOT,
      });

      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      window.on('console', (msg) => {
        if (msg.type() === 'error') {
          console.log(`[renderer error] ${msg.text()}`);
        }
      });

      window.on('pageerror', (err) => {
        console.log(`[renderer pageerror] ${err.message}`);
      });

      await window.waitForTimeout(3000);

      return { app, window };
    } catch (err) {
      lastError = err as Error;
      console.log(`[launchApp] attempt ${attempt + 1}/${retries} failed: ${(err as Error).message}`);
    }
  }

  throw lastError || new Error('Failed to launch app');
}

/**
 * Gracefully close the Electron app.
 *
 * The app uses a system tray that prevents `window.close()` from actually
 * quitting.  We call `app.quit()` from the main process first so the
 * tray is torn down, then close the Playwright handle.
 */
export async function closeApp(app: ElectronApplication): Promise<void> {
  const proc = app.process();
  const pid = proc.pid;

  try {
    await Promise.race([
      app.evaluate(({ app: electronApp }) => electronApp.exit(0)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    /* expected — process exits before evaluate resolves */
  }

  if (pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`cmd.exe /c taskkill /F /T /PID ${pid}`, { stdio: 'pipe', timeout: 5000 });
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      /* already dead */
    }
  }

  await new Promise((r) => setTimeout(r, 1000));
}

export async function screenshotOnFailure(
  window: Page,
  testInfo: { status?: string; title: string; outputPath: (...args: string[]) => string },
): Promise<void> {
  if (testInfo.status !== 'passed') {
    try {
      const screenshotPath = testInfo.outputPath(`failure-${Date.now()}.png`);
      await window.screenshot({ path: screenshotPath });
    } catch {
      // Window may already be closed
    }
  }
}
