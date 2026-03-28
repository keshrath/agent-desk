// =============================================================================
// Agent Desk — Terminal Creation, Lifecycle, Status Detection, Buffer Mgmt
// =============================================================================

'use strict';

import {
  Terminal,
  FitAddon,
  WebglAddon,
  SearchAddon,
  WebLinksAddon,
  state,
  dom,
  stripAnsi,
  getTermTheme,
  getTermFontWeight,
  termOptions,
  registry,
} from './state.js';

// ---------------------------------------------------------------------------
// Task Badge Polling
// ---------------------------------------------------------------------------

let _taskBadgeTimer = null;

function _startTaskBadgePolling() {
  if (_taskBadgeTimer) return;
  _taskBadgeTimer = setInterval(() => {
    if (registry.pollTasksForBadges) {
      registry.pollTasksForBadges().then(() => _refreshTaskBadges());
    }
  }, 10000);
}

function _refreshTaskBadges() {
  if (!registry.findTaskForAgent) return;
  for (const [, ts] of state.terminals) {
    if (!ts._tabEl) continue;
    const agentInfo = typeof agentParser !== 'undefined' ? agentParser.getInfo(ts.id) : null;
    if (!agentInfo || !agentInfo.isAgent) continue;
    const agentName = agentInfo.agentName || ts.title;
    const task = registry.findTaskForAgent(agentName);

    let taskBadge = ts._tabEl.querySelector('.tab-task-badge');
    if (task) {
      if (!taskBadge) {
        taskBadge = document.createElement('span');
        taskBadge.className = 'tab-task-badge';
        const label = ts._tabEl.querySelector('.dv-tab-label');
        if (label) label.after(taskBadge);
      }
      taskBadge.textContent = '[T' + task.id + ']';
      taskBadge.title = task.title || '';
      taskBadge.onclick = (e) => {
        e.stopPropagation();
        registry.switchView('tasks');
      };
    } else if (taskBadge) {
      taskBadge.remove();
    }
  }
}

_startTaskBadgePolling();

// Status Detection

const IDLE_TIMEOUT = 5000;

const WAITING_PATTERNS = [
  /\?\s*$/, // ends with ?
  /\[Y\/n\]/i, // Y/n prompt
  /\[y\/N\]/i, // y/N prompt
  /Allow\?/i, // permission prompt
  /Approve\?/i, // approve prompt
  /Continue\?/i, // continue prompt
  /Press.*to continue/i, // press key prompts
  /Password:/i, // password prompt
  /\(yes\/no\)/i, // yes/no prompt
  /^>\s*$/, // Claude Code input prompt (just "> " on its own line)
  /❯\s*$/, // fancy prompt
  /❯\s+\d+\./, // Claude selection prompt
  /Enter to confirm/i, // Claude Code confirmation
  /Esc to cancel/i, // Claude Code cancel prompt
  /\d+\.\s+Yes,/i, // Claude Code trust prompt
  /\d+\.\s+No,/i, // Claude Code trust prompt
  /trust this/i, // "I trust this folder"
  /Do you want to/i, // generic confirmation
  /\(y\)es/i, // (y)es / (n)o prompt
  /approve|deny|reject/i, // permission prompts
];

const IDLE_PATTERNS = [
  /\$$/, // shell prompt (trimmed)
  /[A-Z]:\\[^>]*>$/, // Windows cmd prompt
  /PS [A-Z]:\\.*>$/, // PowerShell prompt
  /#$/, // root prompt (trimmed)
];

const WORKING_PATTERNS = [
  /Honking/i, // Claude Code thinking indicator
  /Thinking/i, // thinking
  /Running/i, // running agents
  /agents?\.\.\./i, // "Running 3 agents..."
  /\u280[0-9a-f]/, // braille spinner characters
  /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/, // spinner frames
  /\.\.\.$/, // trailing ellipsis (loading)
];

