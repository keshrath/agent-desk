// Git handlers — read-only sidebar backed by simple-git (task #93b).
//
// Wires three request channels (git:status, git:diff, git:file) to the
// git-store module. The git:update push channel is fired from watchRoot()
// via a module-level emitter installed by the host after router construction
// (see setGitEmitter). We use a singleton here rather than threading emit
// through BuildHandlersDeps because `handlers-default.ts` is spec-frozen for
// the duration of task #93 Phase 2 (see #93 bootstrap-complete artifact).
//
// Watchers are keyed by normalized root. The first git:status call for a
// given root installs a watcher; subsequent calls reuse it. The host is
// responsible for calling disposeAllGitWatchers() on shutdown.

import type { RequestHandlers } from '../transport/router.js';
import { getStatus, getDiff, getFileContent, watchRoot, discoverRepoTree, flattenRepoTree } from '../git-store.js';

export type GitEmitFn = (root: string) => void;

let emitter: GitEmitFn | null = null;
const watchers = new Map<string, () => void>();

/**
 * Install the git:update emitter. The host calls this once after building
 * the router, typically as:
 *
 *     setGitEmitter((root) => router.emit('git:update', root));
 *
 * Calling setGitEmitter(null) uninstalls. Idempotent.
 */
export function setGitEmitter(fn: GitEmitFn | null): void {
  emitter = fn;
}

/** Test + shutdown hook — dispose all active watchers and clear state. */
export function disposeAllGitWatchers(): void {
  for (const dispose of watchers.values()) {
    try {
      dispose();
    } catch {
      /* ignore */
    }
  }
  watchers.clear();
}

function ensureWatcher(root: string): void {
  if (watchers.has(root)) return;
  const dispose = watchRoot(root, () => {
    if (emitter) {
      try {
        emitter(root);
      } catch {
        /* swallow — logging is the host's job */
      }
    }
  });
  watchers.set(root, dispose);
}

export function buildGitHandlers(): Pick<RequestHandlers, 'git:status' | 'git:diff' | 'git:file' | 'git:discover'> {
  return {
    'git:status': async (root: string) => {
      const result = await getStatus(root);
      // Install a watcher the first time we see this root so future fs events
      // fan out through git:update. Non-git roots get a no-op watcher.
      ensureWatcher(root);
      return result;
    },
    'git:diff': (root: string, file: string, staged?: boolean) => getDiff(root, file, staged),
    'git:file': (root: string, file: string, ref?: string) => getFileContent(root, file, ref),
    'git:discover': async (workspaceRoot: string) => {
      const tree = await discoverRepoTree(workspaceRoot);
      // Install watchers for every repo in the tree (parent + all submodules
      // at any depth) so edits inside any nested repo fan out through
      // git:update. Already-watched roots are skipped by ensureWatcher.
      for (const node of flattenRepoTree(tree)) {
        if (node.status) ensureWatcher(node.root);
      }
      return tree;
    },
  };
}
