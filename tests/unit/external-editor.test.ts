// Unit tests for @agent-desk/core/external-editor (task #93d).
//
// We mock child_process.spawnSync (for detection via which/where) and
// child_process.spawn (for the openFile handoff) so the tests are isolated
// from the host's actual editor installs.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// child_process mock machinery
// ---------------------------------------------------------------------------
//
// We build a programmable mock that lets each test declare:
//   - which commands "which/where" should report as installed
//   - whether spawn() should emit an error before settling
//
// Both detection and openFile go through the same mocked module.

interface MockChild extends EventEmitter {
  unref: () => void;
}

let installed: Set<string>;
let spawnCalls: Array<{ cmd: string; args: string[]; options: Record<string, unknown> }>;
let spawnBehavior: 'ok' | 'error';
let spawnErrorMsg: string;

vi.mock('child_process', () => {
  return {
    spawnSync: vi.fn((tool: string, args: string[]) => {
      // Simulate which/where: stdout = path if the command is "installed"
      const cmd = args[0];
      if (installed.has(cmd)) {
        const path = process.platform === 'win32' ? `C:\\fake\\bin\\${cmd}.cmd` : `/usr/bin/${cmd}`;
        return {
          status: 0,
          stdout: `${path}\n`,
          stderr: '',
          pid: 1,
          output: [null, path, ''],
          signal: null,
        };
      }
      return { status: 1, stdout: '', stderr: 'not found', pid: 1, output: [null, '', 'not found'], signal: null };
    }),
    spawn: vi.fn((cmd: string, args: string[], options: Record<string, unknown>) => {
      spawnCalls.push({ cmd, args, options });
      const child = new EventEmitter() as MockChild;
      child.unref = () => {};
      if (spawnBehavior === 'error') {
        // Emit asynchronously so the once('error', …) listener is attached first.
        setImmediate(() => child.emit('error', new Error(spawnErrorMsg)));
      }
      return child;
    }),
  };
});

// Mock fs.existsSync to report all extraPaths as absent so detection doesn't
// leak into the host filesystem. Tests that want to exercise the probe path
// can override installed via the which mock.
vi.mock('fs', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('fs');
  return {
    ...actual,
    existsSync: vi.fn(() => false),
  };
});

