// =============================================================================
// Agent Desk — Read-only Diff Viewer (task #93c)
// =============================================================================
// Shows a Shiki-highlighted diff for a single file in a modal overlay. The
// RenderedDiff payload comes pre-highlighted from @agent-desk/core via the
// `diff:render` channel, so this module does zero parsing or highlighting.
//
// Trigger: a `diff:open` CustomEvent on window with detail:
//   { path: string, root: string, oldRef?: string, newRef?: string,
//     title?: string, staged?: boolean }
//
// Keyboard:
//   j / k   — next / previous hunk
//   s       — toggle unified ↔ side-by-side view
//   o       — dispatch `diff:open-in-editor` (handled by #93d)
//   Esc     — close
// =============================================================================

'use strict';

// ---------------------------------------------------------------------------
// Language detection — mirrors packages/core/src/diff-renderer.ts EXT_MAP so
// the UI can pick a language without a round-trip. Unknown → 'plaintext'.
// ---------------------------------------------------------------------------

const EXT_MAP = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  pyi: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  sh: 'shellscript',
  bash: 'bash',
  zsh: 'bash',
  json: 'json',
  jsonc: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  markdown: 'markdown',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'css',
  sql: 'sql',
};

function detectLangByExt(filePath) {
  if (!filePath) return 'plaintext';
  const base = String(filePath).split(/[\\/]/).pop() || filePath;
  const dot = base.lastIndexOf('.');
  if (dot < 0) return 'plaintext';
  const ext = base.slice(dot + 1).toLowerCase();
  return EXT_MAP[ext] || 'plaintext';
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let _overlay = null;
let _mode = 'unified'; // 'unified' | 'split'
let _currentRendered = null;
let _currentMeta = null;
let _hunkElements = [];
let _activeHunk = -1;
let _keydownHandler = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Open the viewer for a given file. Resolves after the diff is rendered. */
export async function openDiffViewer(detail) {
  if (!detail || !detail.path) return;
  _currentMeta = { ...detail };
  if (!_overlay) _overlay = _createOverlay();

  _setLoading(true);
  _setTitle(detail.title || detail.path);
  _setStatus('');

  document.body.appendChild(_overlay);
  requestAnimationFrame(() => {
    _overlay.classList.add('visible');
    // Steal focus from any terminal / input underneath so keyboard shortcuts
    // (j/k/s/o/Esc) reach the overlay's document listener instead of being
    // swallowed by xterm.js's hidden textarea.
    const modal = _overlay.__refs?.modal;
    if (modal) {
      if (!modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');
      modal.focus();
    }
  });
  _attachKeyHandler();

  try {
    const rendered = await _fetchAndRender(detail);
    _currentRendered = rendered;
    _renderHunks(rendered);
    if (rendered.binary) {
      _setStatus('Binary file — no preview');
    } else if (rendered.truncated) {
      _setStatus('File > 500 KB — highlighting skipped');
    } else if (!rendered.hunks || rendered.hunks.length === 0) {
      _setStatus('No changes');
    } else {
      _setStatus(`${rendered.hunks.length} hunk${rendered.hunks.length !== 1 ? 's' : ''}`);
    }
  } catch (err) {
    _setStatus(`Error: ${err && err.message ? err.message : String(err)}`);
  } finally {
    _setLoading(false);
  }
}

/** Close the viewer if open. */
export function closeDiffViewer() {
  if (!_overlay) return;
  _overlay.classList.remove('visible');
  _detachKeyHandler();
  const toRemove = _overlay;
  setTimeout(() => {
    if (toRemove && toRemove.parentNode) toRemove.parentNode.removeChild(toRemove);
  }, 150);
  _currentRendered = null;
  _currentMeta = null;
  _hunkElements = [];
  _activeHunk = -1;
}

// Listen for the integration event from #93b (git sidebar).
window.addEventListener('diff:open', (ev) => {
  openDiffViewer(ev && ev.detail ? ev.detail : {});
});

// ---------------------------------------------------------------------------
// Fetch old + new content and ask core to render the diff
// ---------------------------------------------------------------------------

async function _fetchAndRender(detail) {
  const api = typeof window !== 'undefined' ? window.agentDesk : null;
  if (!api || !api.diff || !api.diff.render) {
    throw new Error('diff.render API not available');
  }

  let oldContent = '';
  let newContent = '';

  if (typeof detail.oldContent === 'string' && typeof detail.newContent === 'string') {
    // Test hook — allow callers to inject raw content directly.
    oldContent = detail.oldContent;
    newContent = detail.newContent;
  } else if (api.git && api.git.file && api.git.diff) {
    const root = detail.root || '';
    const oldRef = detail.oldRef || 'HEAD';
    try {
      oldContent = await api.git.file(root, detail.path, oldRef);
    } catch {
      oldContent = '';
    }
    try {
      // git.diff returns a unified-diff string; we'd prefer raw new content.
      // Read it via file:stat+file:write-style APIs if present; otherwise fall
      // back to asking git.file for the working copy (ref = "").
      newContent = await api.git.file(root, detail.path, detail.newRef || '');
    } catch {
      newContent = '';
    }
  }

  const lang = detectLangByExt(detail.path);
  return api.diff.render(oldContent, newContent, lang);
}

// ---------------------------------------------------------------------------
// DOM construction
// ---------------------------------------------------------------------------

function _createOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'diff-viewer-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Diff Viewer');

  const modal = document.createElement('div');
  modal.className = 'diff-viewer-modal';

  const header = document.createElement('div');
  header.className = 'diff-viewer-header';

  const titleEl = document.createElement('div');
  titleEl.className = 'diff-viewer-title';
  titleEl.textContent = '';

  const statusEl = document.createElement('div');
  statusEl.className = 'diff-viewer-status';

  const modeBtn = document.createElement('button');
  modeBtn.className = 'diff-viewer-btn diff-viewer-mode-btn';
  modeBtn.type = 'button';
  modeBtn.title = 'Toggle unified / side-by-side (s)';
  modeBtn.textContent = 'Unified';
  modeBtn.addEventListener('click', () => _toggleMode());

  const openExternalBtn = document.createElement('button');
  openExternalBtn.className = 'diff-viewer-btn diff-viewer-open-btn';
  openExternalBtn.type = 'button';
  openExternalBtn.title = 'Open in external editor (o)';
  openExternalBtn.textContent = 'Open';
  openExternalBtn.addEventListener('click', () => _dispatchOpenInEditor());

  const closeBtn = document.createElement('button');
  closeBtn.className = 'diff-viewer-btn diff-viewer-close-btn';
  closeBtn.type = 'button';
  closeBtn.title = 'Close (Esc)';
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', () => closeDiffViewer());

  header.appendChild(titleEl);
  header.appendChild(statusEl);
  header.appendChild(modeBtn);
  header.appendChild(openExternalBtn);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'diff-viewer-body';

  const hunksEl = document.createElement('div');
  hunksEl.className = 'diff-viewer-hunks';
  body.appendChild(hunksEl);

  const loadingEl = document.createElement('div');
  loadingEl.className = 'diff-viewer-loading';
  loadingEl.textContent = 'Loading diff\u2026';
  body.appendChild(loadingEl);

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDiffViewer();
  });

  overlay.__refs = { titleEl, statusEl, modeBtn, hunksEl, loadingEl, modal };
  return overlay;
}