function _updateStatusDot(ts) {
  if (!ts._statusDot) return;
  const dot = ts._statusDot;
  dot.className = 'status-dot';
  if (ts.status === 'exited') {
    dot.classList.add(ts._exitCode === 0 ? 'exited-ok' : 'exited');
  } else {
    dot.classList.add(ts.status);
  }
  if (ts._tabEl) {
    let badge = ts._tabEl.querySelector('.tab-status-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'tab-status-badge';
      const label = ts._tabEl.querySelector('.dv-tab-label');
      if (label) label.after(badge);
    }
    const agentInfo = agentParser.getInfo(ts.id);
    let badgeText;
    if (agentInfo && agentInfo.isAgent && ts.status === 'running' && agentInfo.lastTool) {
      const toolArg = agentInfo.lastToolFile ? ' ' + agentInfo.lastToolFile.split('/').pop() : '';
      badgeText = '\u25CF ' + agentInfo.lastTool + toolArg;
    } else {
      const labels = {
        running: '\u25CF working',
        waiting: '\u25C9 input needed',
        idle: '\u25CB idle',
        exited: ts._exitCode === 0 ? '\u2713 finished' : '\u2717 failed',
      };
      badgeText = labels[ts.status] || '';
    }
    const cls = ts.status === 'exited' ? (ts._exitCode === 0 ? 'exited-ok' : 'exited') : ts.status;
    badge.textContent = badgeText;
    badge.className = 'tab-status-badge ' + cls;

    let tooltip = '';
    if (agentInfo && agentInfo.recentTools.length > 0) {
      tooltip = agentInfo.recentTools
        .slice(-3)
        .map((t) => t.tool + (t.arg ? '(' + t.arg.slice(0, 40) + ')' : ''))
        .join('\n');
    }
    if (registry.enrichTabTooltip) {
      ts._tabEl.title = registry.enrichTabTooltip(ts.id, tooltip);
    } else {
      ts._tabEl.title = tooltip;
    }
  }

  if (registry.updateTabLifecycleButtons) {
    registry.updateTabLifecycleButtons(ts.id);
  }
}

function _detectStatus(ts) {
  const cleaned = stripAnsi(ts._lastLineBuffer || '');
  const lines = cleaned.split(/\r?\n/);
  const lastLine = lines[lines.length - 1].trim() || (lines.length > 1 ? lines[lines.length - 2].trim() : '');
  const recentLines = lines
    .slice(-6)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const pattern of WAITING_PATTERNS) {
    if (pattern.test(lastLine) || recentLines.some((l) => pattern.test(l))) {
      return 'waiting';
    }
  }

  for (const pattern of IDLE_PATTERNS) {
    if (pattern.test(lastLine)) return 'idle';
  }

  for (const pattern of WORKING_PATTERNS) {
    if (pattern.test(lastLine)) return 'running';
  }

  return 'running';
}

function _handleTerminalOutputStatus(ts, data) {
  if (ts.status === 'exited') return;

  ts.lastOutputTime = Date.now();

  if (ts._idleTimer) {
    clearTimeout(ts._idleTimer);
    ts._idleTimer = null;
  }

  ts._lastLineBuffer = (ts._lastLineBuffer || '') + data;
  if (ts._lastLineBuffer.length > 500) {
    ts._lastLineBuffer = ts._lastLineBuffer.slice(-500);
  }

  if (ts._statusDebounce) clearTimeout(ts._statusDebounce);
  ts._statusDebounce = setTimeout(() => {
    if (ts.status === 'exited') return;
    const newStatus = _detectStatus(ts);
    const prevStatus = ts.status;
    ts.status = newStatus;

    if (newStatus === 'running') {
      ts._idleTimer = setTimeout(() => {
        if (ts.status === 'exited') return;
        const idleStatus = _detectStatus(ts);
        ts.status = idleStatus === 'running' ? 'idle' : idleStatus;
        _updateStatusDot(ts);
        _updateSidebarBadge();
        registry.updateStatusBar();
      }, IDLE_TIMEOUT);
    }

    if (ts.status !== prevStatus) {
      _updateStatusDot(ts);
      _updateSidebarBadge();
      registry.updateStatusBar();

      eventBus.emit('terminal:status', {
        terminalId: ts.id,
        title: ts.title,
        status: newStatus,
        prevStatus,
      });

      if (newStatus === 'idle') {
        registry.checkChainTrigger(ts.id, 'idle');
      }

      if (newStatus === 'waiting' && (state.activeTerminalId !== ts.id || !document.hasFocus())) {
        agentDesk.window.flashFrame();
        if (getSetting('desktopNotifications') !== false && !document.hasFocus()) {
          agentDesk.notify('Input Needed', `${ts.title} is waiting for input`);
        }
      }
    }
  }, 150);
}

