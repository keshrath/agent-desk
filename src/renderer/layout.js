// =============================================================================
// Agent Desk — Dockview Layout (panel/group management, tiling, splits)
// =============================================================================

'use strict';

import { state, dom, DockviewComponent, registry } from './state.js';

export function initDockview() {
  const container = dom.terminalViews;
  if (!container || !DockviewComponent) return;

  const activeTheme = typeof getThemeById === 'function' ? getThemeById(getSetting('themeId')) : null;
  const isDark = activeTheme ? (activeTheme.type || 'dark') === 'dark' : true;
  container.classList.add(isDark ? 'dockview-theme-dark' : 'dockview-theme-light');

  state.dockview = new DockviewComponent(container, {
    createComponent: (_options) => {
      const el = document.createElement('div');
      el.className = 'dv-terminal-host';
      el.style.cssText = 'width:100%;height:100%;overflow:hidden;position:relative;';

      return {
        get element() {
          return el;
        },
        init(params) {
          const termId = params.params && params.params.terminalId;
          if (!termId) return;
          const ts = state.terminals.get(termId);
          if (!ts) return;

          el.appendChild(ts.container);

          ts.container.style.cssText = 'position:relative;width:100%;height:100%;display:flex;flex-direction:column;';
          ts.container.classList.add('active');

          requestAnimationFrame(() => {
            requestAnimationFrame(() => registry.fitTerminal(termId));
          });
        },
        dispose() {
          el.innerHTML = '';
        },
      };
    },
    createTabComponent: (_options) => {
      const el = document.createElement('div');
      el.className = 'dv-custom-tab';

      return {
        get element() {
          return el;
        },
        init(params) {
          el.className = 'dv-custom-tab';
          el.innerHTML = '';

          const termId = params.params && params.params.terminalId;
          const title = (params.params && params.params.title) || 'Terminal';
          const paramIcon = (params.params && params.params.icon) || (title === 'Claude' ? 'smart_toy' : 'terminal');

          const dot = document.createElement('span');
          dot.className = 'status-dot running';
          el.appendChild(dot);

          const icon = document.createElement('span');
          icon.className = 'material-symbols-outlined dv-tab-icon';
          icon.textContent = paramIcon;
          el.appendChild(icon);

          const label = document.createElement('span');
          label.className = 'dv-tab-label';
          label.textContent = title;
          el.appendChild(label);

          const closeBtn = document.createElement('span');
          closeBtn.className = 'material-symbols-outlined dv-tab-close';
          closeBtn.textContent = 'close';
          closeBtn.title = 'Close terminal';
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (termId) registry.confirmCloseTerminal(termId);
          });
          el.appendChild(closeBtn);

          // Store references for later updates
          if (termId) {
            const ts = state.terminals.get(termId);
            if (ts) {
              ts._tabLabel = label;
              ts._tabIcon = icon;
              ts._tabEl = el;
              ts._statusDot = dot;
              // _updateStatusDot is internal to terminals.js — call via ts update
            }
          }

          // Context menu on tab
          el.addEventListener('contextmenu', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            if (termId) registry.showTerminalContextMenu(ev.clientX, ev.clientY, termId);
          });

          // Double-click to rename
          label.addEventListener('dblclick', (ev) => {
            ev.stopPropagation();
            if (termId) registry.startInlineRename(termId, label);
          });
        },
      };
    },
  });

  // Track active panel
  state.dockview.onDidActivePanelChange((panel) => {
    if (panel && panel.params && panel.params.terminalId) {
      const termId = panel.params.terminalId;
      state.activeTerminalId = termId;
      const ts = state.terminals.get(termId);
      if (ts) {
        requestAnimationFrame(() => {
          registry.fitTerminal(termId);
          ts.term.focus();
        });
      }
      registry.updateStatusBar();
    }
  });

  // Refit all terminals when layout changes (resize, drag-drop, etc.)
  state.dockview.onDidLayoutChange(() => {
    requestAnimationFrame(() => registry.fitAllTerminals());
  });
}

