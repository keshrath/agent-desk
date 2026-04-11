// Git store — read-only backing for the git sidebar channel bucket (task #93b).
//
// Wraps simple-git with:
//   - Per-root 1s TTL cache for getStatus() to absorb bursty polls
//   - Shape translation from simple-git's StatusResult to our GitStatus contract
//   - fs.watch on .git/HEAD + .git/index with debounce, plus a polling fallback
//     for platforms where fs.watch is unreliable (notably Windows on some
//     network shares). watchRoot() returns a disposer.
//   - Binary-file detection (simple-git throws "binary" in the diff message)
//   - 1 MB diff truncation with a human-readable marker on the last line
//
// This module is Node-only (uses fs, path, child_process via simple-git) and
// contains zero Electron imports, satisfying the core package constraint.

import { promises as fsp, existsSync, watch, type FSWatcher } from 'fs';
import * as path from 'path';
import { simpleGit, type SimpleGit, type StatusResult, type FileStatusResult } from 'simple-git';
import type {
  GitStatus,
  GitFileStatus,
  GitFileStatusCode,
  GitCommit,
  GitRepoNode,
  GitRepoTree,
} from './transport/channels.js';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const STATUS_TTL_MS = 1000;
const TREE_TTL_MS = 2000;
const MAX_DIFF_BYTES = 1024 * 1024; // 1 MB
const MAX_SIBLING_SCAN_DEPTH = 1; // when workspace root isn't a repo, only look at direct children
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.turbo', '.cache']);

interface CacheEntry {
  value: GitStatus | null;
  expires: number;
}

interface TreeCacheEntry {
  value: GitRepoTree;
  expires: number;
}

const statusCache = new Map<string, CacheEntry>();
const treeCache = new Map<string, TreeCacheEntry>();