export function _updateSidebarBadge() {
  const btn = document.querySelector('.nav-btn[data-view="terminals"]');
  if (!btn) return;

  const statuses = [...state.terminals.values()].map((t) => t.status);
  const waitingCount = statuses.filter((s) => s === 'waiting').length;
  const allInactive = statuses.length > 0 && statuses.every((s) => s === 'idle' || s === 'exited');

  btn.classList.toggle('terminals-dimmed', allInactive);

  let badge = btn.querySelector('.status-badge');
  if (waitingCount > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'status-badge';
      btn.appendChild(badge);
    }
    badge.textContent = String(waitingCount);
  } else if (badge) {
    badge.remove();
  }
}

// Terminal building

export function _resolveTermFont() {
  const f = getSetting('fontFamily') || 'JetBrains Mono';
  if (f.includes('monospace')) return f;
  return `'${f.replace(/'/g, '')}', monospace`;
}

function _buildTerminalInstance(id, title) {
  const settingsOverrides = {
    theme: getTermTheme(),
    fontSize: parseInt(getSetting('fontSize')) || termOptions.fontSize,
    fontFamily: _resolveTermFont(),
    cursorStyle: getSetting('cursorStyle') || termOptions.cursorStyle,
    cursorBlink: getSetting('cursorBlink') !== false,
    lineHeight: parseFloat(getSetting('lineHeight')) || termOptions.lineHeight,
    scrollback: parseInt(getSetting('scrollback')) || termOptions.scrollback,
    fontWeight: getTermFontWeight(),
  };
  const term = new Terminal({ ...termOptions, ...settingsOverrides });
  const fitAddon = new FitAddon();
  const searchAddon = SearchAddon ? new SearchAddon() : null;

  term.loadAddon(fitAddon);
  if (searchAddon) term.loadAddon(searchAddon);

  const container = document.createElement('div');
  container.className = 'terminal-container';
  container.id = `terminal-${id}`;

  term.open(container);

  try {
    const isDarkThemeForWebgl = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDarkThemeForWebgl && WebglAddon) {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      term.loadAddon(webglAddon);
    }
  } catch (_err) {
    /* canvas fallback */
  }

  if (WebLinksAddon) {
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      event.preventDefault();
      agentDesk.openExternal(uri);
    });
    term.loadAddon(webLinksAddon);
  }

  state._panelCounter++;
  const panelId = `panel-${state._panelCounter}`;

  const termState = {
    id,
    term,
    fitAddon,
    searchAddon,
    container,
    title,
    status: 'running',
    panelId,
    _tabLabel: null,
    _tabIcon: null,
    _tabEl: null,
    _statusDot: null,
    _idleTimer: null,
    _exitCode: null,
    _lastLineBuffer: '',
    _profileIcon: null,
    lastOutputTime: Date.now(),
    createdAt: new Date().toISOString(),
  };
  state.terminals.set(id, termState);
  state.terminalOrder.push(id);

  agentDesk.terminal.subscribe(id);

  term.onTitleChange((newTitle) => {
    if (newTitle && !termState.manualTitle) renameTerminal(id, newTitle);
  });

  term.onData((data) => {
    if (termState.status !== 'exited') agentDesk.terminal.write(id, data);
  });

  // Bell handler
  term.onBell(() => {
    if (getSetting('bellVisual') !== false && termState._tabEl) {
      termState._tabEl.classList.add('bell-flash');
      setTimeout(() => termState._tabEl.classList.remove('bell-flash'), 500);
    }
    if (state.activeTerminalId !== id || !document.hasFocus()) {
      agentDesk.window.flashFrame();
    }
    if (getSetting('desktopNotifications') !== false && !document.hasFocus()) {
      agentDesk.notify('Terminal Bell', `${termState.title} needs attention`);
    }
  });

  // Copy/Paste support + search
  term.attachCustomKeyEventHandler((e) => {
    // Ctrl+F: let the document handler open the search bar
    if (e.ctrlKey && (e.key === 'f' || e.key === 'F') && !e.shiftKey && e.type === 'keydown') {
      return false;
    }
    if (e.ctrlKey && e.key === 'c' && e.type === 'keydown') {
      const sel = term.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel);
        term.clearSelection();
        registry.showToast('Copied to clipboard');
        return false;
      }
    }
    if (e.ctrlKey && (e.key === 'v' || e.key === 'V') && e.type === 'keydown') {
      navigator.clipboard.readText().then((text) => {
        if (text && termState.status !== 'exited') term.paste(text);
      });
      return false;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'C' && e.type === 'keydown') {
      const sel = term.getSelection();
      if (sel) navigator.clipboard.writeText(sel);
      return false;
    }
    return true;
  });

  // Right-click context menu
  container.addEventListener('contextmenu', (e) => {
    const sel = term.getSelection();
    if (sel) {
      e.preventDefault();
      registry.showContextMenu(e.clientX, e.clientY, [
        {
          label: 'Copy',
          icon: 'content_copy',
          action: () => {
            navigator.clipboard.writeText(sel);
            term.clearSelection();
          },
        },
        {
          label: 'Paste',
          icon: 'content_paste',
          action: () => {
            navigator.clipboard.readText().then((text) => {
              if (text && termState.status !== 'exited') agentDesk.terminal.write(id, text);
            });
          },
        },
      ]);
    } else {
      e.preventDefault();
      registry.showContextMenu(e.clientX, e.clientY, [
        {
          label: 'Paste',
          icon: 'content_paste',
          action: () => {
            navigator.clipboard.readText().then((text) => {
              if (text && termState.status !== 'exited') {
                agentDesk.terminal.write(id, text);
                term.focus();
              }
            });
          },
        },
      ]);
    }
  });

  // Focus tracking
  container.addEventListener('mousedown', () => {
    if (state.activeTerminalId !== id) {
      state.activeTerminalId = id;
      term.focus();
      registry.updateStatusBar();
    }
  });

  // ResizeObserver for terminal fitting
  let _resizeDebounce = null;
  const resizeObserver = new ResizeObserver(() => {
    if (_resizeDebounce) clearTimeout(_resizeDebounce);
    _resizeDebounce = setTimeout(() => fitTerminal(id), 80);
  });
  resizeObserver.observe(container);
  termState.resizeObserver = resizeObserver;

  return { termState, panelId };
}

