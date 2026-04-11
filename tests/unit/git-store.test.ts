// Unit tests for @agent-desk/core/git-store (task #93b).
//
// Uses the system `git` CLI directly via execFileSync to spin up disposable
// fixture repos. Does NOT import simple-git — that's a transitive dep of
// @agent-desk/core and isn't guaranteed to be hoisted to the root node_modules
// across platforms (Windows hoists it, Linux CI doesn't), which caused the
// test file to fail to load in CI with ERR_MODULE_NOT_FOUND.

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import {
  getStatus,
  getDiff,
  getFileContent,
  watchRoot,
  _clearGitStoreCache,
} from '../../packages/core/src/git-store.js';

let tmpRoot: string;

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

function initRepo(): { dir: string } {
  const dir = mkdtempSync(join(tmpRoot, 'repo-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test');
  git(dir, 'config', 'commit.gpgsign', 'false');
  return { dir };
}

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'agent-desk-git-store-'));
});

beforeEach(() => {
  _clearGitStoreCache();
});

afterEach(() => {
  _clearGitStoreCache();
});

describe('getStatus', () => {
  it('returns null for a non-git path', async () => {
    const dir = mkdtempSync(join(tmpRoot, 'not-a-repo-'));
    const result = await getStatus(dir);
    expect(result).toBeNull();
  });

  it('returns null for a nonexistent path', async () => {
    const result = await getStatus(join(tmpRoot, 'nope-does-not-exist'));
    expect(result).toBeNull();
  });

  it('reports a clean status on a freshly-committed repo', async () => {
    const { dir } = initRepo();
    writeFileSync(join(dir, 'readme.md'), '# hello\n', 'utf8');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'initial');
    _clearGitStoreCache();
    const result = await getStatus(dir);
    expect(result).not.toBeNull();
    expect(result!.branch).toBe('main');
    expect(result!.detached).toBe(false);
    expect(result!.files).toEqual([]);
    expect(result!.ahead).toBe(0);
    expect(result!.behind).toBe(0);
    expect(result!.lastCommit).not.toBeNull();
    expect(result!.lastCommit!.subject).toBe('initial');
  });

  it('detects modified and untracked files', async () => {
    const { dir } = initRepo();
    writeFileSync(join(dir, 'a.txt'), 'one\n', 'utf8');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'first');
    _clearGitStoreCache();

    writeFileSync(join(dir, 'a.txt'), 'two\n', 'utf8');
    writeFileSync(join(dir, 'b.txt'), 'new\n', 'utf8');

    const result = await getStatus(dir);
    expect(result).not.toBeNull();
    const paths = result!.files.map((f) => f.path).sort();
    expect(paths).toContain('a.txt');
    expect(paths).toContain('b.txt');
    const a = result!.files.find((f) => f.path === 'a.txt');
    const b = result!.files.find((f) => f.path === 'b.txt');
    expect(a).toBeDefined();
    expect(a!.status).toBe('M');
    expect(a!.staged).toBe(false);
    expect(b).toBeDefined();
    expect(b!.status).toBe('?');
    expect(b!.staged).toBe(false);
  });

  it('reports staged file as staged=true', async () => {
    const { dir } = initRepo();
    writeFileSync(join(dir, 'x.txt'), '1\n', 'utf8');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'base');
    _clearGitStoreCache();

    writeFileSync(join(dir, 'x.txt'), '2\n', 'utf8');
    git(dir, 'add', 'x.txt');
    _clearGitStoreCache();

    const result = await getStatus(dir);
    expect(result).not.toBeNull();
    const x = result!.files.find((f) => f.path === 'x.txt');
    expect(x).toBeDefined();
    expect(x!.staged).toBe(true);
    expect(x!.status).toBe('M');
  });

  it('detects ahead count against a local upstream', async () => {
    const remoteDir = mkdtempSync(join(tmpRoot, 'remote-'));
    git(remoteDir, 'init', '-q', '--bare');

    const workDir = mkdtempSync(join(tmpRoot, 'work-'));
    git(workDir, 'init', '-q', '-b', 'main');
    git(workDir, 'config', 'user.email', 'test@example.com');
    git(workDir, 'config', 'user.name', 'Test');
    git(workDir, 'config', 'commit.gpgsign', 'false');
    writeFileSync(join(workDir, 'seed.txt'), 'seed\n', 'utf8');
    git(workDir, 'add', '.');
    git(workDir, 'commit', '-q', '-m', 'seed');
    git(workDir, 'remote', 'add', 'origin', remoteDir);
    git(workDir, 'push', '-q', '-u', 'origin', 'main');

    writeFileSync(join(workDir, 'another.txt'), 'more\n', 'utf8');
    git(workDir, 'add', '.');
    git(workDir, 'commit', '-q', '-m', 'ahead');
    _clearGitStoreCache();

    const result = await getStatus(workDir);
    expect(result).not.toBeNull();
    expect(result!.ahead).toBe(1);
    expect(result!.behind).toBe(0);
  });

  it('caches the status result for 1s (same call returns identical object)', async () => {
    const { dir } = initRepo();
    writeFileSync(join(dir, 'c.txt'), 'hi\n', 'utf8');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'c');
    _clearGitStoreCache();

    const a = await getStatus(dir);
    const b = await getStatus(dir);
    expect(b).toBe(a);
  });

  it('invalidates the cache after _clearGitStoreCache()', async () => {
    const { dir } = initRepo();
    writeFileSync(join(dir, 'c.txt'), 'hi\n', 'utf8');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'c');
    _clearGitStoreCache();

    const a = await getStatus(dir);
    _clearGitStoreCache();
    const b = await getStatus(dir);
    expect(b).not.toBe(a);
    expect(b!.branch).toBe(a!.branch);
    expect(b!.files.length).toBe(a!.files.length);
  });
});