/** Test-only: clear the status cache between tests. Not exported publicly. */
export function _clearGitStoreCache(): void {
  statusCache.clear();
  treeCache.clear();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRoot(root: string): string {
  return path.resolve(root);
}

async function isGitRepo(root: string): Promise<boolean> {
  try {
    const st = await fsp.stat(path.join(root, '.git'));
    return st.isDirectory() || st.isFile(); // .git can be a file in worktrees
  } catch {
    return false;
  }
}

function makeClient(root: string): SimpleGit {
  return simpleGit({ baseDir: root, binary: 'git', maxConcurrentProcesses: 2 });
}

/**
 * Translate simple-git's XY status code into our single-letter contract code.
 * simple-git's FileStatusResult exposes `index` (first char) and `working_dir`
 * (second char). We prefer working_dir (unstaged) unless it's empty, then
 * fall back to index (staged). Untracked files come through as "??".
 */
function toStatusCode(f: FileStatusResult): GitFileStatusCode {
  const ws = (f.working_dir || '').trim();
  const idx = (f.index || '').trim();
  // Untracked
  if (f.index === '?' && f.working_dir === '?') return '?';
  // Unmerged (conflict)
  if (
    f.index === 'U' ||
    f.working_dir === 'U' ||
    (f.index === 'A' && f.working_dir === 'A') ||
    (f.index === 'D' && f.working_dir === 'D')
  ) {
    return 'U';
  }
  // Renamed
  if (f.index === 'R' || f.working_dir === 'R') return 'R';
  const code = ws || idx;
  if (code === 'M' || code === 'A' || code === 'D' || code === 'R') return code;
  // Fall-through — treat anything unknown as modified so the UI still surfaces it
  return 'M';
}

function fileIsStaged(f: FileStatusResult): boolean {
  const idx = (f.index || '').trim();
  if (!idx) return false;
  if (f.index === '?') return false;
  return true;
}

function mapFiles(status: StatusResult): GitFileStatus[] {
  const seen = new Set<string>();
  const out: GitFileStatus[] = [];
  for (const f of status.files) {
    // Emit two rows for a file that is simultaneously staged AND has working
    // changes (e.g. staged add + further edits) so the UI can group them.
    const idxCh = (f.index || '').trim();
    const wsCh = (f.working_dir || '').trim();
    const dupKey = (s: boolean) => `${f.path}\u0000${s ? 1 : 0}`;

    const pushRow = (staged: boolean, codeOverride?: GitFileStatusCode) => {
      const key = dupKey(staged);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        path: f.path,
        status: codeOverride ?? toStatusCode(f),
        staged,
      });
    };

    if (idxCh && idxCh !== '?' && wsCh && wsCh !== '?') {
      // both sides dirty — emit one staged and one unstaged row
      const idxCode = idxCh === 'R' ? 'R' : idxCh === 'A' ? 'A' : idxCh === 'D' ? 'D' : idxCh === 'M' ? 'M' : 'M';
      const wsCode = wsCh === 'R' ? 'R' : wsCh === 'A' ? 'A' : wsCh === 'D' ? 'D' : wsCh === 'M' ? 'M' : 'M';
      pushRow(true, idxCode as GitFileStatusCode);
      pushRow(false, wsCode as GitFileStatusCode);
    } else {
      pushRow(fileIsStaged(f));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the full git status for `root`, or `null` if `root` is not a git
 * repository. Results are cached per normalized root for STATUS_TTL_MS.
 */
export async function getStatus(root: string): Promise<GitStatus | null> {
  const normalized = normalizeRoot(root);
  const now = Date.now();
  const cached = statusCache.get(normalized);
  if (cached && cached.expires > now) return cached.value;

  if (!(await isGitRepo(normalized))) {
    statusCache.set(normalized, { value: null, expires: now + STATUS_TTL_MS });
    return null;
  }

  try {
    const git = makeClient(normalized);
    const status: StatusResult = await git.status();

    // Ahead/behind fallback — simple-git returns 0/0 when upstream is unset OR
    // when the tracking calculation failed. We re-ask with rev-list only if
    // there's a tracking branch configured.
    let ahead = status.ahead;
    let behind = status.behind;
    if (status.tracking && ahead === 0 && behind === 0) {
      try {
        const raw = (await git.raw(['rev-list', '--left-right', '--count', 'HEAD...@{u}'])).trim();
        const parts = raw.split(/\s+/).map((s) => parseInt(s, 10));
        if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
          ahead = parts[0];
          behind = parts[1];
        }
      } catch {
        /* no upstream or detached — keep 0/0 */
      }
    }

    // Last commit — may not exist on a freshly-init'd repo with no commits
    let lastCommit: GitCommit | null = null;
    try {
      const log = await git.log({ maxCount: 1 });
      if (log.latest) {
        lastCommit = {
          sha: log.latest.hash,
          subject: log.latest.message,
          author: log.latest.author_name,
          date: new Date(log.latest.date).getTime() || 0,
        };
      }
    } catch {
      /* empty repo */
    }

    const result: GitStatus = {
      root: normalized,
      branch: status.current,
      detached: status.detached,
      ahead,
      behind,
      files: mapFiles(status),
      lastCommit,
    };

    statusCache.set(normalized, { value: result, expires: now + STATUS_TTL_MS });
    return result;
  } catch {
    // Any git failure — return null and cache briefly to avoid thrash
    statusCache.set(normalized, { value: null, expires: now + STATUS_TTL_MS });
    return null;
  }
}

/**
 * Returns a unified diff for a single file. If `staged` is true, returns the
 * diff between HEAD and the index; otherwise returns the working-tree diff.
 * Binary files return an empty string. Diffs over MAX_DIFF_BYTES are
 * truncated with a marker on the final line.
 */
export async function getDiff(root: string, file: string, staged?: boolean): Promise<string> {
  const normalized = normalizeRoot(root);
  if (!(await isGitRepo(normalized))) return '';
  try {
    const git = makeClient(normalized);
    const args = ['diff', '--no-color'];
    if (staged) args.push('--staged');
    args.push('--', file);
    let out = await git.raw(args);
    if (!out && !staged) {
      try {
        const lsOut = (await git.raw(['ls-files', '--error-unmatch', '--', file])).trim();
        const tracked = lsOut.length > 0;
        if (!tracked) {
          const abs = path.join(normalized, file);
          if (existsSync(abs)) {
            const content = await fsp.readFile(abs, 'utf8');
            out = `diff --git a/${file} b/${file}\nnew file\n--- /dev/null\n+++ b/${file}\n${content
              .split('\n')
              .map((l) => `+${l}`)
              .join('\n')}`;
          }
        }
      } catch {
        /* ls-files errors mean untracked; only synthesize if file exists */
        try {
          const abs = path.join(normalized, file);
          if (existsSync(abs)) {
            const content = await fsp.readFile(abs, 'utf8');
            out = `diff --git a/${file} b/${file}\nnew file\n--- /dev/null\n+++ b/${file}\n${content
              .split('\n')
              .map((l) => `+${l}`)
              .join('\n')}`;
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (out.length > MAX_DIFF_BYTES) {
      out = out.slice(0, MAX_DIFF_BYTES) + '\n... diff truncated, view in external editor ...\n';
    }
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('binary')) return '';
    return '';
  }
}

/**
 * Returns the content of `file` within `root`. The `ref` argument controls
 * which revision is read:
 *   - `undefined` (default)            → HEAD
 *   - any non-empty string             → that ref (branch, sha, tag)
 *   - empty string `''`                → the working-tree copy read directly
 *                                        from disk. This is the only way to
 *                                        read the content of an UNTRACKED
 *                                        file (it's not in git objects yet)
 *                                        and also the right source for the
 *                                        "new" side of a working-tree diff.
 * Returns empty string on any error (missing ref, missing file, binary).
 */
export async function getFileContent(root: string, file: string, ref?: string): Promise<string> {
  const normalized = normalizeRoot(root);

  if (ref === '') {
    try {
      const abs = path.join(normalized, file);
      if (!existsSync(abs)) return '';
      return await fsp.readFile(abs, 'utf8');
    } catch {
      return '';
    }
  }

  if (!(await isGitRepo(normalized))) return '';
  try {
    const git = makeClient(normalized);
    const target = `${ref ?? 'HEAD'}:${file}`;
    return await git.show([target]);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Watcher
// ---------------------------------------------------------------------------

const WATCH_DEBOUNCE_MS = 500;
const POLL_INTERVAL_MS = 5000;

/**
 * Watch `root/.git/HEAD` and `root/.git/index` and invoke `onChange` with a
 * 500ms trailing debounce. Returns a disposer. If fs.watch throws (Windows
 * network shares, unusual filesystems), falls back to polling getStatus()
 * every POLL_INTERVAL_MS. The disposer is idempotent.
 */
export function watchRoot(root: string, onChange: () => void): () => void {
  const normalized = normalizeRoot(root);
  const gitDir = path.join(normalized, '.git');

  let disposed = false;
  let debounceTimer: NodeJS.Timeout | null = null;
  const watchers: FSWatcher[] = [];
  let pollTimer: NodeJS.Timeout | null = null;

  const fire = () => {
    if (disposed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (!disposed) {
        // invalidate cache so the next read is fresh
        statusCache.delete(normalized);
        try {
          onChange();
        } catch {
          /* swallow — host is responsible for logging */
        }
      }
    }, WATCH_DEBOUNCE_MS);
  };

  const startPolling = () => {
    let lastSig = '';
    pollTimer = setInterval(() => {
      if (disposed) return;
      getStatus(normalized)
        .then((s) => {
          if (disposed || !s) return;
          const sig = `${s.branch}|${s.ahead}|${s.behind}|${s.files.length}|${s.lastCommit?.sha ?? ''}`;
          if (sig !== lastSig) {
            lastSig = sig;
            fire();
          }
        })
        .catch(() => {
          /* ignore */
        });
    }, POLL_INTERVAL_MS);
  };

  if (!existsSync(gitDir)) {
    // Not a git repo — nothing to watch. Return a no-op disposer.
    return () => {
      disposed = true;
    };
  }

  const tryWatch = (target: string) => {
    try {
      const w = watch(target, { persistent: false }, () => fire());
      w.on('error', () => {
        /* fall back to poll */
      });
      watchers.push(w);
      return true;
    } catch {
      return false;
    }
  };

  const headOk = tryWatch(path.join(gitDir, 'HEAD'));
  const indexOk = tryWatch(path.join(gitDir, 'index'));

  if (!headOk && !indexOk) {
    // fs.watch failed for both — fall back to polling
    startPolling();
  }

  return () => {
    if (disposed) return;
    disposed = true;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    for (const w of watchers) {
      try {
        w.close();
      } catch {
        /* ignore */
      }
    }
    watchers.length = 0;
  };
}

// ---------------------------------------------------------------------------
// Repo tree discovery (workspace-as-folder model)
// ---------------------------------------------------------------------------
//
// A workspace is a folder that may contain 0+ git repositories at arbitrary
// depth via submodules. `discoverRepoTree()` walks the folder and produces a
// tree:
//   - If the workspace root IS a git repo → one top-level node whose
//     `children` holds the recursive submodule tree.
//   - If the workspace root is NOT a git repo → scan direct children for any
//     that are git repos. Each becomes a top-level node (sibling-project
//     model). Still recurses submodules within each one.
//
// Cycles are guarded by tracking visited absolute paths (submodules in pinned
// workspaces CAN form loops via relative URL shenanigans). Failures in one
// repo are captured in `node.error` — siblings keep being scanned.

async function readSubmodulePaths(repoRoot: string): Promise<string[]> {
  // Prefer `git submodule status` which honors .gitmodules + initialized state;
  // falls back to parsing .gitmodules directly when the submodules haven't
  // been initialized (the paths still exist on disk from the parent clone).
  try {
    const git = makeClient(repoRoot);
    const out = (await git.raw(['submodule', 'status'])).trim();
    if (out) {
      const paths: string[] = [];
      for (const line of out.split('\n')) {
        // Format: " <sha> <path> (<describe>)" — first char is a status flag
        //   ' ' initialized, '-' uninitialized, '+' SHA differs, 'U' conflict
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          paths.push(parts[1]);
        }
      }
      if (paths.length > 0) return paths;
    }
  } catch {
    /* fall through to .gitmodules parse */
  }

  // Fallback: read .gitmodules manually. Each `[submodule "..."]` section has
  // a `path = <path>` line. This works even if `git submodule init` hasn't
  // been run yet.
  try {
    const gmPath = path.join(repoRoot, '.gitmodules');
    const raw = await fsp.readFile(gmPath, 'utf8');
    const paths: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*path\s*=\s*(.+?)\s*$/.exec(line);
      if (m) paths.push(m[1]);
    }
    return paths;
  } catch {
    return [];
  }
}

async function buildRepoNode(
  absPath: string,
  relativePath: string,
  depth: number,
  parentRoot: string | null,
  isSubmodule: boolean,
  visited: Set<string>,
): Promise<GitRepoNode> {
  const name = path.basename(absPath) || absPath;
  const node: GitRepoNode = {
    root: absPath,
    relativePath,
    name,
    depth,
    parentRoot,
    isSubmodule,
    status: null,
    children: [],
  };

  if (visited.has(absPath)) {
    node.error = 'cycle detected';
    return node;
  }
  visited.add(absPath);

  // Fetch this repo's own status (uses the per-root 1s cache).
  try {
    node.status = await getStatus(absPath);
  } catch (err) {
    node.error = err instanceof Error ? err.message : String(err);
  }

  // Enumerate submodules and recurse. An uninitialized submodule won't be a
  // git repo itself (no .git inside), so we still emit a node for it but
  // with status = null and no children — useful for the UI to show "pending".
  const subPaths = await readSubmodulePaths(absPath);
  for (const rel of subPaths) {
    const subAbs = path.resolve(absPath, rel);
    const subRel = relativePath ? path.join(relativePath, rel) : rel;
    try {
      const child = await buildRepoNode(subAbs, subRel, depth + 1, absPath, true, visited);
      node.children.push(child);
    } catch (err) {
      node.children.push({
        root: subAbs,
        relativePath: subRel,
        name: path.basename(subAbs),
        depth: depth + 1,
        parentRoot: absPath,
        isSubmodule: true,
        status: null,
        children: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return node;
}

async function scanSiblingRepos(workspaceRoot: string): Promise<GitRepoNode[]> {
  // When the workspace root isn't itself a git repo, look at its direct
  // children for directories that contain a .git (dir or file). This is the
  // "folder containing multiple checked-out projects" case.
  let entries: import('fs').Dirent[];
  try {
    entries = await fsp.readdir(workspaceRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: GitRepoNode[] = [];
  const visited = new Set<string>();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(workspaceRoot, entry.name);
    if (!(await isGitRepo(abs))) continue;
    try {
      const node = await buildRepoNode(abs, entry.name, 0, null, false, visited);
      out.push(node);
    } catch {
      /* skip unreadable children — sibling scan is best-effort */
    }
  }
  return out;
}

void MAX_SIBLING_SCAN_DEPTH;

/**
 * Discover every git repository inside a workspace folder, returning a tree
 * where top-level repos carry their submodule subtrees as children. Safe on
 * non-git folders (returns an empty `repos` array). Results are cached per
 * workspaceRoot for TREE_TTL_MS to absorb sidebar refresh bursts.
 */
export async function discoverRepoTree(workspaceRoot: string): Promise<GitRepoTree> {
  const normalized = normalizeRoot(workspaceRoot);
  const now = Date.now();
  const cached = treeCache.get(normalized);
  if (cached && cached.expires > now) return cached.value;

  let repos: GitRepoNode[];
  if (await isGitRepo(normalized)) {
    // Workspace root is itself a git repo — single top-level node whose
    // children recurse into the submodule tree.
    const visited = new Set<string>();
    const root = await buildRepoNode(normalized, '', 0, null, false, visited);
    repos = [root];
  } else {
    // Workspace root is a plain folder — scan first-level children.
    repos = await scanSiblingRepos(normalized);
  }

  const tree: GitRepoTree = {
    workspaceRoot: normalized,
    repos,
    scannedAt: now,
  };
  treeCache.set(normalized, { value: tree, expires: now + TREE_TTL_MS });
  return tree;
}

/**
 * Walk a GitRepoTree and return a flat list of every repo root, including
 * nested submodules at any depth. Used by the sidebar to wire per-root
 * watchers / status refresh without the UI having to recurse the tree itself.
 */
export function flattenRepoTree(tree: GitRepoTree): GitRepoNode[] {
  const out: GitRepoNode[] = [];
  function walk(nodes: GitRepoNode[]): void {
    for (const n of nodes) {
      out.push(n);
      if (n.children.length) walk(n.children);
    }
  }
  walk(tree.repos);
  return out;
}
