// =============================================================================
// Agent Desk — Git Sidebar (task #93b)
// =============================================================================
//
// Read-only git panel docked on the right side of #main. Shows branch,
// ahead/behind, and a collapsible file list grouped by staged / unstaged /
// untracked. Clicking a file dispatches a `diff:open` CustomEvent on the
// window so the diff viewer (#93c) can subscribe without a hard import.
//
// Data path:
//   - Refreshes on window.agentDesk.git.onUpdate() push (fired by core when
//     .git/HEAD or .git/index changes)
//   - Polls every 5s as a safety net for platforms where fs.watch is flaky
//   - Root is set via registry.setGitSidebarRoot(path) or inferred from a
//     `workspace-opened` CustomEvent (#93a) — falls back to empty state.
//
// Everything lives in a single container appended to #main so it doesn't
// need any index.html edits and doesn't collide with #93a / #93c / #93d.
// =============================================================================

'use strict';

import { registry } from './state.js';
import { esc, escAttr } from './dom-utils.js';

const POLL_INTERVAL_MS = 5000;

let _container = null;
let _toggleBtn = null;
let _root = null;
let _collapsed = false;
// _tree is the full GitRepoTree returned by git:discover — workspaceRoot +
// repos (each with nested children for submodules at any depth). _root is the
// workspace root; each repo in the tree carries its own .root path that gets
// used for per-file diff:open events, so submodule files route through the
// submodule's own git client.
let _tree = null;
let _pollTimer = null;
let _pushUnsub = null;
// Per-repo collapse state, keyed by repo root. Each value is an object like
// { repo: false, staged: false, unstaged: false, untracked: false }. Nested
// submodules are collapsed-by-default so deep trees don't overwhelm the UI.
const _repoCollapsed = new Map();
let _loading = false;
let _error = null;

// ---------------------------------------------------------------------------
// DOM construction
// ---------------------------------------------------------------------------

function createContainer() {
  const el = document.createElement('aside');
  el.id = 'git-sidebar';
  el.className = 'git-sidebar';
  el.setAttribute('role', 'complementary');
  el.setAttribute('aria-label', 'Git status');
  el.innerHTML =
    '<div class="git-sidebar-header">' +
    '<span class="material-symbols-outlined git-sidebar-icon">account_tree</span>' +
    '<span class="git-sidebar-title">Git</span>' +
    '<span class="git-sidebar-spacer"></span>' +
    '<button class="git-sidebar-refresh" type="button" title="Refresh" aria-label="Refresh">' +
    '<span class="material-symbols-outlined">refresh</span>' +
    '</button>' +
    '<button class="git-sidebar-collapse" type="button" title="Collapse" aria-label="Collapse">' +
    '<span class="material-symbols-outlined">chevron_right</span>' +
    '</button>' +
    '</div>' +
    '<div class="git-sidebar-body" role="region" aria-live="polite"></div>';
  return el;
}