export async function reconnectTerminal(liveInfo) {
  try {
    const id = liveInfo.id;
    const command = liveInfo.command || 'shell';
    const title = liveInfo.title || (command === 'claude' ? 'Claude' : command);

    const { termState, panelId } = _buildTerminalInstance(id, title);

    if (state.dockview) {
      const addOpts = {
        id: panelId,
        component: 'terminal',
        tabComponent: 'terminal-tab',
        title,
        params: { terminalId: id, title },
      };
      const pos = registry._autoTilePosition();
      if (pos) addOpts.position = pos;
      state.dockview.addPanel(addOpts);
    }

    try {
      const buffer = await agentDesk.session.getBuffer(id);
      if (buffer) termState.term.write(buffer);
    } catch (_e) {
      /* no buffer */
    }

    return id;
  } catch (err) {
    console.error('Failed to reconnect terminal:', err);
    return null;
  }
}

export async function createTerminal(opts = {}) {
  try {
    const createOpts = {
      cols: 120,
      rows: 30,
      cwd: opts.cwd || getSetting('defaultTerminalCwd') || undefined,
      command: opts.command,
      args: opts.args,
      env: opts.env || undefined,
    };

    const ptyInfo = await agentDesk.terminal.create(createOpts);
    const id = ptyInfo.id;

    const defaultCommand = getSetting('defaultNewTerminalCommand') || getSetting('defaultShell') || 'claude';
    const command = opts.command || ptyInfo.command || defaultCommand;
    const COMMAND_LABELS = { claude: 'Claude', opencode: 'OpenCode' };
    const COMMAND_ICONS = { claude: 'smart_toy', opencode: 'code' };
    const title = opts.title || COMMAND_LABELS[command] || command;
    const tabIcon = opts.icon || COMMAND_ICONS[command] || 'terminal';

    const { termState, panelId } = _buildTerminalInstance(id, title);
    termState._profileIcon = opts.icon || null;
    termState._command = opts.command || ptyInfo.command || '';
    termState._args = opts.args || ptyInfo.args || [];
    termState._cwd = opts.cwd || ptyInfo.cwd || '';
    termState._profileName = opts.profileName || '';

    if (state.dockview) {
      const addOpts = {
        id: panelId,
        component: 'terminal',
        tabComponent: 'terminal-tab',
        title: title,
        params: { terminalId: id, title: title, icon: tabIcon },
      };

      if (opts.splitDirection && opts.referenceTerminalId) {
        const refTs = state.terminals.get(opts.referenceTerminalId);
        if (refTs) {
          addOpts.position = {
            referencePanel: refTs.panelId,
            direction: opts.splitDirection,
          };
        }
      } else if (opts.addAsTab && opts.referenceTerminalId) {
        const refTs = state.terminals.get(opts.referenceTerminalId);
        if (refTs) {
          addOpts.position = {
            referencePanel: refTs.panelId,
            direction: 'within',
          };
        }
      } else {
        const pos = registry._autoTilePosition();
        if (pos) addOpts.position = pos;
      }

      if (opts.noActivate) {
        addOpts.inactive = true;
      }

      state.dockview.addPanel(addOpts);
    }

    if (command === 'claude') {
      agentParser.markAsAgent(id, null);
    }

    if (!opts.noActivate) {
      if (state.activeView !== 'terminals') {
        registry.switchView('terminals');
      }
      state.activeTerminalId = id;
      requestAnimationFrame(() => {
        fitTerminal(id);
        termState.term.focus();
      });
    }

    eventBus.emit('terminal:created', {
      terminalId: id,
      title,
      command,
    });

    _updateEmptyState();
    registry.updateStatusBar();
    return id;
  } catch (err) {
    console.error('Failed to create terminal:', err);
    return null;
  }
}

