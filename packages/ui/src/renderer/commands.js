// =============================================================================
// Agent Desk — Command Palette, Quick Switcher, Snippet Picker, Shortcuts
// =============================================================================

'use strict';

import { state, registry } from './state.js';
import { morph, esc, escAttr } from './dom-utils.js';

// Terminal Context Menu (used by layout tab + keybinds)

export function showTerminalContextMenu(x, y, id) {
  const siCwd = typeof ShellIntegration !== 'undefined' ? ShellIntegration.getCwd(id) : null;
  const siActive = typeof ShellIntegration !== 'undefined' ? ShellIntegration.isActive(id) : false;
  const shellItems = [];
  if (siCwd) {
    shellItems.push({
      label: 'Open in Explorer',
      icon: 'folder_open',
      action: () => agentDesk.openPath(siCwd),
    });
    shellItems.push({
      label: 'Copy Path',
      icon: 'content_copy',
      action: () => {
        navigator.clipboard.writeText(siCwd);
        registry.showToast('Path copied');
      },
    });
  }
  if (siActive) {
    shellItems.push({
      label: 'Copy Last Command Output',
      icon: 'content_paste_go',
      action: () => {
        state.activeTerminalId = id;
        _copyLastCommandOutput();
      },
    });
  }
  if (shellItems.length > 0) shellItems.push({ type: 'separator' });

  registry.showContextMenu(x, y, [
    ...shellItems,
    {
      label: 'Rename',
      icon: 'edit',
      action: () => {
        const ts = state.terminals.get(id);
        if (ts && ts._tabLabel) registry.startInlineRename(id, ts._tabLabel);
      },
    },
    {
      label: 'Save Output...',
      icon: 'save',
      shortcut: 'Ctrl+Shift+S',
      action: () => registry.saveTerminalOutput(id),
    },
    {
      label: 'Copy All Output',
      icon: 'content_copy',
      action: () => registry.copyAllTerminalOutput(id),
    },
    { type: 'separator' },
    {
      label: 'Split Right',
      icon: 'vertical_split',
      shortcut: 'Ctrl+Shift+D',
      action: () => registry.createTerminal({ splitDirection: 'right', referenceTerminalId: id }),
    },
    {
      label: 'Split Down',
      icon: 'horizontal_split',
      shortcut: 'Ctrl+Shift+E',
      action: () => registry.createTerminal({ splitDirection: 'below', referenceTerminalId: id }),
    },
    { type: 'separator' },
    {
      label: 'Chain to...',
      icon: 'device_hub',
      action: () => registry.showChainPicker(id),
    },
    {
      label: 'Pop Out',
      icon: 'open_in_new',
      action: () => registry.popOutTerminal(id),
    },
    { type: 'separator' },
    {
      label: 'Maximize / Restore',
      icon: 'open_in_full',
      shortcut: 'Ctrl+Shift+M',
      action: () => {
        state.activeTerminalId = id;
        registry.toggleMaximize();
      },
    },
    { type: 'separator' },
    { label: 'Close', icon: 'close', shortcut: 'Ctrl+W', action: () => registry.confirmCloseTerminal(id) },
    {
      label: 'Close Others',
      icon: 'tab_close_right',
      action: () => {
        const ids = [...state.terminalOrder].filter((tid) => tid !== id);
        ids.forEach((tid) => registry.closeTerminal(tid));
      },
    },
  ]);
}

// Command Palette (Ctrl+Shift+P)

