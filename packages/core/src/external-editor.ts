// External editor handoff — detect installed VS Code-family editors and open
// files in them via child_process spawn (task #93d).
//
// Core is Node-only; we cannot import electron here. The handler spawns the
// detected editor CLI directly. For URL-scheme handoff (vscode://file/...),
// the renderer can call agentDesk.openExternal — but note that the desktop
// preload currently blocks non-http(s) schemes, so this module focuses on the
// spawn path. We still expose buildEditorUrl so any future allow-list update
// in the preload or a web target can reuse it.

import { spawnSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve as pathResolve } from 'path';
import { homedir, platform as osPlatform } from 'os';

import type { DetectedEditor, EditorOpenResult } from './transport/channels.js';

// ---------------------------------------------------------------------------
// Editor catalog
// ---------------------------------------------------------------------------

interface EditorSpec {
  id: string;
  name: string;
  commands: string[]; // candidate CLI names (first found wins)
  urlScheme: string; // empty string if the editor does not register one
  /** Extra probe paths (per-platform) relative to homedir or absolute. */
  extraPaths?: {
    win32?: string[];
    darwin?: string[];
    linux?: string[];
  };
}

const EDITORS: EditorSpec[] = [
  {
    id: 'code',
    name: 'VS Code',
    commands: ['code'],
    urlScheme: 'vscode',
    extraPaths: {
      win32: [
        join('AppData', 'Local', 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
        join('AppData', 'Local', 'Programs', 'Microsoft VS Code', 'Code.exe'),
      ],
      darwin: ['/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'],
      linux: ['/usr/bin/code', '/usr/local/bin/code', '/snap/bin/code'],
    },
  },
  {
    id: 'code-insiders',
    name: 'VS Code Insiders',
    commands: ['code-insiders'],
    urlScheme: 'vscode-insiders',
    extraPaths: {
      win32: [join('AppData', 'Local', 'Programs', 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd')],
      darwin: ['/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code-insiders'],
      linux: ['/usr/bin/code-insiders', '/usr/local/bin/code-insiders'],
    },
  },
  {
    id: 'cursor',
    name: 'Cursor',
    commands: ['cursor'],
    urlScheme: 'cursor',
    extraPaths: {
      win32: [
        join('AppData', 'Local', 'Programs', 'cursor', 'resources', 'app', 'bin', 'cursor.cmd'),
        join('AppData', 'Local', 'cursor', 'resources', 'app', 'bin', 'cursor.cmd'),
      ],
      darwin: ['/Applications/Cursor.app/Contents/Resources/app/bin/cursor'],
      linux: ['/usr/bin/cursor', '/usr/local/bin/cursor'],
    },
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    commands: ['windsurf'],
    urlScheme: 'windsurf',
    extraPaths: {
      win32: [join('AppData', 'Local', 'Programs', 'Windsurf', 'bin', 'windsurf.cmd')],
      darwin: ['/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf'],
      linux: ['/usr/bin/windsurf', '/usr/local/bin/windsurf'],
    },
  },
  {
    id: 'codium',
    name: 'VSCodium',
    commands: ['codium', 'vscodium'],
    urlScheme: 'vscodium',
    extraPaths: {
      win32: [join('AppData', 'Local', 'Programs', 'VSCodium', 'bin', 'codium.cmd')],
      darwin: ['/Applications/VSCodium.app/Contents/Resources/app/bin/codium'],
      linux: ['/usr/bin/codium', '/usr/local/bin/codium', '/snap/bin/codium'],
    },
  },
];

// ---------------------------------------------------------------------------
// Which/where helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a CLI command to an absolute path using the platform's which/where
 * command. Returns null when the command is not on PATH.
 */
export function whichCommand(cmd: string): string | null {
  const isWin = osPlatform() === 'win32';
  try {
    const tool = isWin ? 'where' : 'which';
    // where can return multiple lines on Windows; pick the first hit.
    const result = spawnSync(tool, [cmd], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      encoding: 'utf-8',
    });
    if (result.status !== 0 || !result.stdout) return null;
    const first = result.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean);
    return first ?? null;
  } catch {
    return null;
  }
}

function probeExtraPaths(spec: EditorSpec): string | null {
  const plat = osPlatform() as 'win32' | 'darwin' | 'linux';
  const paths = spec.extraPaths?.[plat] ?? [];
  for (const p of paths) {
    const abs = p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p) ? p : join(homedir(), p);
    try {
      if (existsSync(abs)) return abs;
    } catch {
      /* ignore */
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API — detection
// ---------------------------------------------------------------------------

/**
 * Detect installed VS Code-family editors by probing PATH (`which`/`where`)
 * and a small set of well-known install directories per platform.
 *
 * Returns an array in catalog order; the first entry is a reasonable default.
 */
export function detectEditors(): DetectedEditor[] {
  const found: DetectedEditor[] = [];
  for (const spec of EDITORS) {
    let cmd: string | null = null;
    let resolvedPath: string | null = null;

    // 1. which/where on each candidate CLI name
    for (const candidate of spec.commands) {
      const hit = whichCommand(candidate);
      if (hit) {
        cmd = candidate;
        resolvedPath = hit;
        break;
      }
    }

    // 2. Fallback to extra install-path probes
    if (!resolvedPath) {
      const probed = probeExtraPaths(spec);
      if (probed) {
        resolvedPath = probed;
        cmd = spec.commands[0];
      }
    }

    if (cmd && resolvedPath) {
      found.push({
        id: spec.id,
        name: spec.name,
        command: cmd,
        path: resolvedPath,
        hasUrlScheme: Boolean(spec.urlScheme),
      });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Public API — URL builder (exported for renderer/web fallback use)
// ---------------------------------------------------------------------------

/**
 * Build an editor URL like `vscode://file/<absPath>:<line>:<col>` for the
 * given editor id. Returns null when the editor is unknown or has no URL
 * scheme registered.
 *
 * The renderer may call this to pass a URL into `shell.openExternal`, but
 * note that agent-desk's current desktop preload only allows http(s) URLs —
 * so practical handoff on desktop goes through `openFile()` (spawn) instead.
 */
export function buildEditorUrl(editorId: string, filePath: string, line?: number, col?: number): string | null {
  const spec = EDITORS.find((e) => e.id === editorId);
  if (!spec || !spec.urlScheme) return null;
  const abs = resolveAbsolute(filePath);
  // encodeURI preserves forward slashes; the format VS Code expects is
  // vscode://file/<path>:<line>:<col> with the path unencoded except for
  // unsafe chars.
  const encoded = encodeURI(abs.replace(/\\/g, '/'));
  const suffix = typeof line === 'number' ? `:${line}${typeof col === 'number' ? `:${col}` : ''}` : '';
  return `${spec.urlScheme}://file/${encoded}${suffix}`;
}

// ---------------------------------------------------------------------------
// Public API — opening a file
// ---------------------------------------------------------------------------

function resolveAbsolute(filePath: string): string {
  // Light wrapper so tests can mock. Imported at module top would be
  // fine, but we keep this as a helper to centralize the call site.
  return pathResolve(filePath);
}

/**
 * Spawn the detected editor CLI with `--goto <path>:<line>:<col>` so it opens
 * the file at the requested position. Detached + unref so the editor outlives
 * the agent-desk process even if the user closes the app later.
 *
 * The spawn is intentionally best-effort: we return an EditorOpenResult so
 * the renderer can surface a toast on failure and (on web or when running
 * against a URL-scheme allow-list) fall back to `buildEditorUrl`.
 */
export async function openFile(
  editorId: string,
  filePath: string,
  line?: number,
  col?: number,
): Promise<EditorOpenResult> {
  const editors = detectEditors();
  const editor = editors.find((e) => e.id === editorId) ?? editors[0];
  if (!editor) {
    return { ok: false, reason: 'no-editor-detected' };
  }

  const absPath = resolveAbsolute(filePath);
  const target = typeof line === 'number' ? `${absPath}:${line}${typeof col === 'number' ? `:${col}` : ''}` : absPath;

  // VS Code family CLIs all accept `--goto <path>:<line>:<col>`.
  const args = ['--goto', target];

  try {
    const isWin = osPlatform() === 'win32';
    const child = spawn(editor.command, args, {
      detached: true,
      stdio: 'ignore',
      // .cmd / .bat wrappers on Windows require shell:true to resolve the
      // extension when spawn is given a bare command.
      shell: isWin,
      windowsHide: true,
    });
    // Let the parent exit even if the editor is still launching.
    child.unref();

    // spawn resolves synchronously; surface immediate launch errors through
    // a one-shot error listener so we can return a structured failure.
    return await new Promise<EditorOpenResult>((resolve) => {
      let settled = false;
      child.once('error', (err) => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, reason: `spawn-failed: ${err.message}` });
      });
      // Give the event loop a tick to deliver a synchronous ENOENT, then
      // assume the launch is in flight.
      setImmediate(() => {
        if (settled) return;
        settled = true;
        resolve({ ok: true });
      });
    });
  } catch (err) {
    return { ok: false, reason: `spawn-threw: ${(err as Error).message}` };
  }
}
