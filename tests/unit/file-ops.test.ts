// Unit tests for @agent-desk/core/file-ops.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileStat, fileDirname, fileWrite } from '../../packages/core/src/file-ops.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-desk-file-ops-'));
});

afterEach(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

describe('file-ops', () => {
  it('fileStat() returns null for nonexistent files', () => {
    expect(fileStat(join(tmpDir, 'nope.txt'))).toBe(null);
  });

  it('fileStat() returns isFile + size for files', () => {
    const p = join(tmpDir, 'a.txt');
    writeFileSync(p, 'hello world', 'utf-8');
    const s = fileStat(p);
    expect(s).not.toBe(null);
    expect(s!.isFile).toBe(true);
    expect(s!.isDirectory).toBe(false);
    expect(s!.size).toBe(11);
  });

  it('fileStat() returns isDirectory for directories', () => {
    const dir = join(tmpDir, 'sub');
    mkdirSync(dir);
    const s = fileStat(dir);
    expect(s).not.toBe(null);
    expect(s!.isDirectory).toBe(true);
    expect(s!.isFile).toBe(false);
  });

  it('fileDirname() returns the parent directory', () => {
    expect(fileDirname('/a/b/c.txt').replace(/\\/g, '/')).toBe('/a/b');
  });

  it('fileWrite() writes UTF-8 content and returns true', () => {
    const p = join(tmpDir, 'out.txt');
    expect(fileWrite(p, 'unicode: ✓ é あ')).toBe(true);
    expect(readFileSync(p, 'utf-8')).toBe('unicode: ✓ é あ');
  });
});