describe('getDiff', () => {
  it('returns a unified diff for a modified file', async () => {
    const { dir } = initRepo();
    writeFileSync(join(dir, 'a.txt'), 'line-one\n', 'utf8');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'init');
    _clearGitStoreCache();

    writeFileSync(join(dir, 'a.txt'), 'line-two\n', 'utf8');
    const diff = await getDiff(dir, 'a.txt');
    expect(diff).toContain('-line-one');
    expect(diff).toContain('+line-two');
  });

  it('returns a staged diff when staged=true', async () => {
    const { dir } = initRepo();
    writeFileSync(join(dir, 's.txt'), 'v1\n', 'utf8');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'v1');
    _clearGitStoreCache();

    writeFileSync(join(dir, 's.txt'), 'v2\n', 'utf8');
    git(dir, 'add', 's.txt');
    const diffStaged = await getDiff(dir, 's.txt', true);
    expect(diffStaged).toContain('-v1');
    expect(diffStaged).toContain('+v2');
    const diffWorking = await getDiff(dir, 's.txt', false);
    expect(diffWorking).toBe('');
  });

  it('returns empty string for a non-git path', async () => {
    const dir = mkdtempSync(join(tmpRoot, 'nope-'));
    const diff = await getDiff(dir, 'whatever.txt');
    expect(diff).toBe('');
  });

  it('returns a synthesized diff for untracked files', async () => {
    const { dir } = initRepo();
    writeFileSync(join(dir, 'seed.txt'), 'seed\n', 'utf8');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'seed');
    _clearGitStoreCache();

    writeFileSync(join(dir, 'fresh.txt'), 'brand new\n', 'utf8');
    const diff = await getDiff(dir, 'fresh.txt');
    expect(diff).toContain('+brand new');
  });
});

describe('getFileContent', () => {
  it('returns file content at HEAD', async () => {
    const { dir } = initRepo();
    writeFileSync(join(dir, 'h.txt'), 'head-content\n', 'utf8');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'head');
    _clearGitStoreCache();

    writeFileSync(join(dir, 'h.txt'), 'local-edit\n', 'utf8');

    const content = await getFileContent(dir, 'h.txt');
    expect(content).toContain('head-content');
  });

  it('returns empty string for a missing file at HEAD', async () => {
    const { dir } = initRepo();
    writeFileSync(join(dir, 'only.txt'), 'x\n', 'utf8');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'x');
    _clearGitStoreCache();
    const content = await getFileContent(dir, 'nope.txt');
    expect(content).toBe('');
  });

  it('returns empty string for a non-git path', async () => {
    const dir = mkdtempSync(join(tmpRoot, 'nope-fc-'));
    const content = await getFileContent(dir, 'whatever.txt');
    expect(content).toBe('');
  });
});

describe('watchRoot', () => {
  it('returns a disposer even for a non-git path (no throw)', () => {
    const dir = mkdtempSync(join(tmpRoot, 'no-watch-'));
    const dispose = watchRoot(dir, () => {});
    expect(typeof dispose).toBe('function');
    dispose();
    dispose();
  });

  it('disposer stops a valid watcher cleanly', () => {
    const { dir } = initRepo();
    const dispose = watchRoot(dir, () => {});
    expect(typeof dispose).toBe('function');
    dispose();
  });
});
