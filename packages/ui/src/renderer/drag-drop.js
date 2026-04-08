// =============================================================================
// Agent Desk — Drag-Drop Handlers
// =============================================================================

'use strict';

import { state, registry } from './state.js';

function _shellEscape(filePath) {
  const isWin = navigator.platform.startsWith('Win');
  if (isWin) {
    if (/[\s&|<>^%()!]/.test(filePath)) {
      return '"' + filePath.replace(/"/g, '""') + '"';
    }
    return filePath;
  }
  if (/[^a-zA-Z0-9_./-]/.test(filePath)) {
    return "'" + filePath.replace(/'/g, "'\\''") + "'";
  }
  return filePath;
}

function _findTerminalIdAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const container = el.closest('.terminal-container');
  if (container && container.id && container.id.startsWith('terminal-')) {
    const id = container.id.replace('terminal-', '');
    if (state.terminals.has(id)) return id;
  }
  const panel = el.closest('[data-dockview-id]') || el.closest('.dv-groupview');
  if (panel) {
    const tc = panel.querySelector('.terminal-container');
    if (tc && tc.id && tc.id.startsWith('terminal-')) {
      const id = tc.id.replace('terminal-', '');
      if (state.terminals.has(id)) return id;
    }
  }
  return null;
}

function _isTabBarArea(el) {
  if (!el) return false;
  return !!(el.closest('#tab-bar') || el.closest('#tab-list'));
}

function _isSidebarArea(el) {
  if (!el) return false;
  return !!el.closest('#sidebar');
}

export function setupDragDrop() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  let dropOverlay = null;
  let dragCounter = 0;

  function createOverlay() {
    if (dropOverlay) return dropOverlay;
    dropOverlay = document.createElement('div');
    dropOverlay.className = 'drop-overlay';
    dropOverlay.innerHTML =
      '<div class="drop-overlay-content">' +
      '<span class="material-symbols-outlined drop-overlay-icon">upload_file</span>' +
      '<span class="drop-overlay-text">Drop to paste path</span>' +
      '</div>';
    document.body.appendChild(dropOverlay);
    return dropOverlay;
  }

  function showOverlay(text, targetRect) {
    const overlay = createOverlay();
    const textEl = overlay.querySelector('.drop-overlay-text');
    if (textEl) textEl.textContent = text;

    if (targetRect) {
      overlay.style.left = targetRect.left + 'px';
      overlay.style.top = targetRect.top + 'px';
      overlay.style.width = targetRect.width + 'px';
      overlay.style.height = targetRect.height + 'px';
    } else {
      overlay.style.left = '0';
      overlay.style.top = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
    }

    overlay.classList.add('visible');
  }

  function hideOverlay() {
    if (dropOverlay) {
      dropOverlay.classList.remove('visible');
    }
  }

  appEl.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      showOverlay('Drop file here', null);
    }
  });

  appEl.addEventListener('dragover', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const termId = _findTerminalIdAtPoint(e.clientX, e.clientY);

    if (termId) {
      const ts = state.terminals.get(termId);
      if (ts && ts.container) {
        const rect = ts.container.getBoundingClientRect();
        showOverlay('Drop to paste path', rect);
      }
    } else if (_isTabBarArea(target)) {
      const tabBar = document.getElementById('tab-bar');
      if (tabBar) {
        const rect = tabBar.getBoundingClientRect();
        showOverlay('Drop to open terminal here', rect);
      }
    } else if (_isSidebarArea(target)) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        const rect = sidebar.getBoundingClientRect();
        showOverlay('Drop to open terminal here', rect);
      }
    } else {
      showOverlay('Drop to open terminal here', null);
    }
  });

  appEl.addEventListener('dragleave', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      hideOverlay();
    }
  });

  appEl.addEventListener('drop', async (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    hideOverlay();

    const files = e.dataTransfer.files;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const termId = _findTerminalIdAtPoint(e.clientX, e.clientY);

    if (termId) {
      const ts = state.terminals.get(termId);
      if (ts && ts.status !== 'exited') {
        const paths = [];
        for (let i = 0; i < files.length; i++) {
          const filePath = files[i].path;
          if (filePath) paths.push(_shellEscape(filePath));
        }
        if (paths.length > 0) {
          const text = paths.join(' ') + ' ';
          agentDesk.terminal.write(termId, text);
          ts.term.focus();
          registry.showToast('Pasted ' + paths.length + ' path' + (paths.length > 1 ? 's' : ''));
        }
      }
    } else if (_isTabBarArea(target) || _isSidebarArea(target) || !termId) {
      const firstFile = files[0];
      if (firstFile && firstFile.path) {
        try {
          const stat = await agentDesk.file.stat(firstFile.path);
          const cwd = stat && stat.isDirectory ? firstFile.path : await agentDesk.file.dirname(firstFile.path);
          await registry.createTerminal({ cwd });
        } catch (_statErr) {
          await registry.createTerminal();
        }
      } else {
        await registry.createTerminal();
      }
    }
  });

  // Prevent default browser drop behavior on the window
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}

registry.setupDragDrop = setupDragDrop;