function _setTitle(text) {
  if (!_overlay) return;
  _overlay.__refs.titleEl.textContent = text;
}

function _setStatus(text) {
  if (!_overlay) return;
  _overlay.__refs.statusEl.textContent = text;
}

function _setLoading(loading) {
  if (!_overlay) return;
  const { loadingEl, hunksEl } = _overlay.__refs;
  loadingEl.style.display = loading ? 'flex' : 'none';
  hunksEl.style.display = loading ? 'none' : '';
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function _renderHunks(rendered) {
  if (!_overlay) return;
  const { hunksEl, modeBtn, modal } = _overlay.__refs;
  hunksEl.innerHTML = '';
  _hunkElements = [];
  _activeHunk = -1;

  modal.classList.toggle('diff-mode-unified', _mode === 'unified');
  modal.classList.toggle('diff-mode-split', _mode === 'split');
  modeBtn.textContent = _mode === 'unified' ? 'Unified' : 'Split';

  if (rendered.binary) {
    const empty = document.createElement('div');
    empty.className = 'diff-viewer-empty';
    empty.textContent = 'Binary file — no textual preview available.';
    hunksEl.appendChild(empty);
    return;
  }
  if (!rendered.hunks || rendered.hunks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'diff-viewer-empty';
    empty.textContent = 'No changes.';
    hunksEl.appendChild(empty);
    return;
  }

  for (const hunk of rendered.hunks) {
    const el = _renderHunk(hunk, rendered.truncated);
    hunksEl.appendChild(el);
    _hunkElements.push(el);
  }
  if (_hunkElements.length > 0) _focusHunk(0);
}

function _renderHunk(hunk, truncated) {
  const wrap = document.createElement('section');
  wrap.className = 'diff-hunk';

  const header = document.createElement('div');
  header.className = 'diff-hunk-header';
  header.textContent = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
  wrap.appendChild(header);

  if (_mode === 'split') {
    wrap.appendChild(_renderSplitHunk(hunk, truncated));
  } else {
    wrap.appendChild(_renderUnifiedHunk(hunk, truncated));
  }

  return wrap;
}

function _renderUnifiedHunk(hunk, truncated) {
  const pre = document.createElement('pre');
  pre.className = 'diff-lines';
  for (const line of hunk.lines) {
    const row = document.createElement('div');
    row.className = `diff-line diff-${line.kind}`;

    const gutterOld = document.createElement('span');
    gutterOld.className = 'diff-gutter diff-gutter-old';
    gutterOld.textContent = line.oldLine != null ? String(line.oldLine) : '';

    const gutterNew = document.createElement('span');
    gutterNew.className = 'diff-gutter diff-gutter-new';
    gutterNew.textContent = line.newLine != null ? String(line.newLine) : '';

    const sign = document.createElement('span');
    sign.className = 'diff-sign';
    sign.textContent = line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' ';

    const code = document.createElement('span');
    code.className = 'diff-code';
    if (truncated || !line.html) {
      // Plain-text fallback — textContent is safe.
      code.textContent = _extractPlainText(line);
    } else {
      // Trusted HTML from shiki in core — injected verbatim.
      code.innerHTML = line.html;
    }

    row.appendChild(gutterOld);
    row.appendChild(gutterNew);
    row.appendChild(sign);
    row.appendChild(code);
    pre.appendChild(row);
  }
  return pre;
}

function _renderSplitHunk(hunk, truncated) {
  const grid = document.createElement('div');
  grid.className = 'diff-split-grid';

  // Build parallel rows: group dels and adds into pairs for the split view.
  const left = document.createElement('pre');
  left.className = 'diff-lines diff-split-side diff-split-old';
  const right = document.createElement('pre');
  right.className = 'diff-lines diff-split-side diff-split-new';

  // Walk the hunk and emit one row on each side per source line, padding
  // the opposite side with blanks when the line is add-only / del-only.
  const queueOld = [];
  const queueNew = [];
  for (const line of hunk.lines) {
    if (line.kind === 'ctx') {
      // flush any pending del/add pair alignment first
      while (queueOld.length || queueNew.length) {
        _emitSplitRow(left, queueOld.shift() || null, 'del', truncated);
        _emitSplitRow(right, queueNew.shift() || null, 'add', truncated);
      }
      _emitSplitRow(left, line, 'ctx', truncated);
      _emitSplitRow(right, line, 'ctx', truncated);
    } else if (line.kind === 'del') {
      queueOld.push(line);
    } else if (line.kind === 'add') {
      queueNew.push(line);
    }
  }
  while (queueOld.length || queueNew.length) {
    _emitSplitRow(left, queueOld.shift() || null, 'del', truncated);
    _emitSplitRow(right, queueNew.shift() || null, 'add', truncated);
  }

  grid.appendChild(left);
  grid.appendChild(right);
  return grid;
}

function _emitSplitRow(pre, line, fallbackKind, truncated) {
  const row = document.createElement('div');
  if (!line) {
    row.className = `diff-line diff-${fallbackKind} diff-empty`;
    row.innerHTML = '<span class="diff-gutter"></span><span class="diff-sign"> </span><span class="diff-code"> </span>';
    pre.appendChild(row);
    return;
  }
  row.className = `diff-line diff-${line.kind}`;
  const gutter = document.createElement('span');
  gutter.className = 'diff-gutter';
  const n = fallbackKind === 'del' || line.kind === 'del' ? line.oldLine : line.newLine;
  gutter.textContent = n != null ? String(n) : '';

  const sign = document.createElement('span');
  sign.className = 'diff-sign';
  sign.textContent = line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' ';

  const code = document.createElement('span');
  code.className = 'diff-code';
  if (truncated || !line.html) {
    code.textContent = _extractPlainText(line);
  } else {
    code.innerHTML = line.html;
  }

  row.appendChild(gutter);
  row.appendChild(sign);
  row.appendChild(code);
  pre.appendChild(row);
}

function _extractPlainText(line) {
  // When core skipped highlighting (truncated) the html string is empty.
  // Best-effort: strip any tags from html if present, otherwise use ''.
  if (!line || !line.html) return '';
  return String(line.html).replace(/<[^>]*>/g, '');
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function _focusHunk(idx) {
  if (!_hunkElements.length) return;
  const clamped = Math.max(0, Math.min(_hunkElements.length - 1, idx));
  if (_activeHunk >= 0 && _hunkElements[_activeHunk]) {
    _hunkElements[_activeHunk].classList.remove('diff-hunk-active');
  }
  _activeHunk = clamped;
  const el = _hunkElements[clamped];
  el.classList.add('diff-hunk-active');
  if (typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

function _nextHunk() {
  if (!_hunkElements.length) return;
  _focusHunk(_activeHunk + 1 >= _hunkElements.length ? _hunkElements.length - 1 : _activeHunk + 1);
}
function _prevHunk() {
  if (!_hunkElements.length) return;
  _focusHunk(_activeHunk - 1 < 0 ? 0 : _activeHunk - 1);
}

function _toggleMode() {
  _mode = _mode === 'unified' ? 'split' : 'unified';
  if (_currentRendered) _renderHunks(_currentRendered);
}

function _dispatchOpenInEditor() {
  if (!_currentMeta) return;
  window.dispatchEvent(
    new CustomEvent('diff:open-in-editor', {
      detail: {
        path: _currentMeta.path,
        root: _currentMeta.root,
        line: 1,
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Keyboard handling
// ---------------------------------------------------------------------------

function _attachKeyHandler() {
  if (_keydownHandler) return;
  _keydownHandler = (e) => {
    if (!_overlay || !_overlay.classList.contains('visible')) return;
    // Don't hijack keys while typing in an input INSIDE the viewer — but
    // keys typed into elements OUTSIDE (e.g. xterm.js's hidden textarea)
    // must still reach us, otherwise the underlying terminal swallows
    // every j/k/s/o/Esc.
    const tgt = e.target;
    if (tgt && _overlay.contains(tgt)) {
      if (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA') return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      closeDiffViewer();
    } else if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      _nextHunk();
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      _prevHunk();
    } else if (e.key === 's') {
      e.preventDefault();
      _toggleMode();
    } else if (e.key === 'o') {
      e.preventDefault();
      _dispatchOpenInEditor();
    }
  };
  document.addEventListener('keydown', _keydownHandler, true);
}

function _detachKeyHandler() {
  if (!_keydownHandler) return;
  document.removeEventListener('keydown', _keydownHandler, true);
  _keydownHandler = null;
}

// Export a few internals for tests / dev console.
if (typeof window !== 'undefined') {
  window.__diffViewer = {
    open: openDiffViewer,
    close: closeDiffViewer,
    detectLangByExt,
  };
}
