// Unit tests for @agent-desk/core/keybindings-store.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-desk-keybindings-'));
  process.env.AGENT_DESK_USER_DATA = tmpDir;
  vi.resetModules();
});

afterEach(() => {
  delete process.env.AGENT_DESK_USER_DATA;
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

describe('keybindings-store', () => {
  it('readKeybindings() returns {} when the file does not exist', async () => {
    const { readKeybindings, KEYBINDINGS_FILE } = await import('../../packages/core/src/keybindings-store.js');
    expect(readKeybindings()).toEqual({});
    expect(existsSync(KEYBINDINGS_FILE)).toBe(false);
  });

  it('writeKeybindings() persists and read returns it', async () => {
    const { readKeybindings, writeKeybindings } = await import('../../packages/core/src/keybindings-store.js');
    const ok = writeKeybindings({ 'cmd-palette': 'ctrl+shift+p', 'force-quit': null });
    expect(ok).toBe(true);
    const data = readKeybindings();
    expect(data['cmd-palette']).toBe('ctrl+shift+p');
    expect(data['force-quit']).toBe(null);
  });

  it('readKeybindings() returns {} when the file is malformed', async () => {
    const { readKeybindings, KEYBINDINGS_FILE } = await import('../../packages/core/src/keybindings-store.js');
    writeFileSync(KEYBINDINGS_FILE, 'not json', 'utf-8');
    expect(readKeybindings()).toEqual({});
  });

  it('writeKeybindings() creates the parent dir if missing', async () => {
    const { writeKeybindings, KEYBINDINGS_FILE } = await import('../../packages/core/src/keybindings-store.js');
    writeKeybindings({ test: 'F1' });
    expect(existsSync(KEYBINDINGS_FILE)).toBe(true);
  });
});
