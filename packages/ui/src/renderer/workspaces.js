// =============================================================================
// Agent Desk — Workspace Save/Load Dialogs
// =============================================================================

'use strict';

import { state, registry } from './state.js';

function _captureWorkspaceData() {
  const terminals = [];
  for (const [, ts] of state.terminals) {
    terminals.push({
      panelId: ts.panelId,
      command: ts._command || '',
      args: ts._args || [],
      cwd: ts._cwd || '',
      title: ts.title || 'Terminal',
      profile: ts._profileName || '',
      icon: ts._profileIcon || '',
    });
  }
  let layout = null;
  if (state.dockview) {
    try {
      layout = state.dockview.toJSON();
    } catch {
      /* dockview may not support toJSON */
    }
  }
  return { terminals, layout };
}

export function showWorkspaceSaveDialog() {
  const existing = document.querySelector('.workspace-dialog-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  const modal = document.createElement('div');
  modal.className = 'confirm-modal';

  const h = document.createElement('h3');
  h.textContent = 'Save Workspace';
  modal.appendChild(h);

  const p = document.createElement('p');
  p.textContent = 'Enter a name for this workspace layout:';
  modal.appendChild(p);

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'dev-setup';
  input.style.cssText =
    'width:100%;margin:8px 0;box-sizing:border-box;background:var(--surface,#1e1e1e);' +
    'border:1px solid var(--border,#2c2c2c);color:var(--text,#e0e0e0);padding:8px 12px;' +
    'border-radius:6px;font-size:13px;font-family:inherit;outline:none;';
  modal.appendChild(input);

  const btnRow = document.createElement('div');
  btnRow.className = 'confirm-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'confirm-btn confirm-btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => overlay.remove());

  const saveBtn = document.createElement('button');
  saveBtn.className = 'confirm-btn confirm-btn-confirm';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    const data = _captureWorkspaceData();
    const workspace = {
      name,
      created: new Date().toISOString(),
      layout: data.layout,
      terminals: data.terminals,
    };
    if (typeof saveWorkspace === 'function') {
      saveWorkspace(name, workspace);
    }
    overlay.remove();
    registry.showToast('Workspace saved: ' + name);
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    input.focus();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
    if (e.key === 'Escape') overlay.remove();
  });
}

export function showWorkspaceLoadPicker() {
  const workspaces = typeof loadWorkspaces === 'function' ? loadWorkspaces() : {};
  const names = Object.keys(workspaces);
  if (names.length === 0) {
    registry.showToast('No saved workspaces');
    return;
  }

  const existing = document.querySelector('.workspace-picker-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'command-palette-overlay workspace-picker-overlay';

  const modal = document.createElement('div');
  modal.className = 'command-palette-modal';

  const input = document.createElement('input');
  input.className = 'command-palette-input';
  input.type = 'text';
  input.placeholder = 'Load workspace\u2026';

  const list = document.createElement('div');
  list.className = 'command-palette-list';

  let selectedIdx = 0;

  function render(query) {
    list.innerHTML = '';
    const filtered = names.filter((n) => !query || n.toLowerCase().includes(query.toLowerCase()));
    selectedIdx = Math.min(selectedIdx, Math.max(0, filtered.length - 1));

    filtered.forEach((name, i) => {
      const ws = workspaces[name];
      const row = document.createElement('div');
      row.className = 'command-palette-item' + (i === selectedIdx ? ' selected' : '');

      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      icon.textContent = 'workspaces';
      icon.style.cssText = 'font-size:18px;margin-right:10px;color:var(--accent,#5d8da8);';
      row.appendChild(icon);

      const label = document.createElement('span');
      label.textContent = name;
      row.appendChild(label);

      const meta = document.createElement('span');
      meta.style.cssText = 'margin-left:auto;font-size:11px;color:var(--text-muted,#888);';
      const tc = ws.terminals ? ws.terminals.length : 0;
      meta.textContent = tc + ' terminal' + (tc !== 1 ? 's' : '');
      row.appendChild(meta);

      row.addEventListener('click', () => {
        loadWorkspaceByName(name);
        overlay.remove();
      });
      row.addEventListener('mouseenter', () => {
        selectedIdx = i;
        list.querySelectorAll('.command-palette-item').forEach((el, j) => {
          el.classList.toggle('selected', j === i);
        });
      });
      list.appendChild(row);
    });
  }

  input.addEventListener('input', () => {
    selectedIdx = 0;
    render(input.value);
  });
  input.addEventListener('keydown', (e) => {
    const items = list.querySelectorAll('.command-palette-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('selected', i === selectedIdx));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, 0);
      items.forEach((el, i) => el.classList.toggle('selected', i === selectedIdx));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sel = items[selectedIdx];
      if (sel) sel.click();
    } else if (e.key === 'Escape') {
      overlay.remove();
    }
  });

  modal.appendChild(input);
  modal.appendChild(list);
  overlay.appendChild(modal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    input.focus();
  });
  render('');
}

export async function loadWorkspaceByName(name) {
  const workspaces = typeof loadWorkspaces === 'function' ? loadWorkspaces() : {};
  const ws = workspaces[name];
  if (!ws) {
    registry.showToast('Workspace not found');
    return;
  }

  const runningCount = [...state.terminals.values()].filter((t) => t.status === 'running').length;
  if (runningCount > 0) {
    registry.showConfirmDialog(
      'Load workspace: ' + name + '?',
      'This will close ' +
        runningCount +
        ' running terminal' +
        (runningCount !== 1 ? 's' : '') +
        ' and load the saved workspace.',
      () => _doLoadWorkspace(ws),
    );
  } else {
    _doLoadWorkspace(ws);
  }
}

async function _doLoadWorkspace(ws) {
  const ids = [...state.terminals.keys()];
  for (const id of ids) {
    registry.closeTerminal(id);
  }

  await new Promise((r) => setTimeout(r, 100));

  if (ws.terminals && ws.terminals.length > 0) {
    let firstId = null;
    for (const t of ws.terminals) {
      const id = await registry.createTerminal({
        command: t.command || undefined,
        args: t.args && t.args.length > 0 ? t.args : undefined,
        cwd: t.cwd || undefined,
        title: t.title || undefined,
        icon: t.icon || undefined,
        noActivate: !!firstId,
      });
      if (id) {
        if (!firstId) firstId = id;
        if (t.title) registry.renameTerminal(id, t.title, true);
      }
    }
    if (firstId) {
      registry._activateTerminalById(firstId);
    }
  }

  registry.showToast('Workspace loaded: ' + ws.name);
}

window.addEventListener('workspace-load', (e) => {
  const name = e.detail && e.detail.name;
  if (name) loadWorkspaceByName(name);
});

window.addEventListener('workspace-save-request', () => {
  showWorkspaceSaveDialog();
});

registry.showWorkspaceSaveDialog = showWorkspaceSaveDialog;
registry.showWorkspaceLoadPicker = showWorkspaceLoadPicker;
registry.loadWorkspaceByName = loadWorkspaceByName;