beforeEach(() => {
  installed = new Set();
  spawnCalls = [];
  spawnBehavior = 'ok';
  spawnErrorMsg = '';
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function load() {
  return await import('../../packages/core/src/external-editor.js');
}

// ---------------------------------------------------------------------------
// detectEditors
// ---------------------------------------------------------------------------

describe('external-editor — detectEditors', () => {
  it('returns [] when no editors are on PATH', async () => {
    installed = new Set();
    const { detectEditors } = await load();
    const result = detectEditors();
    expect(result).toEqual([]);
  });

  it('detects VS Code when `code` is on PATH', async () => {
    installed = new Set(['code']);
    const { detectEditors } = await load();
    const result = detectEditors();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'code',
      name: 'VS Code',
      command: 'code',
      hasUrlScheme: true,
    });
    expect(result[0].path).toMatch(/code/);
  });

  it('detects multiple editors in catalog order', async () => {
    installed = new Set(['code', 'cursor', 'codium']);
    const { detectEditors } = await load();
    const result = detectEditors();
    const ids = result.map((e) => e.id);
    expect(ids).toEqual(['code', 'cursor', 'codium']);
  });

  it('detects VSCodium via either `codium` or `vscodium` CLI', async () => {
    installed = new Set(['vscodium']);
    const { detectEditors } = await load();
    const result = detectEditors();
    const codium = result.find((e) => e.id === 'codium');
    expect(codium).toBeTruthy();
    expect(codium!.command).toBe('vscodium');
  });

  it('reports hasUrlScheme=true for all catalog entries', async () => {
    installed = new Set(['code', 'cursor', 'windsurf', 'codium']);
    const { detectEditors } = await load();
    const result = detectEditors();
    expect(result.every((e) => e.hasUrlScheme === true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildEditorUrl
// ---------------------------------------------------------------------------

describe('external-editor — buildEditorUrl', () => {
  // Note: path.resolve prepends the drive on Windows, so we assert on the
  // tail of the URL rather than hardcoding the absolute path.

  it('builds a vscode://file URL with line:col for VS Code', async () => {
    const { buildEditorUrl } = await load();
    const url = buildEditorUrl('code', '/tmp/foo.ts', 42, 7);
    expect(url).not.toBeNull();
    expect(url!.startsWith('vscode://file/')).toBe(true);
    expect(url!.endsWith('foo.ts:42:7')).toBe(true);
  });

  it('builds a cursor:// URL with line only', async () => {
    const { buildEditorUrl } = await load();
    const url = buildEditorUrl('cursor', '/home/u/foo.py', 10);
    expect(url).not.toBeNull();
    expect(url!.startsWith('cursor://file/')).toBe(true);
    expect(url!.endsWith('foo.py:10')).toBe(true);
    // No col suffix
    expect(url!.match(/:\d+:\d+$/)).toBeNull();
  });

  it('builds a windsurf:// URL without line', async () => {
    const { buildEditorUrl } = await load();
    const url = buildEditorUrl('windsurf', '/home/u/bar.rs');
    expect(url).not.toBeNull();
    expect(url!.startsWith('windsurf://file/')).toBe(true);
    expect(url!.endsWith('bar.rs')).toBe(true);
  });

  it('builds a vscodium:// URL', async () => {
    const { buildEditorUrl } = await load();
    const url = buildEditorUrl('codium', '/etc/hosts', 1, 1);
    expect(url).not.toBeNull();
    expect(url!.startsWith('vscodium://file/')).toBe(true);
    expect(url!.endsWith('hosts:1:1')).toBe(true);
  });

  it('returns null for an unknown editor id', async () => {
    const { buildEditorUrl } = await load();
    expect(buildEditorUrl('nope', '/tmp/foo.ts')).toBeNull();
  });

  it('URL-encodes unsafe path characters', async () => {
    const { buildEditorUrl } = await load();
    const url = buildEditorUrl('code', '/tmp/with space.ts', 3);
    // encodeURI preserves /: so the space becomes %20.
    expect(url).toContain('%20');
  });

  it('normalizes Windows backslashes to forward slashes', async () => {
    const { buildEditorUrl } = await load();
    const url = buildEditorUrl('code', '/foo/bar.ts');
    expect(url).not.toBeNull();
    // URL must not contain literal backslashes
    expect(url).not.toContain('\\');
  });
});

// ---------------------------------------------------------------------------
// openFile
// ---------------------------------------------------------------------------

describe('external-editor — openFile', () => {
  it('returns { ok: false, reason: no-editor-detected } when nothing is installed', async () => {
    installed = new Set();
    const { openFile } = await load();
    const r = await openFile('code', '/tmp/foo.ts');
    expect(r).toEqual({ ok: false, reason: 'no-editor-detected' });
  });

  it('spawns the chosen editor with --goto path:line:col', async () => {
    installed = new Set(['code']);
    const { openFile } = await load();
    const r = await openFile('code', '/tmp/foo.ts', 42, 7);
    expect(r.ok).toBe(true);
    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0].cmd).toBe('code');
    expect(spawnCalls[0].args[0]).toBe('--goto');
    expect(spawnCalls[0].args[1]).toMatch(/foo\.ts:42:7$/);
  });

  it('spawns detached + stdio ignored so the editor outlives the parent', async () => {
    installed = new Set(['code']);
    const { openFile } = await load();
    await openFile('code', '/tmp/foo.ts');
    const opts = spawnCalls[0].options;
    expect(opts.detached).toBe(true);
    expect(opts.stdio).toBe('ignore');
  });

  it('uses shell: true on Windows so .cmd wrappers resolve', async () => {
    installed = new Set(['code']);
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const { openFile } = await load();
      await openFile('code', '/tmp/foo.ts');
      expect(spawnCalls[0].options.shell).toBe(true);
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('omits the :line suffix when line is undefined', async () => {
    installed = new Set(['code']);
    const { openFile } = await load();
    await openFile('code', '/tmp/foo.ts');
    expect(spawnCalls[0].args[1]).not.toMatch(/:\d+/);
  });

  it('falls back to the first detected editor when the requested id is missing', async () => {
    installed = new Set(['cursor']);
    const { openFile } = await load();
    const r = await openFile('code', '/tmp/foo.ts');
    expect(r.ok).toBe(true);
    expect(spawnCalls[0].cmd).toBe('cursor');
  });

  it('returns { ok: false, reason: spawn-failed } when spawn errors', async () => {
    installed = new Set(['code']);
    spawnBehavior = 'error';
    spawnErrorMsg = 'ENOENT';
    const { openFile } = await load();
    const r = await openFile('code', '/tmp/foo.ts');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/spawn-failed/);
    expect(r.reason).toMatch(/ENOENT/);
  });
});

// ---------------------------------------------------------------------------
// editor handlers wiring
// ---------------------------------------------------------------------------

describe('editor-handlers — wiring through buildEditorHandlers', () => {
  it('editor:detect returns the detectEditors result', async () => {
    installed = new Set(['code', 'cursor']);
    const { buildEditorHandlers } = await import('../../packages/core/src/handlers/editor-handlers.js');
    const handlers = buildEditorHandlers();
    const result = handlers['editor:detect']();
    expect(Array.isArray(result)).toBe(true);
    expect((result as Array<{ id: string }>).map((e) => e.id)).toContain('code');
  });

  it('editor:open forwards to openFile and returns the result', async () => {
    installed = new Set(['code']);
    const { buildEditorHandlers } = await import('../../packages/core/src/handlers/editor-handlers.js');
    const handlers = buildEditorHandlers();
    const result = await handlers['editor:open']('code', '/tmp/foo.ts', 1, 2);
    expect(result).toEqual({ ok: true });
    expect(spawnCalls[0].args[1]).toMatch(/:1:2$/);
  });
});