export function fitTerminal(id) {
  const ts = state.terminals.get(id);
  if (!ts) return;

  try {
    const rect = ts.container.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return;

    ts.fitAddon.fit();
    const dims = ts.fitAddon.proposeDimensions();
    if (dims && dims.cols > 1 && dims.rows > 1) {
      agentDesk.terminal.resize(id, dims.cols, dims.rows);
    }
  } catch (_err) {
    /* empty */
  }
}

let _fitAllDebounce = null;
export function fitAllTerminals() {
  if (_fitAllDebounce) clearTimeout(_fitAllDebounce);
  _fitAllDebounce = setTimeout(() => {
    for (const [id] of state.terminals) {
      fitTerminal(id);
    }
  }, 50);
}

export function closeTerminal(id) {
  const ts = state.terminals.get(id);
  if (!ts) return;

  if (ts._idleTimer) {
    clearTimeout(ts._idleTimer);
    ts._idleTimer = null;
  }

  agentDesk.terminal.unsubscribe(id);
  agentDesk.terminal.kill(id);
  registry.cleanupTerminalChains(id);
  agentParser.cleanup(id);
  if (typeof ShellIntegration !== 'undefined') ShellIntegration.cleanup(id);

  if (ts.resizeObserver) {
    ts.resizeObserver.disconnect();
  }
  ts.term.dispose();
  ts.container.remove();

  if (state.dockview && ts.panelId) {
    try {
      const panel = state.dockview.getGroupPanel(ts.panelId);
      if (panel) {
        panel.api.close();
      }
    } catch (_e) {
      /* panel may already be gone */
    }
  }

  state.terminals.delete(id);
  const idx = state.terminalOrder.indexOf(id);
  if (idx !== -1) state.terminalOrder.splice(idx, 1);

  if (state.activeTerminalId === id) {
    state.activeTerminalId = null;
    if (state.terminalOrder.length > 0) {
      const newIdx = Math.min(idx, state.terminalOrder.length - 1);
      const nextId = state.terminalOrder[newIdx];
      state.activeTerminalId = nextId;
      const nextTs = state.terminals.get(nextId);
      if (nextTs) {
        requestAnimationFrame(() => {
          fitTerminal(nextId);
          nextTs.term.focus();
        });
      }
    }
  }

  _updateSidebarBadge();
  _updateEmptyState();
  registry.updateStatusBar();
}

// BUG FIX: Ctrl+W now shows confirmation for running terminals instead of silently failing
export function confirmCloseTerminal(id) {
  const ts = state.terminals.get(id);
  if (!ts) return;
  if (ts.status === 'running' || ts.status === 'waiting') {
    registry.showConfirmDialog(
      `Close "${ts.title}"?`,
      'This terminal has a running process. The process will be killed.',
      () => closeTerminal(id),
    );
  } else {
    closeTerminal(id);
  }
}

