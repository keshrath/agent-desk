// Real end-to-end test against the Electron desktop. Launches agent-desk
// via playwright-electron, drives ipcRenderer directly inside the renderer
// to:
//   1. Create a real pty running `claude -p "Reply with only the digit 4"`
//   2. Subscribe to terminal:data
//   3. Assert "4" appears in the captured output before a hard timeout
//   4. Kill the pty
//
// Mirrors tests/e2e/web/claude-shell.spec.ts but exercises the Electron IPC
// transport instead of the WebSocket transport. Same handler implementation
// in @agent-desk/core powers both — this test proves the dual-target claim.

import { test, expect } from '@playwright/test';
import { spawnSync } from 'child_process';
import { launchApp, closeApp } from './helpers.js';
import type { ElectronApplication, Page } from 'playwright';

const claudeAvailable = (() => {
  try {
    const r = spawnSync('claude', ['--version'], { stdio: 'pipe' });
    return r.status === 0;
  } catch {
    return false;
  }
})();

test.describe('Electron desktop real claude shell e2e', () => {
  test.skip(!claudeAvailable, 'claude CLI not on PATH');

  let app: ElectronApplication;
  let window: Page;

  test.beforeAll(async () => {
    const launched = await launchApp();
    app = launched.app;
    window = launched.window;
  });

  test.afterAll(async () => {
    if (app) await closeApp(app);
  });

  test('spawns claude in a terminal via IPC and captures the response', async () => {
    test.setTimeout(60_000);

    const result = await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ad = (window as any).agentDesk;
      if (!ad) return { ok: false, output: '', error: 'window.agentDesk missing' };

      let buffer = '';
      let resolved = false;
      let termId: string | null = null;

      const settled = new Promise<{ ok: boolean; output: string; error?: string }>((resolve) => {
        const hardTimeout = setTimeout(() => {
          if (resolved) return;
          resolved = true;
          if (termId) ad.terminal.kill(termId).catch(() => {});
          resolve({ ok: false, output: buffer, error: 'hard timeout (45s)' });
        }, 45_000);

        const offData = ad.terminal.onData((id: string, data: string) => {
          if (id !== termId) return;
          buffer += data;
          if (buffer.includes('4') && !resolved) {
            resolved = true;
            clearTimeout(hardTimeout);
            setTimeout(() => {
              try {
                offData?.();
              } catch {
                /* noop */
              }
              if (termId) ad.terminal.kill(termId).catch(() => {});
              resolve({ ok: true, output: buffer });
            }, 200);
          }
        });

        const offExit = ad.terminal.onExit((id: string) => {
          if (id !== termId || resolved) return;
          resolved = true;
          clearTimeout(hardTimeout);
          try {
            offData?.();
            offExit?.();
          } catch {
            /* noop */
          }
          resolve({ ok: buffer.includes('4'), output: buffer });
        });
      });

      const created = await ad.terminal.create({
        command: 'claude',
        args: ['-p', 'Reply with only the digit 4 and nothing else'],
        cols: 120,
        rows: 30,
      });
      if (!created || !created.id) {
        return { ok: false, output: '', error: 'terminal:create returned null' };
      }
      termId = created.id;
      ad.terminal.subscribe(termId);

      return await settled;
    });

    if (!result.ok) {
      console.error('electron claude e2e output:', result.output);
      console.error('error:', result.error);
    }
    expect(result.ok).toBe(true);
    expect(result.output).toContain('4');
  });
});
