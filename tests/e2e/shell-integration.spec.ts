/**
 * shell-integration.spec.ts — F8: Shell Integration
 *
 * Tests the ShellIntegration module for OSC sequence parsing,
 * directory tracking, command boundaries, exit codes, setup snippets,
 * and the settings section.
 */

import { test, expect } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
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

test.afterEach(async ({}, testInfo) => {
  await screenshotOnFailure(window, testInfo);
});

// ── ShellIntegration Module ──────────────────────────────────────────

test('ShellIntegration global is available', async () => {
  const exists = await window.evaluate('typeof ShellIntegration !== "undefined"');
  expect(exists).toBe(true);
});

test('ShellIntegration has expected methods', async () => {
  const methods = (await window.evaluate(`({
    processData: typeof ShellIntegration.processData === 'function',
    getCwd: typeof ShellIntegration.getCwd === 'function',
    isActive: typeof ShellIntegration.isActive === 'function',
    getLastExitCode: typeof ShellIntegration.getLastExitCode === 'function',
    getLastCommand: typeof ShellIntegration.getLastCommand === 'function',
    getCommands: typeof ShellIntegration.getCommands === 'function',
    cleanup: typeof ShellIntegration.cleanup === 'function',
    getSetupSnippet: typeof ShellIntegration.getSetupSnippet === 'function',
    getAvailableShells: typeof ShellIntegration.getAvailableShells === 'function',
  })`)) as Record<string, boolean>;
  Object.values(methods).forEach((v) => expect(v).toBe(true));
});

// ── OSC 7 Directory Tracking ─────────────────────────────────────────

test('OSC 7 sets cwd for terminal', async () => {
  const cwd = await window.evaluate(`(() => {
    ShellIntegration.processData('test-osc7', '\\x1b]7;file:///home/user/project\\x07', 0);
    return ShellIntegration.getCwd('test-osc7');
  })()`);
  expect(cwd).toContain('/home/user/project');
});

test('OSC 7 with Windows path', async () => {
  const cwd = await window.evaluate(`(() => {
    ShellIntegration.processData('test-osc7-win', '\\x1b]7;file:///C:/Users/test/project\\x07', 0);
    return ShellIntegration.getCwd('test-osc7-win');
  })()`);
  expect(cwd).toContain('C:/Users/test/project');
});

test('isActive returns true after OSC 7', async () => {
  const active = await window.evaluate(`(() => {
    ShellIntegration.processData('test-active', '\\x1b]7;file:///tmp\\x07', 0);
    return ShellIntegration.isActive('test-active');
  })()`);
  expect(active).toBe(true);
});

test('isActive returns false for unknown terminal', async () => {
  const active = await window.evaluate(`ShellIntegration.isActive('nonexistent-terminal')`);
  expect(active).toBe(false);
});

// ── OSC 133 Command Boundaries ───────────────────────────────────────

test('OSC 133 A/B/C/D marks detect command lifecycle', async () => {
  const result = (await window.evaluate(`(() => {
    const id = 'test-osc133';
    const eventsA = ShellIntegration.processData(id, '\\x1b]133;A\\x07', 10);
    const eventsB = ShellIntegration.processData(id, '\\x1b]133;B\\x07', 11);
    const eventsC = ShellIntegration.processData(id, '\\x1b]133;C\\x07', 12);
    const eventsD = ShellIntegration.processData(id, '\\x1b]133;D;0\\x07', 20);
    return {
      promptStart: eventsA.some(e => e.type === 'prompt-start'),
      commandStart: eventsB.some(e => e.type === 'command-start'),
      outputStart: eventsC.some(e => e.type === 'output-start'),
      commandEnd: eventsD.some(e => e.type === 'command-end'),
      exitCode: ShellIntegration.getLastExitCode(id),
    };
  })()`)) as any;
  expect(result.promptStart).toBe(true);
  expect(result.commandStart).toBe(true);
  expect(result.outputStart).toBe(true);
  expect(result.commandEnd).toBe(true);
  expect(result.exitCode).toBe(0);
});