function _updateEmptyState() {
  const container = dom.terminalViews;
  if (!container) return;

  let emptyEl = container.querySelector('.empty-state');
  if (state.terminals.size === 0) {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'empty-state';

      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined empty-icon';
      icon.textContent = 'terminal';
      emptyEl.appendChild(icon);

      const text = document.createElement('div');
      text.className = 'empty-text';
      text.textContent = 'No terminals open.';
      emptyEl.appendChild(text);

      const btnRow = document.createElement('div');
      btnRow.className = 'empty-state-buttons';

      const btnTerminal = document.createElement('button');
      btnTerminal.className = 'empty-state-btn';
      btnTerminal.innerHTML = '<span class="material-symbols-outlined">terminal</span> New Terminal';
      btnTerminal.addEventListener('click', () => {
        if (registry.createDefaultTerminal) registry.createDefaultTerminal();
        else if (registry.createTerminal) registry.createTerminal({});
      });
      btnRow.appendChild(btnTerminal);

      const btnClaude = document.createElement('button');
      btnClaude.className = 'empty-state-btn empty-state-btn-accent';
      btnClaude.innerHTML = '<span class="material-symbols-outlined">smart_toy</span> Claude';
      btnClaude.addEventListener('click', () => {
        if (registry.createClaudeTerminal) registry.createClaudeTerminal();
        else if (registry.createTerminal) registry.createTerminal({ command: 'claude' });
      });
      btnRow.appendChild(btnClaude);

      const btnOpenCode = document.createElement('button');
      btnOpenCode.className = 'empty-state-btn';
      btnOpenCode.innerHTML = '<span class="material-symbols-outlined">code</span> OpenCode';
      btnOpenCode.addEventListener('click', () => {
        registry.createTerminal({ command: 'opencode' });
      });
      btnRow.appendChild(btnOpenCode);

      emptyEl.appendChild(btnRow);

      const hint = document.createElement('div');
      hint.className = 'empty-text-hint';
      hint.innerHTML =
        '<kbd>Ctrl+Shift+T</kbd> terminal &nbsp;·&nbsp; <kbd>Ctrl+Shift+C</kbd> Claude &nbsp;·&nbsp; <kbd>Ctrl+Shift+B</kbd> batch launch';
      emptyEl.appendChild(hint);

      container.appendChild(emptyEl);
    }
  } else if (emptyEl) {
    emptyEl.remove();
  }
}

export function renameTerminal(id, newTitle, manual = false) {
  const ts = state.terminals.get(id);
  if (!ts) return;
  if (manual) ts.manualTitle = true;
  if (ts.manualTitle && !manual) return;
  ts.title = newTitle;
  if (ts._tabLabel) ts._tabLabel.textContent = newTitle;
  if (ts._tabIcon && !ts._profileIcon) ts._tabIcon.textContent = newTitle === 'Claude' ? 'smart_toy' : 'terminal';

  if (state.dockview && ts.panelId) {
    try {
      const panel = state.dockview.getGroupPanel(ts.panelId);
      if (panel) {
        panel.api.updateParameters({ title: newTitle, terminalId: id });
        panel.api.setTitle(newTitle);
      }
    } catch (_e) {
      /* ignore */
    }
  }
}

export function startInlineRename(id, labelEl) {
  const ts = state.terminals.get(id);
  if (!ts) return;

  const input = document.createElement('input');
  input.className = 'dv-tab-rename-input';
  input.type = 'text';
  input.value = ts.title;

  const finishRename = () => {
    const newTitle = input.value.trim() || ts.title;
    renameTerminal(id, newTitle, true);
    if (input.parentNode) {
      input.parentNode.replaceChild(labelEl, input);
    }
  };

  input.addEventListener('blur', finishRename);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = ts.title;
      input.blur();
    }
  });

  labelEl.parentNode.replaceChild(input, labelEl);
  input.focus();
  input.select();
}

// Terminal Output Export

export function getTerminalBufferText(id) {
  const ts = state.terminals.get(id);
  if (!ts) return '';
  const buffer = ts.term.buffer.active;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (line) output += line.translateToString(true) + '\n';
  }
  return output;
}

