// =============================================================================
// Agent Desk — Workspace Switcher (task #93a)
// =============================================================================
//
// Renders a project switcher anchored in the titlebar. Clicking opens a
// dropdown with:
//   • Pinned workspaces (top)
//   • Recent workspaces (sorted by lastOpened desc)
//   • "Save current layout…" at the bottom
//
// Clicking a row calls openWorkspaceById, which spawns the workspace's
// terminals via window.agentDesk.workspace.open. The switcher re-renders on
// the `workspaces-changed` event so creating/deleting/opening a workspace
// instantly refreshes the list.

'use strict';

import { registry } from './state.js';

const DEFAULT_COLOR = '#6366f1';
const RECENT_LIMIT = 10;

let anchorEl = null;
let dropdownEl = null;

export function initWorkspaceSwitcher() {
  const titlebar = document.getElementById('titlebar');
  if (!titlebar) return;

  // Avoid double-mount in hot-reload scenarios.
  if (titlebar.querySelector('.workspace-switcher')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'workspace-switcher';
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('data-tooltip', 'Switch workspace');

  const dot = document.createElement('span');
  dot.className = 'workspace-switcher-dot';
  dot.style.background = DEFAULT_COLOR;
  btn.appendChild(dot);

  const label = document.createElement('span');
  label.className = 'workspace-switcher-label';
  label.textContent = 'Workspace';
  btn.appendChild(label);

  const chevron = document.createElement('span');
  chevron.className = 'material-symbols-outlined workspace-switcher-chevron';
  chevron.textContent = 'expand_more';
  btn.appendChild(chevron);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(btn);
  });

  // Insert after the app-title and before the window-controls so it lives in
  // the titlebar center area on every platform.
  const appTitle = titlebar.querySelector('.app-title');
  if (appTitle && appTitle.nextSibling) {
    titlebar.insertBefore(btn, appTitle.nextSibling);
  } else {
    titlebar.appendChild(btn);
  }
  anchorEl = btn;

  window.addEventListener('workspaces-changed', () => {
    if (dropdownEl) render();
    refreshButtonLabel();
  });

  document.addEventListener('click', (e) => {
    if (!dropdownEl) return;
    if (dropdownEl.contains(e.target) || (anchorEl && anchorEl.contains(e.target))) return;
    closeDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdownEl) closeDropdown();
  });

  refreshButtonLabel();
}

function toggleDropdown(anchor) {
  if (dropdownEl) {
    closeDropdown();
    return;
  }
  openDropdown(anchor);
}

function openDropdown(anchor) {
  dropdownEl = document.createElement('div');
  dropdownEl.className = 'workspace-switcher-dropdown';

  const header = document.createElement('div');
  header.className = 'workspace-switcher-header';
  header.textContent = 'Workspaces';
  dropdownEl.appendChild(header);

  const listEl = document.createElement('div');
  listEl.className = 'workspace-switcher-list';
  dropdownEl.appendChild(listEl);

  const footer = document.createElement('div');
  footer.className = 'workspace-switcher-footer';
  const saveAction = document.createElement('button');
  saveAction.type = 'button';
  saveAction.className = 'workspace-switcher-footer-btn';
  saveAction.innerHTML = '<span class="material-symbols-outlined">save</span> Save current layout…';
  saveAction.addEventListener('click', () => {
    closeDropdown();
    if (registry.showWorkspaceSaveDialog) registry.showWorkspaceSaveDialog();
  });
  footer.appendChild(saveAction);
  dropdownEl.appendChild(footer);

  document.body.appendChild(dropdownEl);
  positionDropdown(anchor);

  if (anchor) anchor.setAttribute('aria-expanded', 'true');

  render();
}

function positionDropdown(anchor) {
  if (!anchor || !dropdownEl) return;
  const rect = anchor.getBoundingClientRect();
  dropdownEl.style.top = Math.round(rect.bottom + 4) + 'px';
  dropdownEl.style.left = Math.round(rect.left) + 'px';
}

function closeDropdown() {
  if (dropdownEl) {
    dropdownEl.remove();
    dropdownEl = null;
  }
  if (anchorEl) anchorEl.setAttribute('aria-expanded', 'false');
}

async function render() {
  if (!dropdownEl) return;
  const listEl = dropdownEl.querySelector('.workspace-switcher-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const workspaces = registry.getRecentWorkspacesRemote ? await registry.getRecentWorkspacesRemote(RECENT_LIMIT) : [];

  if (!workspaces || workspaces.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'workspace-switcher-empty';
    empty.textContent = 'No workspaces yet. Save the current layout to create one.';
    listEl.appendChild(empty);
    return;
  }

  const pinned = workspaces.filter((w) => w.pinned);
  const recent = workspaces.filter((w) => !w.pinned);

  if (pinned.length > 0) {
    const section = _sectionLabel('Pinned');
    listEl.appendChild(section);
    for (const ws of pinned) listEl.appendChild(_row(ws));
  }
  if (recent.length > 0) {
    const section = _sectionLabel(pinned.length > 0 ? 'Recent' : 'All');
    listEl.appendChild(section);
    for (const ws of recent) listEl.appendChild(_row(ws));
  }
}

function _sectionLabel(text) {
  const el = document.createElement('div');
  el.className = 'workspace-switcher-section';
  el.textContent = text;
  return el;
}

function _row(ws) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'workspace-switcher-row';

  const dot = document.createElement('span');
  dot.className = 'workspace-color-dot';
  dot.style.background = ws.color || DEFAULT_COLOR;
  row.appendChild(dot);

  const info = document.createElement('div');
  info.className = 'workspace-switcher-info';
  const name = document.createElement('div');
  name.className = 'workspace-switcher-name';
  name.textContent = ws.name || '(unnamed)';
  info.appendChild(name);
  if (ws.rootPath) {
    const path = document.createElement('div');
    path.className = 'workspace-switcher-path';
    path.textContent = ws.rootPath;
    info.appendChild(path);
  }
  row.appendChild(info);

  if (ws.pinned) {
    const pin = document.createElement('span');
    pin.className = 'material-symbols-outlined workspace-switcher-pin';
    pin.textContent = 'push_pin';
    row.appendChild(pin);
  }

  row.addEventListener('click', () => {
    closeDropdown();
    if (registry.openWorkspaceById) registry.openWorkspaceById(ws.id);
  });
  return row;
}

async function refreshButtonLabel() {
  if (!anchorEl) return;
  const workspaces = registry.getRecentWorkspacesRemote ? await registry.getRecentWorkspacesRemote(1) : [];
  const latest = workspaces && workspaces.length > 0 ? workspaces[0] : null;
  const dot = anchorEl.querySelector('.workspace-switcher-dot');
  const label = anchorEl.querySelector('.workspace-switcher-label');
  if (!dot || !label) return;
  if (latest && latest.lastOpened > 0) {
    dot.style.background = latest.color || DEFAULT_COLOR;
    label.textContent = latest.name || 'Workspace';
  } else {
    dot.style.background = DEFAULT_COLOR;
    label.textContent = 'Workspace';
  }
}

registry.initWorkspaceSwitcher = initWorkspaceSwitcher;
