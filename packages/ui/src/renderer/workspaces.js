// =============================================================================
// Agent Desk — Workspaces (project-centric records, task #93a)
// =============================================================================
//
// This module replaces the v1 "save current layout" flow with a project-
// centric workspace record backed by the `workspace:*` IPC channel bucket in
// @agent-desk/core. A workspace now carries:
//
//   name, rootPath, color, env: {...}, agents: [...], pinned, lastOpened,
//   plus the legacy { terminals, layout } payload it always had.
//
// The v1 config-store fallbacks (loadWorkspaces/saveWorkspace in settings.js)
// still exist for the migration-aware settings section, but NEW writes flow
// through window.agentDesk.workspace.* so the core migration path owns the
// shape. No more ad-hoc config.write() from the renderer.

'use strict';

import { state, registry } from './state.js';

// 24 hand-picked hues — matches the palette in the #93 plan spec.
const COLOR_PALETTE = [
  '#e11d48',
  '#f97316',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#65a30d',
  '#16a34a',
  '#059669',
  '#0891b2',
  '#0284c7',
];

const DEFAULT_COLOR = COLOR_PALETTE[10]; // #6366f1 — indigo, matches core default hue family

// ---------------------------------------------------------------------------
// Core workspace API helpers (thin wrappers over window.agentDesk.workspace.*)
// ---------------------------------------------------------------------------

async function listWorkspacesRemote() {
  try {
    return (await window.agentDesk.workspace.list()) || [];
  } catch {
    return [];
  }
}

async function getRecentWorkspacesRemote(limit) {
  try {
    return (await window.agentDesk.workspace.recent(limit)) || [];
  } catch {
    return [];
  }
}

async function saveWorkspaceRemote(ws) {
  try {
    const ok = await window.agentDesk.workspace.save(ws);
    if (ok) {
      window.dispatchEvent(new CustomEvent('workspaces-changed'));
    }
    return ok;
  } catch {
    return false;
  }
}

async function deleteWorkspaceRemote(id) {
  try {
    const ok = await window.agentDesk.workspace.delete(id);
    if (ok) {
      window.dispatchEvent(new CustomEvent('workspaces-changed'));
    }
    return ok;
  } catch {
    return false;
  }
}

async function openWorkspaceRemote(id) {
  try {
    return (await window.agentDesk.workspace.open(id)) || { openedTerminals: [] };
  } catch {
    return { openedTerminals: [] };
  }
}

// ---------------------------------------------------------------------------
// Capture the current terminal/layout snapshot for the save dialog
// ---------------------------------------------------------------------------

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

function _uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback — sufficient for renderer-local uniqueness
  return 'ws-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 10);
}

function _shellProfiles() {
  try {
    if (typeof getProfiles === 'function') return getProfiles() || [];
  } catch {
    /* not loaded yet */
  }
  return [];
}

// ---------------------------------------------------------------------------
// Save dialog — multi-field project form
// ---------------------------------------------------------------------------

/**
 * @param {object} [opts]
 * @param {object} [opts.existing] — workspace to edit (if absent, create new)
 */