function createToggleButton() {
  const b = document.createElement('button');
  b.type = 'button';
  b.id = 'git-sidebar-toggle';
  b.className = 'git-sidebar-toggle';
  b.title = 'Show git panel';
  b.setAttribute('aria-label', 'Show git panel');
  b.innerHTML = '<span class="material-symbols-outlined">account_tree</span>';
  return b;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderEmpty(msg) {
  const body = _container && _container.querySelector('.git-sidebar-body');
  if (!body) return;
  body.innerHTML = '<div class="git-sidebar-empty">' + esc(msg) + '</div>';
}

function renderLoading() {
  const body = _container && _container.querySelector('.git-sidebar-body');
  if (!body) return;
  body.innerHTML = '<div class="git-sidebar-loading">Loading…</div>';
}

function renderError(msg) {
  const body = _container && _container.querySelector('.git-sidebar-body');
  if (!body) return;
  body.innerHTML = '<div class="git-sidebar-error">' + esc(msg) + '</div>';
}

function _groupFiles(files) {
  const staged = [];
  const unstaged = [];
  const untracked = [];
  for (const f of files) {
    if (f.status === '?') {
      untracked.push(f);
    } else if (f.staged) {
      staged.push(f);
    } else {
      unstaged.push(f);
    }
  }
  return { staged, unstaged, untracked };
}

function _getRepoCollapse(rootPath, defaults) {
  let state = _repoCollapsed.get(rootPath);
  if (!state) {
    state = { repo: defaults.repo, staged: false, unstaged: false, untracked: false };
    _repoCollapsed.set(rootPath, state);
  }
  return state;
}

function _renderFileRow(f, repoRoot) {
  const statusClass = 'git-status-' + (f.status === '?' ? 'untracked' : f.status.toLowerCase());
  const statusLetter = f.status === '?' ? 'U' : f.status;
  return (
    '<li class="git-file-row" data-path="' +
    escAttr(f.path) +
    '" data-staged="' +
    (f.staged ? '1' : '0') +
    '" data-repo-root="' +
    escAttr(repoRoot) +
    '" tabindex="0">' +
    '<span class="git-file-status ' +
    statusClass +
    '">' +
    statusLetter +
    '</span>' +
    '<span class="git-file-path" title="' +
    escAttr(f.path) +
    '">' +
    esc(f.path) +
    '</span>' +
    '</li>'
  );
}

function _renderGroup(name, label, files, repoRoot, collapseState) {
  if (!files.length) return '';
  const collapsed = !!collapseState[name];
  const chevron = collapsed ? 'chevron_right' : 'expand_more';
  return (
    '<div class="git-group" data-group="' +
    name +
    '" data-repo-root="' +
    escAttr(repoRoot) +
    '">' +
    '<button type="button" class="git-group-header" aria-expanded="' +
    (collapsed ? 'false' : 'true') +
    '">' +
    '<span class="material-symbols-outlined git-group-chevron">' +
    chevron +
    '</span>' +
    '<span class="git-group-label">' +
    esc(label) +
    '</span>' +
    '<span class="git-group-count">' +
    files.length +
    '</span>' +
    '</button>' +
    (collapsed ? '' : '<ul class="git-file-list">' + files.map((f) => _renderFileRow(f, repoRoot)).join('') + '</ul>') +
    '</div>'
  );
}

// Render one repo node (parent or submodule) as a collapsible section.
// Recurses into node.children to render nested submodules indented per depth.
function _renderRepoNode(node) {
  // Top-level repos default-expanded; nested submodules default-collapsed so
  // deeply nested trees don't dominate the sidebar at first paint.
  const defaults = { repo: node.depth > 0 };
  const collapseState = _getRepoCollapse(node.root, defaults);
  const indent = 'padding-left:' + node.depth * 12 + 'px';

  // Header line — the "click target" to collapse/expand the whole repo.
  const chevron = collapseState.repo ? 'chevron_right' : 'expand_more';
  const submoduleBadge = node.isSubmodule
    ? '<span class="git-repo-submodule-badge" title="Submodule of ' + escAttr(node.parentRoot || '') + '">sub</span>'
    : '';

  let statusLine = '';
  if (node.error) {
    statusLine = '<span class="git-repo-error" title="' + escAttr(node.error) + '">⚠ ' + esc(node.error) + '</span>';
  } else if (!node.status) {
    statusLine = '<span class="git-repo-uninit">uninitialized</span>';
  } else {
    const s = node.status;
    const branch = s.branch || (s.detached ? 'detached' : '(no branch)');
    const dirtyDot = s.files.length > 0 ? '<span class="git-dirty-indicator" title="Working tree dirty">●</span>' : '';
    const detachedIcon = s.detached ? '<span class="git-detached-indicator" title="Detached HEAD">⚠</span>' : '';
    const ahead =
      s.ahead > 0 ? '<span class="git-ahead-badge" title="Commits ahead of upstream">↑ ' + s.ahead + '</span>' : '';
    const behind =
      s.behind > 0 ? '<span class="git-behind-badge" title="Commits behind upstream">↓ ' + s.behind + '</span>' : '';
    statusLine =
      '<span class="git-branch-name" title="' +
      escAttr(branch) +
      '">' +
      esc(branch) +
      '</span>' +
      dirtyDot +
      detachedIcon +
      ahead +
      behind;
  }

  let body = '';
  if (!collapseState.repo) {
    if (node.status) {
      const groups = _groupFiles(node.status.files);
      const lastCommit = node.status.lastCommit
        ? '<div class="git-last-commit" title="' +
          escAttr(node.status.lastCommit.author + ' — ' + node.status.lastCommit.sha) +
          '">' +
          '<span class="material-symbols-outlined git-commit-icon">commit</span>' +
          '<span class="git-commit-subject">' +
          esc(node.status.lastCommit.subject) +
          '</span>' +
          '</div>'
        : '';
      body =
        lastCommit +
        _renderGroup('staged', 'Staged', groups.staged, node.root, collapseState) +
        _renderGroup('unstaged', 'Changes', groups.unstaged, node.root, collapseState) +
        _renderGroup('untracked', 'Untracked', groups.untracked, node.root, collapseState) +
        (groups.staged.length + groups.unstaged.length + groups.untracked.length === 0
          ? '<div class="git-sidebar-clean">Working tree clean</div>'
          : '');
    } else if (!node.error) {
      body = '<div class="git-sidebar-empty">Run <code>git submodule update --init</code> to populate.</div>';
    }
  }

  // Recurse into children (submodules). Even when the parent is collapsed we
  // still emit the children inside so they remain part of the DOM for stable
  // state — the parent's collapsed class hides them.
  const childHtml = node.children.map(_renderRepoNode).join('');

  return (
    '<section class="git-repo-node' +
    (node.isSubmodule ? ' git-repo-submodule' : '') +
    '" data-repo-root="' +
    escAttr(node.root) +
    '" data-depth="' +
    node.depth +
    '" style="' +
    indent +
    '">' +
    '<button type="button" class="git-repo-header" aria-expanded="' +
    (collapseState.repo ? 'false' : 'true') +
    '">' +
    '<span class="material-symbols-outlined git-repo-chevron">' +
    chevron +
    '</span>' +
    '<span class="material-symbols-outlined git-branch-icon">fork_right</span>' +
    '<span class="git-repo-name" title="' +
    escAttr(node.relativePath || node.root) +
    '">' +
    esc(node.name || node.root) +
    '</span>' +
    submoduleBadge +
    '<span class="git-repo-spacer"></span>' +
    statusLine +
    '</button>' +
    '<div class="git-repo-body">' +
    body +
    childHtml +
    '</div>' +
    '</section>'
  );
}

function render() {
  if (!_container) return;
  const body = _container.querySelector('.git-sidebar-body');
  if (!body) return;

  if (!_root) {
    renderEmpty('No workspace selected.');
    return;
  }
  if (_loading && !_tree) {
    renderLoading();
    return;
  }
  if (_error) {
    renderError(_error);
    return;
  }
  if (!_tree || _tree.repos.length === 0) {
    renderEmpty('No git repositories found in this workspace.');
    return;
  }

  body.innerHTML = _tree.repos.map(_renderRepoNode).join('');
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function refresh() {
  if (!_root) {
    _tree = null;
    render();
    return;
  }
  if (!window.agentDesk || !window.agentDesk.git || !window.agentDesk.git.discover) {
    _error = 'git API unavailable';
    render();
    return;
  }
  _loading = true;
  if (!_tree) render();
  try {
    _tree = await window.agentDesk.git.discover(_root);
    _error = null;
  } catch (err) {
    _error = err && err.message ? err.message : String(err);
    _tree = null;
  } finally {
    _loading = false;
    render();
  }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

function _dispatchDiffOpenFromRow(row) {
  const filePath = row.getAttribute('data-path');
  const staged = row.getAttribute('data-staged') === '1';
  // IMPORTANT: route to the file's OWNING repo root, not the workspace root.
  // Submodule files dispatch with the submodule's own root so the diff viewer
  // pulls the correct blob via the submodule's git client.
  const repoRoot = row.getAttribute('data-repo-root');
  if (filePath && repoRoot) {
    window.dispatchEvent(
      new CustomEvent('diff:open', {
        detail: { path: filePath, root: repoRoot, staged: staged },
      }),
    );
  }
}

function _onBodyClick(e) {
  const row = e.target.closest('.git-file-row');
  if (row) {
    _dispatchDiffOpenFromRow(row);
    return;
  }
  const repoHeader = e.target.closest('.git-repo-header');
  if (repoHeader) {
    const section = repoHeader.closest('.git-repo-node');
    const repoRoot = section && section.getAttribute('data-repo-root');
    if (repoRoot) {
      const state = _repoCollapsed.get(repoRoot) || { repo: false, staged: false, unstaged: false, untracked: false };
      state.repo = !state.repo;
      _repoCollapsed.set(repoRoot, state);
      render();
    }
    return;
  }
  const groupHeader = e.target.closest('.git-group-header');
  if (groupHeader) {
    const group = groupHeader.closest('.git-group');
    const name = group && group.getAttribute('data-group');
    const repoRoot = group && group.getAttribute('data-repo-root');
    if (name && repoRoot) {
      const state = _repoCollapsed.get(repoRoot) || { repo: false, staged: false, unstaged: false, untracked: false };
      state[name] = !state[name];
      _repoCollapsed.set(repoRoot, state);
      render();
    }
    return;
  }
  const refreshBtn = e.target.closest('.git-sidebar-refresh');
  if (refreshBtn) {
    refresh();
    return;
  }
  const collapseBtn = e.target.closest('.git-sidebar-collapse');
  if (collapseBtn) {
    setCollapsed(true);
    return;
  }
}

function _onBodyKeyDown(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = e.target.closest('.git-file-row');
  if (!row) return;
  e.preventDefault();
  _dispatchDiffOpenFromRow(row);
}

function setCollapsed(collapsed) {
  _collapsed = !!collapsed;
  if (!_container) return;
  if (_collapsed) {
    _container.classList.add('git-sidebar-collapsed');
  } else {
    _container.classList.remove('git-sidebar-collapsed');
  }
  if (_toggleBtn) {
    _toggleBtn.style.display = _collapsed ? '' : 'none';
  }
}

export function setGitSidebarRoot(root) {
  if (root === _root) return;
  _root = root || null;
  _tree = null;
  _error = null;
  // Auto-expand when a workspace is opened; collapse when cleared.
  // Users can still manually toggle via the floating button.
  if (_root) {
    setCollapsed(false);
  } else {
    setCollapsed(true);
  }
  render();
  refresh();
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function initGitSidebar() {
  const main = document.getElementById('main');
  if (!main) return;
  if (document.getElementById('git-sidebar')) return; // avoid double-mount

  _container = createContainer();
  main.appendChild(_container);

  // Floating re-open toggle (hidden until sidebar is collapsed)
  _toggleBtn = createToggleButton();
  _toggleBtn.style.display = 'none';
  _toggleBtn.addEventListener('click', () => setCollapsed(false));
  document.body.appendChild(_toggleBtn);

  _container.addEventListener('click', _onBodyClick);
  _container.addEventListener('keydown', _onBodyKeyDown);

  // Start collapsed when there's no workspace root. The sidebar auto-expands
  // when setGitSidebarRoot() is called with a real path.
  if (!_root) {
    setCollapsed(true);
  }

  // Subscribe to the git:update push channel if available.
  if (window.agentDesk && window.agentDesk.git && typeof window.agentDesk.git.onUpdate === 'function') {
    try {
      _pushUnsub = window.agentDesk.git.onUpdate((updatedRoot) => {
        // Only refresh if the event is for our current root (or if we don't
        // have a specific root, refresh anyway).
        if (!_root || !updatedRoot || updatedRoot === _root) {
          refresh();
        }
      });
    } catch {
      /* push channel not wired — polling covers us */
    }
  }

  // Listen for a workspace-opened event from #93a (forwards-compatible — the
  // event may never fire if #93a hasn't shipped yet).
  window.addEventListener('workspace-opened', (e) => {
    const detail = e && e.detail;
    if (detail && detail.rootPath) setGitSidebarRoot(detail.rootPath);
  });

  // Polling fallback — the push channel is best-effort; polling every 5s
  // ensures the UI stays fresh even when fs.watch fails.
  _pollTimer = setInterval(() => {
    if (_root) refresh();
  }, POLL_INTERVAL_MS);

  render();
}

export function destroyGitSidebar() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
  if (_pushUnsub) {
    try {
      _pushUnsub();
    } catch {
      /* ignore */
    }
    _pushUnsub = null;
  }
  if (_container) {
    _container.remove();
    _container = null;
  }
  if (_toggleBtn) {
    _toggleBtn.remove();
    _toggleBtn = null;
  }
  _tree = null;
  _root = null;
}

registry.initGitSidebar = initGitSidebar;
registry.destroyGitSidebar = destroyGitSidebar;
registry.setGitSidebarRoot = setGitSidebarRoot;
registry.refreshGitSidebar = refresh;
