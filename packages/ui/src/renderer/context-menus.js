// =============================================================================
// Agent Desk — Context Menu & Confirm Dialog
// =============================================================================

'use strict';

import { state, registry } from './state.js';

let activeContextMenu = null;

// ---------------------------------------------------------------------------
// External-editor handoff (task #93d)
// ---------------------------------------------------------------------------

/** Cached list of editors detected via agentDesk.editor.detect(). */
let _detectedEditors = [];
/** True once detection has been attempted (avoid spamming detect()). */
let _editorsDetected = false;
/** The user's chosen default editor id (persisted in config.settings). */
let _preferredEditorId = null;

async function _ensureEditorsDetected() {
  if (_editorsDetected) return _detectedEditors;
  _editorsDetected = true;
  try {
    if (typeof agentDesk === 'undefined' || !agentDesk.editor) {
      _detectedEditors = [];
      return _detectedEditors;
    }
    const list = await agentDesk.editor.detect();
    _detectedEditors = Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('[context-menus] editor.detect failed', err);
    _detectedEditors = [];
  }
  // Best-effort load of user preference — not fatal if config is missing.
  try {
    if (typeof agentDesk !== 'undefined' && agentDesk.config) {
      const cfg = await agentDesk.config.read();
      const pref = cfg?.settings?.externalEditor;
      if (typeof pref === 'string' && _detectedEditors.some((e) => e.id === pref)) {
        _preferredEditorId = pref;
      }
    }
  } catch {
    /* ignore */
  }
  return _detectedEditors;
}

/** Return the editor the user prefers, or the first detected, or null. */
export function getDefaultEditor() {
  if (!_detectedEditors.length) return null;
  if (_preferredEditorId) {
    const hit = _detectedEditors.find((e) => e.id === _preferredEditorId);
    if (hit) return hit;
  }
  return _detectedEditors[0];
}

export function getDetectedEditors() {
  return _detectedEditors.slice();
}

/**
 * Trigger a spawn via agentDesk.editor.open and surface a toast on failure.
 * `path` must be absolute (the core handler re-resolves but UI callers should
 * already have an absolute path since every surface has one).
 */
async function _openInEditor(editorId, filePath, line, col) {
  if (!filePath) return;
  try {
    const result = await agentDesk.editor.open(editorId, filePath, line, col);
    if (!result || result.ok !== true) {
      const reason = (result && result.reason) || 'unknown';
      if (registry.showToast) {
        registry.showToast(`Open in editor failed: ${reason}`);
      }
    }
  } catch (err) {
    console.warn('[context-menus] editor.open threw', err);
    if (registry.showToast) {
      registry.showToast('Open in editor failed');
    }
  }
}

/**
 * Build a flat list of "Open in <editor>" context-menu entries for a given
 * file path. Returns an empty array when no editor is detected — callers
 * should include a separator conditionally.
 *
 * Gating: the caller must supply a file path. For directories (e.g. a
 * terminal's cwd), pass the directory — vscode/cursor open the folder as a
 * workspace.
 */
export function buildOpenInEditorMenuItems(filePath, options = {}) {
  if (!filePath || !_detectedEditors.length) return [];
  const { line, col, labelPrefix = 'Open in' } = options;
  const items = [];
  const primary = getDefaultEditor();
  if (primary) {
    items.push({
      label: `${labelPrefix} ${primary.name}`,
      icon: 'open_in_new',
      action: () => _openInEditor(primary.id, filePath, line, col),
    });
  }
  // If more than one editor is detected, offer the others as a submenu-like
  // flat follow-up (the menu renderer doesn't support nested submenus, so we
  // append additional direct entries). Skip duplicates of the primary.
  if (_detectedEditors.length > 1) {
    for (const ed of _detectedEditors) {
      if (primary && ed.id === primary.id) continue;
      items.push({
        label: `${labelPrefix} ${ed.name}`,
        icon: 'open_in_new',
        action: () => _openInEditor(ed.id, filePath, line, col),
      });
    }
  }
  return items;
}