const COMMANDS = [
  {
    id: 'new-terminal',
    label: 'New Terminal',
    icon: 'terminal',
    shortcut: 'Ctrl+Shift+T',
    action: () => {
      const profiles = typeof getProfiles === 'function' ? getProfiles() : [];
      const defaultId = typeof getSetting === 'function' ? getSetting('defaultProfile') : 'default-shell';
      const profile = profiles.find((p) => p.id === defaultId) || profiles[0];
      if (profile) {
        registry.createTerminalFromProfile(profile);
      } else {
        registry.createTerminal();
      }
    },
  },
  {
    id: 'new-agent',
    label: 'New Agent Session',
    icon: 'smart_toy',
    shortcut: 'Ctrl+Shift+C',
    action: () => {
      const profiles = typeof getProfiles === 'function' ? getProfiles() : [];
      const shellIds = new Set(['default-shell']);
      const agentProfile = profiles.find((p) => !shellIds.has(p.id) && p.command && p.command !== '');
      if (agentProfile) {
        registry.createTerminalFromProfile(agentProfile);
      } else {
        registry.createTerminal();
      }
    },
  },
  {
    id: 'close-terminal',
    label: 'Close Terminal',
    icon: 'close',
    shortcut: 'Ctrl+W',
    action: () => {
      if (state.activeTerminalId) registry.confirmCloseTerminal(state.activeTerminalId);
    },
  },
  {
    id: 'split-right',
    label: 'Split Right',
    icon: 'vertical_split',
    shortcut: 'Ctrl+Shift+D',
    action: () => registry.splitTerminalRight(),
  },
  {
    id: 'split-down',
    label: 'Split Down',
    icon: 'horizontal_split',
    shortcut: 'Ctrl+Shift+E',
    action: () => registry.splitTerminalDown(),
  },
  {
    id: 'maximize',
    label: 'Toggle Maximize',
    icon: 'open_in_full',
    shortcut: 'Ctrl+Shift+M',
    action: () => registry.toggleMaximize(),
  },
  {
    id: 'view-terminals',
    label: 'View: Terminals',
    icon: 'terminal',
    shortcut: 'Ctrl+1',
    action: () => registry.switchView('terminals'),
  },
  {
    id: 'view-comm',
    label: 'View: Agent Comm',
    icon: 'forum',
    shortcut: 'Ctrl+2',
    action: () => registry.switchView('comm'),
  },
  {
    id: 'view-tasks',
    label: 'View: Tasks',
    icon: 'task_alt',
    shortcut: 'Ctrl+3',
    action: () => registry.switchView('tasks'),
  },
  {
    id: 'view-knowledge',
    label: 'View: Agent Knowledge',
    icon: 'psychology',
    shortcut: 'Ctrl+4',
    action: () => registry.switchView('knowledge'),
  },
  {
    id: 'view-discover',
    label: 'View: Discover',
    icon: 'widgets',
    shortcut: 'Ctrl+5',
    action: () => registry.switchView('discover'),
  },
  {
    id: 'view-monitor',
    label: 'View: Agent Monitor',
    icon: 'hub',
    shortcut: 'Ctrl+6',
    action: () => registry.switchView('monitor'),
  },
  {
    id: 'view-settings',
    label: 'View: Settings',
    icon: 'settings',
    shortcut: 'Ctrl+8',
    action: () => registry.switchView('settings'),
  },
  {
    id: 'toggle-theme',
    label: 'Toggle Theme',
    icon: 'dark_mode',
    action: () => {
      const btn = document.getElementById('btn-theme-toggle');
      if (btn) btn.click();
    },
  },
  {
    id: 'shortcuts',
    label: 'Show Keyboard Shortcuts',
    icon: 'help',
    shortcut: 'F1',
    action: () => showShortcutsOverlay(),
  },
  {
    id: 'close-idle',
    label: 'Close Idle Terminals',
    icon: 'delete_sweep',
    action: () => registry.closeIdleTerminals(),
  },
  {
    id: 'auto-arrange',
    label: 'Auto-Arrange Terminals',
    icon: 'grid_view',
    action: () => registry.reorderTerminals(),
  },
  {
    id: 'global-search',
    label: 'Search All Terminals',
    icon: 'search',
    shortcut: 'Ctrl+Shift+F',
    action: () => registry.showGlobalSearch(),
  },
  {
    id: 'pop-out',
    label: 'Pop Out Terminal',
    icon: 'open_in_new',
    action: () => {
      if (state.activeTerminalId) registry.popOutTerminal(state.activeTerminalId);
    },
  },
  {
    id: 'view-events',
    label: 'View: Events',
    icon: 'timeline',
    shortcut: 'Ctrl+7',
    action: () => registry.switchView('events'),
  },
  {
    id: 'chain-terminal',
    label: 'Chain Terminal...',
    icon: 'device_hub',
    action: () => {
      if (state.activeTerminalId) registry.showChainPicker(state.activeTerminalId);
    },
  },
  {
    id: 'batch-launch',
    label: 'Launch Agent Batch...',
    icon: 'rocket_launch',
    shortcut: 'Ctrl+Shift+B',
    action: () => registry.showBatchLauncher(),
  },
  {
    id: 'check-updates',
    label: 'Check for Updates',
    icon: 'system_update',
    action: () => {
      registry.showToast('Checking for updates...');
      agentDesk.app.checkForUpdates();
    },
  },
  {
    id: 'save-workspace',
    label: 'Save Workspace',
    icon: 'workspaces',
    shortcut: 'Ctrl+Shift+W',
    action: () => registry.showWorkspaceSaveDialog(),
  },
  {
    id: 'load-workspace',
    label: 'Load Workspace...',
    icon: 'workspaces',
    shortcut: 'Ctrl+Alt+W',
    action: () => registry.showWorkspaceLoadPicker(),
  },
];