export async function saveTerminalOutput(id) {
  const ts = state.terminals.get(id);
  if (!ts) return;

  const output = getTerminalBufferText(id);
  const defaultName = ts.title.replace(/[^a-zA-Z0-9-_]/g, '_') + '.log';
  const filePath = await agentDesk.dialog.saveFile({
    defaultPath: defaultName,
    filters: [
      { name: 'Log Files', extensions: ['log'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (filePath) {
    await agentDesk.file.write(filePath, output);
  }
}

export function copyAllTerminalOutput(id) {
  const output = getTerminalBufferText(id);
  navigator.clipboard.writeText(output);
  registry.showToast('Output copied to clipboard');
}

export function popOutTerminal(id) {
  const ts = state.terminals.get(id);
  if (!ts) return;
  agentDesk.terminal.popout({ terminalId: id, title: ts.title });
}

// Data Flow — PTY Output & Exit

export function setupDataHandlers() {
  state._cleanupOnData = agentDesk.terminal.onData((id, data) => {
    const ts = state.terminals.get(id);
    if (ts) {
      ts.term.write(data);
      _handleTerminalOutputStatus(ts, data);
      agentParser.parse(id, data);
      if (typeof ShellIntegration !== 'undefined') {
        const lineCount = ts.term.buffer ? ts.term.buffer.active.cursorY + ts.term.buffer.active.baseY : 0;
        const events = ShellIntegration.processData(id, data, lineCount);
        for (const evt of events) {
          if (evt.type === 'cwd' || evt.type === 'command-end') registry.updateStatusBar();
        }
      }
    }
  });

  state._cleanupOnExit = agentDesk.terminal.onExit((id, exitCode) => {
    const ts = state.terminals.get(id);
    if (!ts) return;

    if (ts._idleTimer) {
      clearTimeout(ts._idleTimer);
      ts._idleTimer = null;
    }

    ts.status = 'exited';
    ts._exitCode = exitCode;
    if (ts._tabEl) ts._tabEl.classList.add('exited');
    _updateStatusDot(ts);

    const exitMsg =
      exitCode === 0
        ? '\r\n\x1b[90m[Process exited]\x1b[0m\r\n'
        : `\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`;
    ts.term.write(exitMsg);

    eventBus.emit('terminal:exited', {
      terminalId: id,
      title: ts.title,
      exitCode,
    });

    // Auto-close terminals that exited quickly (< 10s uptime) — likely a startup failure
    if (ts.createdAt) {
      const uptime = Date.now() - new Date(ts.createdAt).getTime();
      if (uptime < 10000) {
        setTimeout(() => {
          if (state.terminals.has(id) && state.terminals.get(id).status === 'exited') {
            closeTerminal(id);
          }
        }, 3000);
      }
    }

    if (exitCode === 0) {
      registry.checkChainTrigger(id, 'exit-0');
    }
    registry.checkChainTrigger(id, 'exit-any');

    _updateSidebarBadge();
    registry.updateStatusBar();
  });
}

// Terminal cycling & activation

export function switchToTerminal(id) {
  if (state.activeView !== 'terminals') registry.switchView('terminals');
  _activateTerminalById(id);
}

export function _activateTerminalById(id) {
  const ts = state.terminals.get(id);
  if (!ts) return;

  state.activeTerminalId = id;

  if (state.dockview && ts.panelId) {
    try {
      const panel = state.dockview.getGroupPanel(ts.panelId);
      if (panel) panel.api.setActive();
    } catch (_e) {
      /* ignore */
    }
  }

  requestAnimationFrame(() => {
    fitTerminal(id);
    ts.term.focus();
  });

  registry.updateStatusBar();
}

export function _cycleNextTerminal() {
  if (state.terminalOrder.length < 2) return;
  const idx = state.terminalOrder.indexOf(state.activeTerminalId);
  const nextIdx = (idx + 1) % state.terminalOrder.length;
  _activateTerminalById(state.terminalOrder[nextIdx]);
}

export function _cyclePrevTerminal() {
  if (state.terminalOrder.length < 2) return;
  const idx = state.terminalOrder.indexOf(state.activeTerminalId);
  const prevIdx = (idx - 1 + state.terminalOrder.length) % state.terminalOrder.length;
  _activateTerminalById(state.terminalOrder[prevIdx]);
}

export function _focusDirection(direction) {
  if (!state.activeTerminalId) return;
  const activeTs = state.terminals.get(state.activeTerminalId);
  if (!activeTs) return;

  const activeRect = activeTs.container.getBoundingClientRect();
  const acx = activeRect.left + activeRect.width / 2;
  const acy = activeRect.top + activeRect.height / 2;

  let bestId = null;
  let bestDist = Infinity;

  for (const [id, ts] of state.terminals) {
    if (id === state.activeTerminalId) continue;
    if (!ts.container.offsetParent) continue;

    const rect = ts.container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let valid = false;
    if (direction === 'left' && cx < acx) valid = true;
    if (direction === 'right' && cx > acx) valid = true;
    if (direction === 'up' && cy < acy) valid = true;
    if (direction === 'down' && cy > acy) valid = true;

    if (valid) {
      const dist = Math.abs(cx - acx) + Math.abs(cy - acy);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = id;
      }
    }
  }

  if (bestId) _activateTerminalById(bestId);
}

// Close idle
export function closeIdleTerminals() {
  const toClose = [];
  for (const [id, ts] of state.terminals) {
    if (ts.status === 'idle' || ts.status === 'exited') {
      toClose.push(id);
    }
  }
  toClose.forEach((id) => closeTerminal(id));
}

// Profiles
export function createTerminalFromProfile(profile) {
  const opts = {};
  if (profile.command) opts.command = profile.command;
  if (profile.args && profile.args.length > 0) opts.args = profile.args;
  if (profile.cwd) opts.cwd = profile.cwd;
  if (profile.icon) opts.icon = profile.icon;
  if (profile.name) opts.title = profile.name;
  if (profile.name) opts.profileName = profile.name;
  if (profile.env && Object.keys(profile.env).length > 0) opts.env = profile.env;
  return createTerminal(opts);
}

// Register everything
registry.createTerminal = createTerminal;
registry.closeTerminal = closeTerminal;
registry.confirmCloseTerminal = confirmCloseTerminal;
registry.fitTerminal = fitTerminal;
registry.fitAllTerminals = fitAllTerminals;
registry.renameTerminal = renameTerminal;
registry.startInlineRename = startInlineRename;
registry.getTerminalBufferText = getTerminalBufferText;
registry.saveTerminalOutput = saveTerminalOutput;
registry.copyAllTerminalOutput = copyAllTerminalOutput;
registry.popOutTerminal = popOutTerminal;
registry.reconnectTerminal = reconnectTerminal;
registry.setupDataHandlers = setupDataHandlers;
registry.switchToTerminal = switchToTerminal;
registry._activateTerminalById = _activateTerminalById;
registry._cycleNextTerminal = _cycleNextTerminal;
registry._cyclePrevTerminal = _cyclePrevTerminal;
registry._focusDirection = _focusDirection;
registry.closeIdleTerminals = closeIdleTerminals;
export async function handleTerminalRestart(oldId, newInfo) {
  const oldTs = state.terminals.get(oldId);
  if (!oldTs) return;

  const oldTitle = oldTs.title;
  closeTerminal(oldId);

  const newId = await createTerminal({
    command: newInfo.command,
    args: newInfo.args,
    cwd: newInfo.cwd,
    title: oldTitle,
  });
  return newId;
}

export function updateTabLifecycleButtons(terminalId) {
  const ts = state.terminals.get(terminalId);
  if (!ts || !ts._tabEl) return;

  let stopBtn = ts._tabEl.querySelector('.lifecycle-tab-stop');
  let restartBtn = ts._tabEl.querySelector('.lifecycle-tab-restart');

  const agentInfo = typeof agentParser !== 'undefined' ? agentParser.getInfo(terminalId) : null;
  const isAgent = agentInfo && agentInfo.isAgent;

  if (!isAgent) {
    if (stopBtn) stopBtn.remove();
    if (restartBtn) restartBtn.remove();
    return;
  }

  if (ts.status === 'running' || ts.status === 'waiting') {
    if (restartBtn) restartBtn.remove();
    if (!stopBtn) {
      stopBtn = document.createElement('span');
      stopBtn.className = 'material-symbols-outlined lifecycle-tab-stop';
      stopBtn.textContent = 'stop';
      stopBtn.title = 'Stop agent';
      stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        agentDesk.terminal.signal(terminalId, 'SIGINT');
      });
      const closeBtn = ts._tabEl.querySelector('.dv-tab-close');
      if (closeBtn) {
        ts._tabEl.insertBefore(stopBtn, closeBtn);
      } else {
        ts._tabEl.appendChild(stopBtn);
      }
    }
  } else if (ts.status === 'exited') {
    if (stopBtn) stopBtn.remove();
    if (!restartBtn) {
      restartBtn = document.createElement('span');
      restartBtn.className = 'material-symbols-outlined lifecycle-tab-restart';
      restartBtn.textContent = 'restart_alt';
      restartBtn.title = 'Restart agent';
      restartBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const result = await agentDesk.terminal.restart(terminalId);
        if (result) handleTerminalRestart(terminalId, result);
      });
      const closeBtn = ts._tabEl.querySelector('.dv-tab-close');
      if (closeBtn) {
        ts._tabEl.insertBefore(restartBtn, closeBtn);
      } else {
        ts._tabEl.appendChild(restartBtn);
      }
    }
  } else {
    if (stopBtn) stopBtn.remove();
    if (restartBtn) restartBtn.remove();
  }
}

registry.createTerminalFromProfile = createTerminalFromProfile;
registry._resolveTermFont = _resolveTermFont;
registry._updateSidebarBadge = _updateSidebarBadge;
registry.handleTerminalRestart = handleTerminalRestart;
registry.updateTabLifecycleButtons = updateTabLifecycleButtons;
