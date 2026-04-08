// Real end-to-end test: spawns @agent-desk/server in the playwright webServer
// fixture, opens a chromium tab pointed at the token-gated UI, then drives
// the WS bridge directly to:
//   1. Create a real pty running `claude -p "Reply with only the digit 4"`
//   2. Subscribe to terminal:data
//   3. Assert "4" appears in the captured output before a hard timeout
//   4. Kill the pty
//
// One claude invocation per test file. Cost is fractional cents per run.
// Skips cleanly if `claude` is not on PATH (the test fixture spawn() check).

import { test, expect } from '@playwright/test';
import { spawnSync } from 'child_process';

const TOKEN = 'playwright-e2e-token';

const claudeAvailable = (() => {
  try {
    const r = spawnSync('claude', ['--version'], { stdio: 'pipe' });
    return r.status === 0;
  } catch {
    return false;
  }
})();

test.describe('@agent-desk/server real claude shell e2e', () => {
  test.skip(!claudeAvailable, 'claude CLI not on PATH');

  test('spawns claude in a terminal via WS and captures the response', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto(`/healthz?t=${TOKEN}`).catch(() => {
      /* /healthz returns JSON; navigation may "fail" but the tab is on the origin */
    });

    const result = await page.evaluate(
      async ({ token }) => {
        return new Promise<{ ok: boolean; output: string; error?: string }>((resolve) => {
          const ws = new WebSocket(`ws://${location.host}/ws?t=${token}`);
          let nextId = 1;
          const pending = new Map<number, (v: unknown) => void>();
          let buffer = '';
          let termId: string | null = null;
          const hardTimeout = setTimeout(() => {
            try {
              ws.close();
            } catch {
              /* noop */
            }
            resolve({ ok: false, output: buffer, error: 'hard timeout (45s)' });
          }, 45_000);

          function rpc(ch: string, args: unknown[]): Promise<unknown> {
            const id = nextId++;
            return new Promise((r) => {
              pending.set(id, r);
              ws.send(JSON.stringify({ id, ch, args }));
            });
          }

          ws.onerror = () => {
            clearTimeout(hardTimeout);
            resolve({ ok: false, output: buffer, error: 'ws error' });
          };

          ws.onmessage = (ev) => {
            let msg: { id?: number; result?: unknown; error?: string; push?: string; args?: unknown[] };
            try {
              msg = JSON.parse(ev.data as string);
            } catch {
              return;
            }
            if (msg.id != null && pending.has(msg.id)) {
              const r = pending.get(msg.id)!;
              pending.delete(msg.id);
              r(msg.error ? { error: msg.error } : msg.result);
              return;
            }
            if (msg.push === 'terminal:data' && msg.args && msg.args[0] === termId) {
              buffer += String(msg.args[1] ?? '');
              if (buffer.includes('4')) {
                setTimeout(() => {
                  clearTimeout(hardTimeout);
                  if (termId) ws.send(JSON.stringify({ ch: 'terminal:kill', args: [termId] }));
                  ws.close();
                  resolve({ ok: true, output: buffer });
                }, 200);
              }
            }
            if (msg.push === 'terminal:exit' && msg.args && msg.args[0] === termId) {
              clearTimeout(hardTimeout);
              ws.close();
              resolve({ ok: buffer.includes('4'), output: buffer });
            }
          };

          ws.onopen = async () => {
            try {
              const created = (await rpc('terminal:create', [
                {
                  command: 'claude',
                  args: ['-p', 'Reply with only the digit 4 and nothing else'],
                  cols: 120,
                  rows: 30,
                },
              ])) as { id: string } | { error: string };
              if ('error' in created) {
                clearTimeout(hardTimeout);
                resolve({ ok: false, output: '', error: created.error });
                return;
              }
              termId = created.id;
              ws.send(JSON.stringify({ ch: 'terminal:subscribe', args: [termId] }));
            } catch (err) {
              clearTimeout(hardTimeout);
              resolve({ ok: false, output: buffer, error: String(err) });
            }
          };
        });
      },
      { token: TOKEN },
    );

    if (!result.ok) {
      console.error('claude e2e output buffer:', result.output);
      console.error('error:', result.error);
    }
    expect(result.ok).toBe(true);
    expect(result.output).toContain('4');
  });
});