function _getAllCommands() {
  const all = COMMANDS.slice();
  if (typeof registry.getTemplateCommands === 'function') {
    const tplCmds = registry.getTemplateCommands();
    if (Array.isArray(tplCmds)) all.push(...tplCmds);
  }
  return all;
}

function _fuzzyFilterCommands(query) {
  const all = _getAllCommands();
  if (!query) return all;
  const q = query.toLowerCase();
  const prefixMatches = [];
  const containsMatches = [];
  for (const cmd of all) {
    const label = cmd.label.toLowerCase();
    if (label.startsWith(q)) {
      prefixMatches.push(cmd);
    } else if (label.includes(q)) {
      containsMatches.push(cmd);
    }
  }
  return prefixMatches.concat(containsMatches);
}

export function showCommandPalette() {
  if (document.querySelector('.command-palette-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'command-palette-overlay';

  const modal = document.createElement('div');
  modal.className = 'command-palette-modal';

  const input = document.createElement('input');
  input.className = 'command-palette-input';
  input.type = 'text';
  input.placeholder = 'Type a command...';
  input.spellcheck = false;

  const list = document.createElement('div');
  list.className = 'command-palette-list';

  modal.appendChild(input);
  modal.appendChild(list);
  overlay.appendChild(modal);

  let selectedIndex = 0;
  let filtered = _getAllCommands();

  function renderList() {
    const html = filtered
      .map(
        (cmd, i) =>
          `<div class="command-palette-item${i === selectedIndex ? ' selected' : ''}" data-index="${i}">` +
          `<span class="material-symbols-outlined command-palette-icon">${esc(cmd.icon)}</span>` +
          `<span class="command-palette-label">${esc(cmd.label)}</span>` +
          (cmd.shortcut ? `<kbd class="command-palette-shortcut">${esc(cmd.shortcut)}</kbd>` : '') +
          `</div>`,
      )
      .join('');
    morph(list, html);
    // Scroll selected item into view
    const sel = list.querySelector('.command-palette-item.selected');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  // Event delegation for list items
  list.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.command-palette-item[data-index]');
    if (!item) return;
    const idx = parseInt(item.dataset.index, 10);
    if (idx !== selectedIndex) {
      selectedIndex = idx;
      renderList();
    }
  });

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.command-palette-item[data-index]');
    if (!item) return;
    const idx = parseInt(item.dataset.index, 10);
    if (filtered[idx]) {
      hideCommandPalette();
      filtered[idx].action();
    }
  });

  input.addEventListener('input', () => {
    filtered = _fuzzyFilterCommands(input.value);
    selectedIndex = 0;
    renderList();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length > 0) {
        selectedIndex = (selectedIndex + 1) % filtered.length;
        renderList();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length > 0) {
        selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length;
        renderList();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        hideCommandPalette();
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideCommandPalette();
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideCommandPalette();
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    input.focus();
  });
  renderList();
}