export function _layoutDockview() {
  if (!state.dockview) return;
  const c = dom.terminalViews;
  if (c && c.offsetWidth > 0 && c.offsetHeight > 0) {
    state.dockview.layout(c.offsetWidth, c.offsetHeight);
  }
}

export function _autoTilePosition() {
  if (!state.dockview) return null;
  const panels = state.dockview.panels;
  const count = panels.length;

  if (count === 0) return null;

  if (count === 1) {
    return { referencePanel: panels[0].id, direction: 'right' };
  }

  if (count === 2) {
    return { referencePanel: panels[0].id, direction: 'below' };
  }

  if (count === 3) {
    return { referencePanel: panels[count - 1].id, direction: 'right' };
  }

  return null;
}

// Split / Tile via Dockview

export async function splitTerminalRight() {
  if (!state.activeTerminalId) return;
  await registry.createTerminal({
    splitDirection: 'right',
    referenceTerminalId: state.activeTerminalId,
  });
}

export async function splitTerminalDown() {
  if (!state.activeTerminalId) return;
  await registry.createTerminal({
    splitDirection: 'below',
    referenceTerminalId: state.activeTerminalId,
  });
}

export function toggleMaximize() {
  if (!state.dockview || !state.activeTerminalId) return;
  const ts = state.terminals.get(state.activeTerminalId);
  if (!ts) return;

  try {
    const panel = state.dockview.getGroupPanel(ts.panelId);
    if (!panel || !panel.group) return;

    if (state.maximizedGroup) {
      state.dockview.exitMaximizedGroup();
      state.maximizedGroup = null;
    } else {
      state.dockview.maximizeGroup(panel.group);
      state.maximizedGroup = panel.group;
    }

    requestAnimationFrame(() => registry.fitAllTerminals());
  } catch (_e) {
    /* ignore */
  }
}

export function reorderTerminals() {
  if (!state.dockview) return;
  const termIds = [...state.terminalOrder].filter((id) => state.terminals.has(id));
  if (termIds.length === 0) return;

  const panels = state.dockview.panels.map((p) => p.id);
  panels.forEach((pid) => {
    try {
      state.dockview.removePanel(state.dockview.getGroupPanel(pid));
    } catch (_e) {
      /* */
    }
  });

  const count = termIds.length;
  const cols = count <= 2 ? count : count <= 4 ? 2 : 3;

  termIds.forEach((termId, i) => {
    const ts = state.terminals.get(termId);
    if (!ts) return;

    state._panelCounter++;
    const panelId = `panel-${state._panelCounter}`;
    ts.panelId = panelId;

    const addOpts = {
      id: panelId,
      component: 'terminal',
      tabComponent: 'terminal-tab',
      title: ts.title,
      params: { terminalId: termId, title: ts.title },
    };

    if (i > 0) {
      const col = i % cols;
      const prevInRow = i - 1;
      const aboveIdx = i - cols;

      if (col === 0 && aboveIdx >= 0) {
        const aboveTs = state.terminals.get(termIds[aboveIdx]);
        if (aboveTs) addOpts.position = { referencePanel: aboveTs.panelId, direction: 'below' };
      } else if (col > 0) {
        const leftTs = state.terminals.get(termIds[prevInRow]);
        if (leftTs) addOpts.position = { referencePanel: leftTs.panelId, direction: 'right' };
      }
    }

    state.dockview.addPanel(addOpts);
  });

  requestAnimationFrame(() => {
    _layoutDockview();
    registry.fitAllTerminals();
  });
}

registry.initDockview = initDockview;
registry._layoutDockview = _layoutDockview;
registry._autoTilePosition = _autoTilePosition;
registry.splitTerminalRight = splitTerminalRight;
registry.splitTerminalDown = splitTerminalDown;
registry.toggleMaximize = toggleMaximize;
registry.reorderTerminals = reorderTerminals;
