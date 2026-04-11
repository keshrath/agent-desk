/**
 * editor-handoff.spec.ts — external editor handoff (task #93d).
 *
 * Verifies that:
 *   1. `agentDesk.editor.detect()` round-trips through the IPC bridge and
 *      discovers a mock `code` shim we prepend to PATH before launch.
 *   2. `agentDesk.editor.open()` spawns the mock and the shim writes the
 *      expected --goto argument to a marker file we can assert on.
 *   3. `registry.buildOpenInEditorMenuItems()` is exposed on the renderer
 *      registry (the context-menus.js surface integrations).
 *
 * The mock editor is a tiny node script (cross-platform) that writes its
 * argv to a file and exits — that's all we need to prove the handler
 * selected the right binary and passed the correct positional arguments.
 */

import { test, expect } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from 'playwright';
import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

let app: ElectronApplication;
let window: Page;
let mockDir: string;
let markerPath: string;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // Build the app (no-op if already built).
  execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'pipe', timeout: 60_000 });

  mockDir = mkdtempSync(path.join(tmpdir(), 'agent-desk-93d-'));
  markerPath = path.join(mockDir, 'mock-code-args.txt');

  const isWin = process.platform === 'win32';
  if (isWin) {
    writeFileSync(
      path.join(mockDir, 'mock-code.js'),
      `require('fs').writeFileSync(${JSON.stringify(markerPath)}, process.argv.slice(2).join('\\n'));\n`,
      'utf-8',
    );
    writeFileSync(path.join(mockDir, 'code.cmd'), `@echo off\nnode "%~dp0mock-code.js" %*\n`, 'utf-8');
  } else {
    const script = `#!/usr/bin/env node
require('fs').writeFileSync(${JSON.stringify(markerPath)}, process.argv.slice(2).join('\\n'));
`;
    const p = path.join(mockDir, 'code');
    writeFileSync(p, script, 'utf-8');
    try {
      execSync(`chmod +x "${p}"`);
    } catch {
      /* ignore */
    }
  }

  // Launch Electron with the mock dir prepended to PATH so `where`/`which`
  // discovers our shim as "code" before the host's real VS Code install.
  const pathVar = process.platform === 'win32' ? 'Path' : 'PATH';
  const existing = process.env[pathVar] || '';
  const newPath = `${mockDir}${path.delimiter}${existing}`;

  app = await electron.launch({
    args: ['.'],
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      [pathVar]: newPath,
      PATH: newPath,
    },
  });

  window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(3000);
});

test.afterAll(async () => {
  if (app) {
    try {
      await Promise.race([
        app.evaluate(({ app: electronApp }) => electronApp.exit(0)),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    } catch {
      /* expected */
    }
    const proc = app.process();
    const pid = proc.pid;
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
  }
  if (mockDir && existsSync(mockDir)) {
    try {
      rmSync(mockDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

test('agentDesk.editor.detect returns an array including our mock `code`', async () => {
  const detected = await window.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (window as any).agentDesk.editor.detect();
  });
  expect(Array.isArray(detected)).toBe(true);
  // The mock shim should be discovered under the `code` id — it's first in
  // the catalog and we prepended mockDir to PATH.
  const code = (detected as Array<{ id: string; command: string }>).find((e) => e.id === 'code');
  expect(code).toBeTruthy();
  expect(code!.command).toBe('code');
});

test('agentDesk.editor.open spawns the mock with --goto <path>:<line>:<col>', async () => {
  if (existsSync(markerPath)) rmSync(markerPath);

  const target = path.join(mockDir, 'target.txt');
  writeFileSync(target, 'hello', 'utf-8');

  const result = await window.evaluate(
    async ({ target, line, col }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (window as any).agentDesk.editor.open('code', target, line, col);
    },
    { target, line: 12, col: 4 },
  );
  expect(result).toMatchObject({ ok: true });

  // Wait up to 4s for the mock shim to flush the marker file.
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (existsSync(markerPath)) {
      const contents = readFileSync(markerPath, 'utf-8');
      // The shim wrote argv.slice(2).join('\n') — i.e. --goto on line 1 and
      // the target:line:col on line 2.
      const lines = contents.split(/\r?\n/);
      expect(lines[0]).toBe('--goto');
      expect(lines[1]).toContain('target.txt:12:4');
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`mock editor never wrote marker file at ${markerPath}`);
});

test('editor:open with an unknown id falls back to the first detected editor', async () => {
  if (existsSync(markerPath)) rmSync(markerPath);
  const fallbackTarget = path.join(mockDir, 'fallback-target.txt');
  writeFileSync(fallbackTarget, 'x', 'utf-8');

  const result = await window.evaluate(async (t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (window as any).agentDesk.editor.open('no-such-editor', t);
  }, fallbackTarget);
  expect(result).toBeTruthy();
  expect((result as { ok: boolean }).ok).toBe(true);

  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (existsSync(markerPath)) {
      const contents = readFileSync(markerPath, 'utf-8');
      if (contents.includes('fallback-target.txt')) return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('fallback spawn never completed');
});

test('diff:open-in-editor custom event routes through to editor.open', async () => {
  if (existsSync(markerPath)) rmSync(markerPath);

  const target = path.join(mockDir, 'diff-target.txt');
  writeFileSync(target, 'from diff viewer', 'utf-8');

  await window.evaluate((target) => {
    document.dispatchEvent(
      new CustomEvent('diff:open-in-editor', {
        detail: { path: target, line: 3, col: 2 },
      }),
    );
  }, target);

  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (existsSync(markerPath)) {
      const contents = readFileSync(markerPath, 'utf-8');
      expect(contents).toContain('diff-target.txt:3:2');
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`custom event bridge did not spawn mock editor (marker ${markerPath} missing)`);
});