export function hideCommandPalette() {
  const overlay = document.querySelector('.command-palette-overlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
  setTimeout(() => overlay.remove(), 150);
}

// Quick Terminal Switcher (Ctrl+P)

export function showQuickSwitcher() {
  if (document.querySelector('.quick-switcher-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'quick-switcher-overlay';

  const modal = document.createElement('div');
  modal.className = 'quick-switcher-modal';

  const input = document.createElement('input');
  input.className = 'quick-switcher-input';
  input.type = 'text';
  input.placeholder = 'Switch to terminal\u2026';

  const list = document.createElement('div');
  list.className = 'quick-switcher-list';

  modal.appendChild(input);
  modal.appendChild(list);
  overlay.appendChild(modal);

  let selectedIdx = 0;

  function getFilteredTerminals(query) {
    const items = [];
    for (const id of state.terminalOrder) {
      const ts = state.terminals.get(id);
      if (!ts) continue;
      const title = ts.title || 'Terminal';
      if (query) {
        const q = query.toLowerCase();
        const t = title.toLowerCase();
        let qi = 0;
        for (let ti = 0; ti < t.length && qi < q.length; ti++) {
          if (t[ti] === q[qi]) qi++;
        }
        if (qi < q.length) continue;
      }
      items.push({ id, ts, title });
    }
    return items;
  }

  let _lastFilteredItems = [];

  function render(query) {
    const items = getFilteredTerminals(query);
    _lastFilteredItems = items;

    if (items.length === 0) {
      const emptyMsg = query ? 'No matching terminals' : 'No terminals open';
      morph(list, `<div class="quick-switcher-empty">${esc(emptyMsg)}</div>`);
      selectedIdx = -1;
      return;
    }

    if (!query && items.length > 1) {
      const currentIdx = items.findIndex((i) => i.id === state.activeTerminalId);
      selectedIdx = currentIdx === 0 ? 1 : 0;
    } else {
      selectedIdx = 0;
    }

    const agentNames = new Set(['claude', 'opencode']);
    const html = items
      .map((item, idx) => {
        const classes = [
          'quick-switcher-item',
          item.id === state.activeTerminalId ? 'current' : '',
          idx === selectedIdx ? 'selected' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const statusClass = item.ts.status || 'idle';
        const iconName = agentNames.has((item.title || '').toLowerCase()) ? 'smart_toy' : 'terminal';
        const activeTag = item.id === state.activeTerminalId ? '<span class="qs-active">active</span>' : '';
        return (
          `<div class="${escAttr(classes)}" data-index="${idx}" data-terminal-id="${escAttr(item.id)}">` +
          `<span class="qs-dot ${escAttr(statusClass)}"></span>` +
          `<span class="qs-icon material-symbols-outlined">${esc(iconName)}</span>` +
          `<span class="qs-title">${esc(item.title)}</span>` +
          activeTag +
          `<span class="qs-badge">${esc(statusClass)}</span>` +
          `</div>`
        );
      })
      .join('');
    morph(list, html);
  }

  function updateSelection() {
    const rows = list.querySelectorAll('.quick-switcher-item');
    rows.forEach((r, i) => r.classList.toggle('selected', i === selectedIdx));
    if (rows[selectedIdx]) {
      rows[selectedIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  // Event delegation for quick switcher list items
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.quick-switcher-item[data-terminal-id]');
    if (!row) return;
    selectAndSwitch(row.dataset.terminalId);
  });

  list.addEventListener('mouseover', (e) => {
    const row = e.target.closest('.quick-switcher-item[data-index]');
    if (!row) return;
    const idx = parseInt(row.dataset.index, 10);
    if (idx !== selectedIdx) {
      selectedIdx = idx;
      updateSelection();
    }
  });

  function selectAndSwitch(id) {
    hideQuickSwitcher();
    if (state.activeView !== 'terminals') {
      registry.switchView('terminals');
    }
    registry._activateTerminalById(id);
  }

  input.addEventListener('input', () => {
    render(input.value);
  });

  input.addEventListener('keydown', (e) => {
    const items = getFilteredTerminals(input.value);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length > 0) {
        selectedIdx = (selectedIdx + 1) % items.length;
        updateSelection();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length > 0) {
        selectedIdx = (selectedIdx - 1 + items.length) % items.length;
        updateSelection();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length > 0 && selectedIdx >= 0 && selectedIdx < items.length) {
        selectAndSwitch(items[selectedIdx].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideQuickSwitcher();
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideQuickSwitcher();
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    input.focus();
  });

  render('');
}

export function hideQuickSwitcher() {
  const overlay = document.querySelector('.quick-switcher-overlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
  setTimeout(() => overlay.remove(), 150);

  // Re-focus active terminal
  if (state.activeTerminalId && state.activeView === 'terminals') {
    const ts = state.terminals.get(state.activeTerminalId);
    if (ts) ts.term.focus();
  }
}

// Shortcuts Overlay

export function showShortcutsOverlay() {
  if (document.querySelector('.shortcuts-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'shortcuts-overlay';

  const _buildDynamic = typeof KeybindingManager !== 'undefined';
  if (_buildDynamic) {
    const _modal = document.createElement('div');
    _modal.className = 'shortcuts-modal';
    const _h2 = document.createElement('h2');
    _h2.textContent = 'Keyboard Shortcuts';
    _modal.appendChild(_h2);
    const _bindings = KeybindingManager.getBindings();
    const _cats = {};
    for (const _b of _bindings) {
      const _c = _b.category || 'Other';
      if (!_cats[_c]) _cats[_c] = [];
      _cats[_c].push(_b);
    }
    for (const [_cn, _cb] of Object.entries(_cats)) {
      const _h3 = document.createElement('h3');
      _h3.textContent = _cn;
      _modal.appendChild(_h3);
      for (const _b of _cb) {
        const _k = _b.effectiveKeys;
        if (!_k) continue;
        const _row = document.createElement('div');
        _row.className = 'shortcut-row';
        const _lbl = document.createElement('span');
        _lbl.className = 'label';
        _lbl.textContent = _b.label;
        _row.appendChild(_lbl);
        const _kbd = document.createElement('kbd');
        _kbd.textContent = _k;
        _row.appendChild(_kbd);
        _modal.appendChild(_row);
      }
    }
    const _clipH = document.createElement('h3');
    _clipH.textContent = 'Clipboard';
    _modal.appendChild(_clipH);
    [
      ['Copy (with selection)', 'Ctrl+C'],
      ['Paste', 'Ctrl+V'],
    ].forEach(([_l, _ky]) => {
      const _r = document.createElement('div');
      _r.className = 'shortcut-row';
      const _s = document.createElement('span');
      _s.className = 'label';
      _s.textContent = _l;
      _r.appendChild(_s);
      const _kk = document.createElement('kbd');
      _kk.textContent = _ky;
      _r.appendChild(_kk);
      _modal.appendChild(_r);
    });
    const _hint = document.createElement('div');
    _hint.className = 'close-hint';
    _hint.textContent = 'Press Escape or click outside to close';
    _modal.appendChild(_hint);
    overlay.appendChild(_modal);
  } else {
    overlay.innerHTML = `
    <div class="shortcuts-modal">
      <h2>Keyboard Shortcuts</h2>

      <h3>Terminals</h3>
      <div class="shortcut-row"><span class="label">New Shell</span><kbd>Ctrl+Shift+T</kbd></div>
      <div class="shortcut-row"><span class="label">New Agent Session</span><kbd>Ctrl+Shift+C</kbd></div>
      <div class="shortcut-row"><span class="label">Close Terminal</span><kbd>Ctrl+W</kbd></div>
      <div class="shortcut-row"><span class="label">Next Terminal</span><kbd>Ctrl+Tab</kbd></div>
      <div class="shortcut-row"><span class="label">Previous Terminal</span><kbd>Ctrl+Shift+Tab</kbd></div>
      <div class="shortcut-row"><span class="label">Split Right</span><kbd>Ctrl+Shift+D</kbd></div>
      <div class="shortcut-row"><span class="label">Split Down</span><kbd>Ctrl+Shift+E</kbd></div>
      <div class="shortcut-row"><span class="label">Save Output</span><kbd>Ctrl+Shift+S</kbd></div>
      <div class="shortcut-row"><span class="label">Toggle Maximize</span><kbd>Ctrl+Shift+M</kbd></div>
      <div class="shortcut-row"><span class="label">Quick Switcher</span><kbd>Ctrl+P</kbd></div>
      <div class="shortcut-row"><span class="label">Terminal Search</span><kbd>Ctrl+F</kbd></div>
      <div class="shortcut-row"><span class="label">Search All Terminals</span><kbd>Ctrl+Shift+F</kbd></div>
      <div class="shortcut-row"><span class="label">Focus Left/Right/Up/Down</span><kbd>Alt+Arrow</kbd></div>
      <div class="shortcut-row"><span class="label">Event Stream</span><kbd>Ctrl+E</kbd></div>

      <h3>Clipboard</h3>
      <div class="shortcut-row"><span class="label">Copy (with selection)</span><kbd>Ctrl+C</kbd></div>
      <div class="shortcut-row"><span class="label">Paste</span><kbd>Ctrl+V</kbd></div>
      <div class="shortcut-row"><span class="label">Right-click</span><span class="label">Paste / Context menu</span></div>

      <h3>Views</h3>
      <div class="shortcut-row"><span class="label">Terminals</span><kbd>Ctrl+1</kbd></div>
      <div class="shortcut-row"><span class="label">Agent Comm</span><kbd>Ctrl+2</kbd></div>
      <div class="shortcut-row"><span class="label">Tasks</span><kbd>Ctrl+3</kbd></div>
      <div class="shortcut-row"><span class="label">Agent Knowledge</span><kbd>Ctrl+4</kbd></div>


      <h3>Workspaces</h3>
      <div class="shortcut-row"><span class="label">Save Workspace</span><kbd>Ctrl+Shift+W</kbd></div>
      <div class="shortcut-row"><span class="label">Load Workspace</span><kbd>Ctrl+Alt+W</kbd></div>

      <h3>General</h3>
      <div class="shortcut-row"><span class="label">Command Palette</span><kbd>Ctrl+Shift+P</kbd></div>
      <div class="shortcut-row"><span class="label">Toggle Theme</span><kbd>Theme button</kbd></div>
      <div class="shortcut-row"><span class="label">Show Shortcuts</span><kbd>F1</kbd></div>
      <div class="close-hint">Press Escape or click outside to close</div>
    </div>
  `;
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideShortcutsOverlay();
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));
}

export function hideShortcutsOverlay() {
  const overlay = document.querySelector('.shortcuts-overlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
  setTimeout(() => overlay.remove(), 150);
}

// Shell Integration helpers

function _selectLastCommandOutput() {
  if (!state.activeTerminalId) return;
  const ts = state.terminals.get(state.activeTerminalId);
  if (!ts) return;
  const lastCmd =
    typeof ShellIntegration !== 'undefined' ? ShellIntegration.getLastCommand(state.activeTerminalId) : null;
  if (!lastCmd || lastCmd.outputStartLine == null || lastCmd.endLine == null) {
    registry.showToast('No command output detected (shell integration required)');
    return;
  }
  ts.term.selectLines(lastCmd.outputStartLine, lastCmd.endLine);
}

function _copyLastCommandOutput() {
  if (!state.activeTerminalId) return;
  const ts = state.terminals.get(state.activeTerminalId);
  if (!ts) return;
  const lastCmd =
    typeof ShellIntegration !== 'undefined' ? ShellIntegration.getLastCommand(state.activeTerminalId) : null;
  if (!lastCmd || lastCmd.outputStartLine == null || lastCmd.endLine == null) {
    registry.showToast('No command output detected (shell integration required)');
    return;
  }
  ts.term.selectLines(lastCmd.outputStartLine, lastCmd.endLine);
  const sel = ts.term.getSelection();
  if (sel) {
    navigator.clipboard.writeText(sel);
    ts.term.clearSelection();
    registry.showToast('Last command output copied');
  }
}

registry.showTerminalContextMenu = showTerminalContextMenu;
registry.showCommandPalette = showCommandPalette;
registry.hideCommandPalette = hideCommandPalette;
registry.showQuickSwitcher = showQuickSwitcher;
registry.hideQuickSwitcher = hideQuickSwitcher;
registry.showShortcutsOverlay = showShortcutsOverlay;
registry.hideShortcutsOverlay = hideShortcutsOverlay;
registry._selectLastCommandOutput = _selectLastCommandOutput;
registry._copyLastCommandOutput = _copyLastCommandOutput;