export function showContextMenu(x, y, items) {
  hideContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';

  items.forEach((item) => {
    if (item.type === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'context-separator';
      menu.appendChild(sep);
      return;
    }

    const entry = document.createElement('div');
    entry.className = 'context-item' + (item.danger ? ' danger' : '');

    if (item.icon) {
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      icon.textContent = item.icon;
      entry.appendChild(icon);
    }

    const label = document.createElement('span');
    label.textContent = item.label;
    entry.appendChild(label);

    if (item.shortcut) {
      const shortcut = document.createElement('span');
      shortcut.className = 'shortcut';
      shortcut.textContent = item.shortcut;
      entry.appendChild(shortcut);
    }

    entry.addEventListener('click', () => {
      hideContextMenu();
      item.action();
    });
    menu.appendChild(entry);
  });

  document.body.appendChild(menu);
  activeContextMenu = menu;

  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - rect.width - 4}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${window.innerHeight - rect.height - 4}px`;
    }
  });
}

export function hideContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }
}

export function getActiveContextMenu() {
  return activeContextMenu;
}

export function showConfirmDialog(title, message, onConfirm) {
  const existing = document.querySelector('.confirm-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  const modal = document.createElement('div');
  modal.className = 'confirm-modal';

  const h = document.createElement('h3');
  h.textContent = title;
  modal.appendChild(h);

  const p = document.createElement('p');
  p.textContent = message;
  modal.appendChild(p);

  const btnRow = document.createElement('div');
  btnRow.className = 'confirm-buttons';

  function cleanup() {
    document.removeEventListener('keydown', keyHandler);
    overlay.remove();
  }

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'confirm-btn confirm-btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', cleanup);

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'confirm-btn confirm-btn-confirm';
  confirmBtn.textContent = 'Close';
  confirmBtn.addEventListener('click', () => {
    cleanup();
    onConfirm();
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));
  cancelBtn.focus();

  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      cleanup();
    } else if (e.key === 'Enter') {
      cleanup();
      onConfirm();
    }
  };
  document.addEventListener('keydown', keyHandler);
}

export function getLifecycleMenuItems(terminalId) {
  const ts = registry.getTerminalState ? registry.getTerminalState(terminalId) : null;
  const isRunning = ts && (ts.status === 'running' || ts.status === 'waiting' || ts.status === 'idle');

  return [
    { type: 'separator' },
    {
      label: 'Interrupt (Ctrl+C)',
      icon: 'cancel',
      action: () => agentDesk.terminal.signal(terminalId, 'SIGINT'),
      disabled: !isRunning,
    },
    {
      label: 'Stop Agent',
      icon: 'stop_circle',
      action: () => agentDesk.terminal.signal(terminalId, 'SIGTERM'),
      disabled: !isRunning,
    },
    {
      label: 'Force Kill',
      icon: 'dangerous',
      danger: true,
      action: () => agentDesk.terminal.signal(terminalId, 'SIGKILL'),
      disabled: !isRunning,
    },
    {
      label: 'Restart',
      icon: 'restart_alt',
      action: async () => {
        const result = await agentDesk.terminal.restart(terminalId);
        if (result && registry.handleTerminalRestart) {
          registry.handleTerminalRestart(terminalId, result);
        }
      },
      disabled: false,
    },
    { type: 'separator' },
  ];
}

function _wrapTerminalContextMenu() {
  const _origShowTerminalContextMenu = registry.showTerminalContextMenu;
  if (!_origShowTerminalContextMenu) return;

  registry.showTerminalContextMenu = (x, y, id) => {
    const origShowCtx = registry.showContextMenu;

    registry.showContextMenu = (cx, cy, items) => {
      const lifecycleItems = getLifecycleMenuItems(id).filter((item) => !item.disabled);
      const closeIdx = items.findIndex((item) => item.label === 'Close');
      if (closeIdx !== -1) {
        items.splice(closeIdx, 0, ...lifecycleItems);
      } else {
        items.push(...lifecycleItems);
      }

      // #93d — "Open in <editor>" entries for the terminal's cwd
      const cwd = _getTerminalCwd(id);
      const editorItems = buildOpenInEditorMenuItems(cwd);
      if (editorItems.length > 0) {
        const insertIdx = items.findIndex((item) => item.type === 'separator');
        const sep = [{ type: 'separator' }, ...editorItems];
        if (insertIdx === -1) {
          items.push(...sep);
        } else {
          items.splice(insertIdx, 0, ...sep);
        }
      }

      registry.showContextMenu = origShowCtx;
      origShowCtx(cx, cy, items);
    };

    try {
      _origShowTerminalContextMenu(x, y, id);
    } finally {
      registry.showContextMenu = origShowCtx;
    }
  };
}

// ---------------------------------------------------------------------------
// Surface helpers — terminal cwd, custom events
// ---------------------------------------------------------------------------

function _getTerminalCwd(id) {
  // Prefer the live shell-integration cwd (updated as the user cd's), fall
  // back to the spawn cwd captured when the terminal was created.
  try {
    if (typeof ShellIntegration !== 'undefined' && ShellIntegration.getCwd) {
      const live = ShellIntegration.getCwd(id);
      if (live) return live;
    }
  } catch {
    /* ignore */
  }
  const ts = state.terminals?.get?.(id);
  return ts?.cwd || null;
}

/**
 * #93d — listen for cross-component custom events dispatched by the git
 * sidebar (`git:open-in-editor`) and diff viewer (`diff:open-in-editor`).
 * Those components own their own DOM files; we stay out by handling the
 * event at the document level and routing to agentDesk.editor.open.
 *
 * Event detail shape:
 *   { path: string, line?: number, col?: number, root?: string }
 * If path is relative and root is provided, we join them before spawning.
 */
function _bindCustomEventBridge() {
  const handler = async (ev) => {
    const detail = ev && ev.detail ? ev.detail : {};
    let filePath = detail.path || '';
    if (!filePath) return;

    // Relative-path join fallback — only if the path is not already absolute
    // and a root is provided.
    if (detail.root && !/^([a-zA-Z]:)?[\\/]/.test(filePath)) {
      const sep = /[\\/]$/.test(detail.root) ? '' : '/';
      filePath = `${detail.root}${sep}${filePath}`;
    }

    await _ensureEditorsDetected();
    const editor = getDefaultEditor();
    if (!editor) {
      if (registry.showToast) registry.showToast('No external editor detected');
      return;
    }
    await _openInEditor(editor.id, filePath, detail.line, detail.col);
  };
  document.addEventListener('git:open-in-editor', handler);
  document.addEventListener('diff:open-in-editor', handler);
}

/**
 * #93d — context menu for git sidebar file rows. Listens for contextmenu
 * events at document level with a `.git-file-row` target so we never edit
 * git-sidebar.js itself. Rows must expose `data-path` (absolute or relative
 * to the row's `data-root`).
 */
function _bindGitSidebarContextMenu() {
  document.addEventListener('contextmenu', (ev) => {
    const row = ev.target && ev.target.closest && ev.target.closest('.git-file-row');
    if (!row) return;
    let filePath = row.dataset.path || row.getAttribute('data-path') || '';
    const root = row.dataset.root || row.getAttribute('data-root') || '';
    if (!filePath) return;
    if (root && !/^([a-zA-Z]:)?[\\/]/.test(filePath)) {
      const sep = /[\\/]$/.test(root) ? '' : '/';
      filePath = `${root}${sep}${filePath}`;
    }

    const editorItems = buildOpenInEditorMenuItems(filePath);
    if (editorItems.length === 0) return;

    ev.preventDefault();
    showContextMenu(ev.clientX, ev.clientY, [
      {
        label: 'Copy Path',
        icon: 'content_copy',
        action: () => {
          try {
            navigator.clipboard.writeText(filePath);
            if (registry.showToast) registry.showToast('Path copied');
          } catch {
            /* ignore */
          }
        },
      },
      { type: 'separator' },
      ...editorItems,
    ]);
  });
}

registry.getTerminalState = (id) => {
  return state.terminals?.get(id) || null;
};

registry.showContextMenu = showContextMenu;
registry.hideContextMenu = hideContextMenu;
registry.getActiveContextMenu = getActiveContextMenu;
registry.showConfirmDialog = showConfirmDialog;
registry._wrapTerminalContextMenu = _wrapTerminalContextMenu;
registry.buildOpenInEditorMenuItems = buildOpenInEditorMenuItems;
registry.getDefaultEditor = getDefaultEditor;
registry.getDetectedEditors = getDetectedEditors;
registry.ensureEditorsDetected = _ensureEditorsDetected;

document.addEventListener('DOMContentLoaded', () => {
  _wrapTerminalContextMenu();
  _bindCustomEventBridge();
  _bindGitSidebarContextMenu();
  // Fire-and-forget detection so the first right-click has editors ready.
  _ensureEditorsDetected().catch(() => {});
});