export function showWorkspaceSaveDialog(opts) {
  const existing = opts && opts.existing ? opts.existing : null;
  const prior = document.querySelector('.workspace-dialog-overlay');
  if (prior) prior.remove();

  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay workspace-dialog-overlay';

  const modal = document.createElement('div');
  modal.className = 'confirm-modal workspace-dialog';

  const h = document.createElement('h3');
  h.textContent = existing ? 'Edit Workspace' : 'Save Workspace';
  modal.appendChild(h);

  const form = document.createElement('div');
  form.className = 'workspace-form';
  modal.appendChild(form);

  // --- Name field -----------------------------------------------------------
  const nameRow = _formRow('Name');
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'workspace-input';
  nameInput.placeholder = 'my-project';
  nameInput.value = existing ? existing.name || '' : '';
  nameRow.appendChild(nameInput);
  form.appendChild(nameRow);

  // --- Root path field ------------------------------------------------------
  const rootRow = _formRow('Root folder');
  const rootWrap = document.createElement('div');
  rootWrap.className = 'workspace-path-row';
  const rootInput = document.createElement('input');
  rootInput.type = 'text';
  rootInput.className = 'workspace-input';
  rootInput.placeholder = 'C:/projects/my-project';
  rootInput.value = existing ? existing.rootPath || '' : '';
  const rootBtn = document.createElement('button');
  rootBtn.type = 'button';
  rootBtn.className = 'workspace-btn workspace-btn-secondary';
  rootBtn.innerHTML = '<span class="material-symbols-outlined">folder_open</span> Browse';
  rootBtn.addEventListener('click', async () => {
    try {
      const picked = await window.agentDesk.dialog.openDirectory({ title: 'Choose workspace root folder' });
      if (picked) rootInput.value = picked;
    } catch {
      /* dialog not available on this host */
    }
  });
  rootWrap.appendChild(rootInput);
  rootWrap.appendChild(rootBtn);
  rootRow.appendChild(rootWrap);
  form.appendChild(rootRow);

  // --- Color picker ---------------------------------------------------------
  const colorRow = _formRow('Color');
  const swatchGrid = document.createElement('div');
  swatchGrid.className = 'workspace-color-grid';
  let chosenColor = (existing && existing.color) || DEFAULT_COLOR;
  const swatches = [];
  for (const hex of COLOR_PALETTE) {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'workspace-color-swatch';
    sw.style.background = hex;
    sw.setAttribute('data-color', hex);
    sw.setAttribute('aria-label', 'Color ' + hex);
    if (hex.toLowerCase() === chosenColor.toLowerCase()) sw.classList.add('selected');
    sw.addEventListener('click', () => {
      chosenColor = hex;
      swatches.forEach((s) => s.classList.toggle('selected', s === sw));
    });
    swatchGrid.appendChild(sw);
    swatches.push(sw);
  }
  colorRow.appendChild(swatchGrid);
  form.appendChild(colorRow);

  // --- Env kv editor --------------------------------------------------------
  const envRow = _formRow('Environment variables');
  const envList = document.createElement('div');
  envList.className = 'workspace-env-list';
  envRow.appendChild(envList);
  const envAddBtn = document.createElement('button');
  envAddBtn.type = 'button';
  envAddBtn.className = 'workspace-btn workspace-btn-secondary';
  envAddBtn.innerHTML = '<span class="material-symbols-outlined">add</span> Add variable';
  envAddBtn.addEventListener('click', () => _addEnvRow(envList, '', ''));
  envRow.appendChild(envAddBtn);
  form.appendChild(envRow);

  if (existing && existing.env && typeof existing.env === 'object') {
    for (const [k, v] of Object.entries(existing.env)) {
      _addEnvRow(envList, k, typeof v === 'string' ? v : String(v));
    }
  }

  // --- Agent multi-select ---------------------------------------------------
  const profiles = _shellProfiles();
  const agentRow = _formRow('Agents to launch on open');
  const agentList = document.createElement('div');
  agentList.className = 'workspace-agent-list';
  agentRow.appendChild(agentList);
  const currentAgents = new Set(existing && Array.isArray(existing.agents) ? existing.agents : []);
  if (profiles.length === 0) {
    const note = document.createElement('div');
    note.className = 'workspace-hint';
    note.textContent = 'No shell profiles found — a single default shell will spawn on open.';
    agentRow.appendChild(note);
  } else {
    for (const p of profiles) {
      const row = document.createElement('label');
      row.className = 'workspace-agent-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = p.id || p.name || '';
      cb.checked = currentAgents.has(cb.value);
      row.appendChild(cb);
      const lbl = document.createElement('span');
      lbl.textContent = p.name || p.id || '(unnamed)';
      row.appendChild(lbl);
      agentList.appendChild(row);
    }
  }
  form.appendChild(agentRow);

  // --- Pin toggle -----------------------------------------------------------
  const pinRow = document.createElement('label');
  pinRow.className = 'workspace-pin-row';
  const pinCb = document.createElement('input');
  pinCb.type = 'checkbox';
  pinCb.checked = !!(existing && existing.pinned);
  pinRow.appendChild(pinCb);
  const pinLbl = document.createElement('span');
  pinLbl.textContent = 'Pin to switcher';
  pinRow.appendChild(pinLbl);
  form.appendChild(pinRow);

  // --- Buttons --------------------------------------------------------------
  const btnRow = document.createElement('div');
  btnRow.className = 'confirm-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'confirm-btn confirm-btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => overlay.remove());
  btnRow.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'confirm-btn confirm-btn-confirm';
  saveBtn.textContent = existing ? 'Save' : 'Create';
  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      nameInput.classList.add('workspace-input-error');
      return;
    }
    const captured = _captureWorkspaceData();
    const env = {};
    envList.querySelectorAll('.workspace-env-row').forEach((row) => {
      const k = row.querySelector('.workspace-env-key').value.trim();
      const v = row.querySelector('.workspace-env-val').value;
      if (k) env[k] = v;
    });
    const agents = [];
    agentList.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      if (cb.checked && cb.value) agents.push(cb.value);
    });
    const workspace = {
      id: existing && existing.id ? existing.id : _uuid(),
      name,
      rootPath: rootInput.value.trim(),
      color: chosenColor,
      env,
      agents,
      pinned: !!pinCb.checked,
      lastOpened: existing && typeof existing.lastOpened === 'number' ? existing.lastOpened : 0,
      terminals: captured.terminals,
      layout: captured.layout,
    };
    const ok = await saveWorkspaceRemote(workspace);
    overlay.remove();
    if (ok) {
      registry.showToast('Workspace saved: ' + name);
    } else {
      registry.showToast('Failed to save workspace');
    }
  });
  btnRow.appendChild(saveBtn);

  modal.appendChild(btnRow);
  overlay.appendChild(modal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    nameInput.focus();
  });

  nameInput.addEventListener('input', () => nameInput.classList.remove('workspace-input-error'));
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
    if (e.key === 'Escape') overlay.remove();
  });
}

