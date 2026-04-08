// =============================================================================
// Agent Desk — Context Menu & Confirm Dialog
// =============================================================================

'use strict';

import { state, registry } from './state.js';

let activeContextMenu = null;

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

registry.getTerminalState = (id) => {
  return state.terminals?.get(id) || null;
};

registry.showContextMenu = showContextMenu;
registry.hideContextMenu = hideContextMenu;
registry.getActiveContextMenu = getActiveContextMenu;
registry.showConfirmDialog = showConfirmDialog;
registry._wrapTerminalContextMenu = _wrapTerminalContextMenu;

document.addEventListener('DOMContentLoaded', () => {
  _wrapTerminalContextMenu();
});