test('OSC 133 D captures non-zero exit code', async () => {
  const exitCode = await window.evaluate(`(() => {
    const id = 'test-exit-code';
    ShellIntegration.processData(id, '\\x1b]133;A\\x07', 1);
    ShellIntegration.processData(id, '\\x1b]133;B\\x07', 2);
    ShellIntegration.processData(id, '\\x1b]133;C\\x07', 3);
    ShellIntegration.processData(id, '\\x1b]133;D;127\\x07', 10);
    return ShellIntegration.getLastExitCode(id);
  })()`);
  expect(exitCode).toBe(127);
});

test('getLastCommand returns last completed command info', async () => {
  const cmd = (await window.evaluate(`(() => {
    const id = 'test-last-cmd';
    ShellIntegration.processData(id, '\\x1b]133;A\\x07', 1);
    ShellIntegration.processData(id, '\\x1b]133;B\\x07', 2);
    ShellIntegration.processData(id, '\\x1b]133;C\\x07', 3);
    ShellIntegration.processData(id, '\\x1b]133;D;0\\x07', 10);
    return ShellIntegration.getLastCommand(id);
  })()`)) as any;
  expect(cmd).toBeTruthy();
  expect(cmd.exitCode).toBe(0);
  expect(cmd.startLine).toBe(2);
  expect(cmd.endLine).toBe(10);
});

test('getCommands returns command history', async () => {
  const commands = (await window.evaluate(`(() => {
    const id = 'test-cmd-history';
    for (let i = 0; i < 3; i++) {
      ShellIntegration.processData(id, '\\x1b]133;A\\x07', i * 10);
      ShellIntegration.processData(id, '\\x1b]133;B\\x07', i * 10 + 1);
      ShellIntegration.processData(id, '\\x1b]133;C\\x07', i * 10 + 2);
      ShellIntegration.processData(id, '\\x1b]133;D;' + i + '\\x07', i * 10 + 9);
    }
    return ShellIntegration.getCommands(id);
  })()`)) as any[];
  expect(commands.length).toBe(3);
});

// ── OSC 1337 (iTerm2) ────────────────────────────────────────────────

test('OSC 1337 CurrentDir sets cwd', async () => {
  const cwd = await window.evaluate(`(() => {
    ShellIntegration.processData('test-iterm', '\\x1b]1337;CurrentDir=/home/user\\x07', 0);
    return ShellIntegration.getCwd('test-iterm');
  })()`);
  expect(cwd).toBe('/home/user');
});

// ── Shell Setup Snippets ─────────────────────────────────────────────

test('getAvailableShells returns expected shells', async () => {
  const shells = (await window.evaluate(`ShellIntegration.getAvailableShells()`)) as string[];
  expect(shells).toContain('bash');
  expect(shells).toContain('zsh');
  expect(shells).toContain('fish');
  expect(shells).toContain('powershell');
});

test('getSetupSnippet returns non-empty string for each shell', async () => {
  const snippets = (await window.evaluate(`
    ShellIntegration.getAvailableShells().map(shell => ({
      shell, hasSnippet: !!ShellIntegration.getSetupSnippet(shell)
    }))
  `)) as any[];
  snippets.forEach((s) => expect(s.hasSnippet).toBe(true));
});

test('bash snippet contains OSC 133', async () => {
  const snippet = await window.evaluate(`ShellIntegration.getSetupSnippet('bash')`);
  expect(snippet).toContain('133');
});

// ── Cleanup ──────────────────────────────────────────────────────────

test('cleanup removes terminal state', async () => {
  await window.evaluate(`(() => {
    ShellIntegration.processData('test-cleanup-si', '\\x1b]7;file:///tmp\\x07', 0);
    ShellIntegration.cleanup('test-cleanup-si');
  })()`);

  const cwd = await window.evaluate(`ShellIntegration.getCwd('test-cleanup-si')`);
  expect(cwd).toBeNull();
});

// ── Settings Section ─────────────────────────────────────────────────

test('shell integration section exists in settings', async () => {
  await window.locator('#sidebar .nav-btn[data-view="settings"]').click();
  await window.waitForTimeout(500);

  const section = window.locator('#settings-panel .settings-section').filter({ hasText: 'Shell Integration' });
  await expect(section).toBeAttached();

  await window.locator('#sidebar .nav-btn[data-view="terminals"]').click();
  await window.waitForTimeout(300);
});