function _formRow(label) {
  const wrap = document.createElement('div');
  wrap.className = 'workspace-form-row';
  const lbl = document.createElement('label');
  lbl.className = 'workspace-form-label';
  lbl.textContent = label;
  wrap.appendChild(lbl);
  return wrap;
}

function _addEnvRow(container, key, value) {
  const row = document.createElement('div');
  row.className = 'workspace-env-row';
  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.className = 'workspace-input workspace-env-key';
  keyInput.placeholder = 'KEY';
  keyInput.value = key;
  const valInput = document.createElement('input');
  valInput.type = 'text';
  valInput.className = 'workspace-input workspace-env-val';
  valInput.placeholder = 'value';
  valInput.value = value;
  const rmBtn = document.createElement('button');
  rmBtn.type = 'button';
  rmBtn.className = 'workspace-btn workspace-btn-icon';
  rmBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
  rmBtn.addEventListener('click', () => row.remove());
  row.appendChild(keyInput);
  row.appendChild(valInput);
  row.appendChild(rmBtn);
  container.appendChild(row);
}

// ---------------------------------------------------------------------------
// Load picker — lists remote workspaces, click to open
// ---------------------------------------------------------------------------

export async function showWorkspaceLoadPicker() {
  const workspaces = await listWorkspacesRemote();
  if (workspaces.length === 0) {
    registry.showToast('No saved workspaces');
    return;
  }

  const prior = document.querySelector('.workspace-picker-overlay');
  if (prior) prior.remove();

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
    const q = (query || '').toLowerCase();
    const filtered = workspaces.filter((w) => !q || (w.name || '').toLowerCase().includes(q));
    selectedIdx = Math.min(selectedIdx, Math.max(0, filtered.length - 1));

    filtered.forEach((ws, i) => {
      const row = document.createElement('div');
      row.className = 'command-palette-item' + (i === selectedIdx ? ' selected' : '');

      const dot = document.createElement('span');
      dot.className = 'workspace-color-dot';
      dot.style.background = ws.color || DEFAULT_COLOR;
      row.appendChild(dot);

      const label = document.createElement('span');
      label.textContent = ws.name || '(unnamed)';
      row.appendChild(label);

      const meta = document.createElement('span');
      meta.className = 'workspace-picker-meta';
      const parts = [];
      if (ws.rootPath) parts.push(ws.rootPath);
      if (Array.isArray(ws.agents) && ws.agents.length > 0) {
        parts.push(ws.agents.length + ' agent' + (ws.agents.length !== 1 ? 's' : ''));
      }
      meta.textContent = parts.join(' \u00b7 ');
      row.appendChild(meta);

      row.addEventListener('click', () => {
        openWorkspaceById(ws.id);
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

// ---------------------------------------------------------------------------
// Open a workspace — spawns terminals via core, replays dockview layout
// ---------------------------------------------------------------------------

export async function openWorkspaceById(id) {
  const workspaces = await listWorkspacesRemote();
  const ws = workspaces.find((w) => w.id === id);
  if (!ws) {
    registry.showToast('Workspace not found');
    return;
  }

  const runningCount = [...state.terminals.values()].filter((t) => t.status === 'running').length;
  if (runningCount > 0) {
    registry.showConfirmDialog(
      'Open workspace: ' + ws.name + '?',
      'This will close ' +
        runningCount +
        ' running terminal' +
        (runningCount !== 1 ? 's' : '') +
        ' and open the saved workspace.',
      () => _doOpenWorkspace(ws),
    );
  } else {
    _doOpenWorkspace(ws);
  }
}

async function _doOpenWorkspace(ws) {
  // Close all existing terminals (renderer-local)
  const ids = [...state.terminals.keys()];
  for (const id of ids) {
    registry.closeTerminal(id);
  }
  await new Promise((r) => setTimeout(r, 100));

  // Ask core to spawn fresh terminals for this workspace's rootPath + env +
  // agents. Core returns the new terminal ids; the renderer reconnects them
  // via the standard terminal:list reconciliation path on next poll.
  await openWorkspaceRemote(ws.id);

  // If the user saved a layout snapshot previously, replay it via the UI's
  // createTerminal path so dockview panels materialize with the right titles.
  // (Core's workspace:open only spawns bare shells — agent-desk's renderer
  // still owns the dockview-layout restoration for fidelity.)
  if (ws.terminals && ws.terminals.length > 0) {
    let firstId = null;
    for (const t of ws.terminals) {
      const id = await registry.createTerminal({
        command: t.command || undefined,
        args: t.args && t.args.length > 0 ? t.args : undefined,
        cwd: t.cwd || ws.rootPath || undefined,
        title: t.title || undefined,
        icon: t.icon || undefined,
        noActivate: !!firstId,
      });
      if (id) {
        if (!firstId) firstId = id;
        if (t.title) registry.renameTerminal(id, t.title, true);
      }
    }
    if (firstId) registry._activateTerminalById(firstId);
  }

  // Signal the git sidebar (and any other workspace-aware surface) that the
  // workspace is now active and where its root folder lives. The git sidebar
  // listens for this event and runs `git:discover` against the rootPath to
  // populate the repo tree for every git repo nested inside, including
  // recursive submodules of any depth.
  if (ws.rootPath) {
    window.dispatchEvent(
      new CustomEvent('workspace-opened', {
        detail: { id: ws.id, name: ws.name, rootPath: ws.rootPath },
      }),
    );
  }

  window.dispatchEvent(new CustomEvent('workspaces-changed'));
  registry.showToast('Workspace opened: ' + ws.name);
}

// ---------------------------------------------------------------------------
// Legacy bridge: old listeners still dispatch `workspace-load` with a name —
// translate that into an id-based open by looking up name → id. Keeps any
// pre-#93a callers (settings.js, keybinds) working without code changes.
// ---------------------------------------------------------------------------

export async function loadWorkspaceByName(name) {
  const workspaces = await listWorkspacesRemote();
  const ws = workspaces.find((w) => w.name === name);
  if (!ws) {
    registry.showToast('Workspace not found');
    return;
  }
  return openWorkspaceById(ws.id);
}

export async function deleteWorkspaceById(id) {
  return deleteWorkspaceRemote(id);
}

// ---------------------------------------------------------------------------
// Public event + registry wiring (preserves Ctrl+Shift+W shortcut wiring)
// ---------------------------------------------------------------------------

window.addEventListener('workspace-load', (e) => {
  const detail = e.detail || {};
  if (detail.id) openWorkspaceById(detail.id);
  else if (detail.name) loadWorkspaceByName(detail.name);
});

window.addEventListener('workspace-save-request', () => {
  showWorkspaceSaveDialog();
});

registry.showWorkspaceSaveDialog = showWorkspaceSaveDialog;
registry.showWorkspaceLoadPicker = showWorkspaceLoadPicker;
registry.openWorkspaceById = openWorkspaceById;
registry.loadWorkspaceByName = loadWorkspaceByName;
registry.deleteWorkspaceById = deleteWorkspaceById;
registry.listWorkspacesRemote = listWorkspacesRemote;
registry.getRecentWorkspacesRemote = getRecentWorkspacesRemote;
