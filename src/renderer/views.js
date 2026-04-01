// =============================================================================
// Agent Desk — Sidebar, View Switching, Theme, Settings Application
// =============================================================================

'use strict';

import { state, dom, getTermTheme, getTermFontWeight, registry } from './state.js';

// View Management

function _resyncWebviewTheme(webviewId) {
  const wv = document.getElementById(webviewId);
  if (!wv || !wv.src) return;
  const themeId = typeof getSetting === 'function' ? getSetting('themeId') : null;
  const themeObj = typeof getThemeById === 'function' ? getThemeById(themeId) : null;
  if (!themeObj || !themeObj.colors) return;
  const c = themeObj.colors;
  const baseType = themeObj.type || 'dark';
  const t = baseType === 'dark' ? 'dark' : 'light';
  const script = _buildDashboardThemeScript(t, c);
  const run = () => {
    try {
      wv.executeJavaScript(script).catch(() => {});
    } catch (_e) {
      /* webview not ready */
    }
  };
  run();
  setTimeout(run, 1000);
  setTimeout(run, 3000);
}

function _lazyLoadWebview(viewName) {
  const webviewMap = {
    comm: 'webview-comm',
    tasks: 'webview-tasks',
    knowledge: 'webview-knowledge',
    discover: 'webview-discover',
  };
  const webviewId = webviewMap[viewName];
  if (!webviewId) return;
  const wv = document.getElementById(webviewId);
  if (wv && !wv.src && wv.dataset.src) {
    wv.src = wv.dataset.src;
  }
}

export function switchView(viewName) {
  const validViews = ['terminals', 'comm', 'tasks', 'knowledge', 'discover', 'monitor', 'events', 'settings'];
  if (!validViews.includes(viewName)) return;

  state.activeView = viewName;

  dom.terminalViews?.classList.remove('active');
  dom.viewComm?.classList.remove('active');
  dom.viewTasks?.classList.remove('active');
  dom.viewKnowledge?.classList.remove('active');
  dom.viewDiscover?.classList.remove('active');
  dom.viewMonitor?.classList.remove('active');
  dom.viewEvents?.classList.remove('active');
  dom.settingsView?.classList.remove('active');
  dom.tabBar.style.display = 'none';

  if (registry.stopMonitorRefresh && viewName !== 'monitor') {
    registry.stopMonitorRefresh();
  }

  switch (viewName) {
    case 'terminals':
      dom.terminalViews.classList.add('active');
      if (state.activeTerminalId) {
        const ts = state.terminals.get(state.activeTerminalId);
        if (ts) {
          requestAnimationFrame(() => {
            registry._layoutDockview();
            registry.fitAllTerminals();
            ts.term.focus();
          });
        }
      } else {
        registry._layoutDockview();
      }
      break;
    case 'comm':
      _lazyLoadWebview('comm');
      dom.viewComm.classList.add('active');
      _resyncWebviewTheme('webview-comm');
      break;
    case 'tasks':
      _lazyLoadWebview('tasks');
      dom.viewTasks.classList.add('active');
      _resyncWebviewTheme('webview-tasks');
      break;
    case 'knowledge':
      _lazyLoadWebview('knowledge');
      if (dom.viewKnowledge) dom.viewKnowledge.classList.add('active');
      _resyncWebviewTheme('webview-knowledge');
      break;
    case 'discover':
      _lazyLoadWebview('discover');
      if (dom.viewDiscover) dom.viewDiscover.classList.add('active');
      _resyncWebviewTheme('webview-discover');
      break;
    case 'monitor':
      dom.viewMonitor.classList.add('active');
      if (registry.startMonitorRefresh) registry.startMonitorRefresh();
      break;
    case 'events':
      dom.viewEvents.classList.add('active');
      break;
    case 'settings':
      dom.settingsView.classList.add('active');
      break;
  }

  updateSidebar();
  registry.updateStatusBar();
}

export function updateSidebar() {
  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach((btn) => {
    const view = btn.dataset.view;
    btn.classList.toggle('active', view === state.activeView);
  });
}

// Settings Application

export function applySettings() {
  // Terminal options
  const fontSize = parseInt(getSetting('fontSize')) || 14;
  const fontFamily = registry._resolveTermFont();
  const cursorStyle = getSetting('cursorStyle') || 'bar';
  const cursorBlink = getSetting('cursorBlink') !== false;
  const lineHeight = parseFloat(getSetting('lineHeight')) || 1.3;
  const scrollback = parseInt(getSetting('scrollback')) || 10000;

  for (const [id, ts] of state.terminals) {
    ts.term.options.fontSize = fontSize;
    ts.term.options.fontFamily = fontFamily;
    ts.term.options.cursorStyle = cursorStyle;
    ts.term.options.cursorBlink = cursorBlink;
    ts.term.options.lineHeight = lineHeight;
    ts.term.options.scrollback = scrollback;
    registry.fitTerminal(id);
  }

  // Sidebar position
  const sidebarPos = getSetting('sidebarPosition') || 'left';
  const main = document.getElementById('main');
  if (main) {
    main.style.flexDirection = sidebarPos === 'right' ? 'row-reverse' : 'row';
  }

  // Dashboard URLs — update data-src (lazy-loaded) and src (if already loaded)
  const urlMap = {
    'webview-comm': getSetting('agentCommUrl'),
    'webview-tasks': getSetting('agentTasksUrl'),
    'webview-knowledge': getSetting('agentKnowledgeUrl'),
    'webview-discover': getSetting('agentDiscoverUrl'),
  };
  for (const [wvId, url] of Object.entries(urlMap)) {
    if (!url) continue;
    const wv = document.getElementById(wvId);
    if (!wv) continue;
    wv.dataset.src = url;
    if (wv.src && wv.src !== url) wv.src = url;
  }

  // Show/hide status bar
  const showStatusBar = getSetting('showStatusBar') !== false;
  const statusBar = document.getElementById('status-bar');
  if (statusBar) {
    statusBar.style.display = showStatusBar ? '' : 'none';
  }

  // Start on login
  const startOnLogin = getSetting('startOnLogin') === true;
  if (agentDesk.setLoginItem) agentDesk.setLoginItem(startOnLogin);

  // Tab close button mode
  const tabCloseBtn = getSetting('tabCloseButton') || 'hover';
  const termViews = document.getElementById('terminal-views');
  if (termViews) termViews.dataset.tabClose = tabCloseBtn;

  // Theme
  applyTheme(getSetting('themeId') || null);
}

export function applyTheme(themeId) {
  if (typeof setSetting === 'function' && typeof getSetting === 'function') {
    const current = getSetting('themeId');
    if (current !== themeId) {
      setSetting('themeId', themeId || null);
    }
  }

  const themeObj = typeof getThemeById === 'function' ? getThemeById(themeId) : null;
  const baseType = themeObj ? themeObj.type || 'dark' : 'dark';

  if (themeObj && typeof applyThemeColors === 'function') {
    applyThemeColors(themeObj);
  } else {
    if (typeof clearThemeColors === 'function') clearThemeColors();
    document.documentElement.setAttribute('data-theme', baseType);
  }

  const termViews = dom.terminalViews;
  if (termViews) {
    termViews.classList.toggle('dockview-theme-dark', baseType === 'dark');
    termViews.classList.toggle('dockview-theme-light', baseType !== 'dark');
  }

  const safeTheme = baseType === 'dark' ? 'dark' : 'light';
  const themeScript = _buildDashboardThemeScript(safeTheme, themeObj ? themeObj.colors : null);
  const webviews = document.querySelectorAll('webview');
  webviews.forEach((wv) => {
    try {
      wv.executeJavaScript(themeScript).catch(() => {});
    } catch (_e) {
      /* webview not ready */
    }
  });

  const newTermTheme = getTermTheme(themeId);
  const newFontWeight = getTermFontWeight(themeId);
  for (const [, ts] of state.terminals) {
    ts.term.options.theme = newTermTheme;
    ts.term.options.fontWeight = newFontWeight;
  }
}

function _buildDashboardThemeScript(t, c) {
  const colors = {};
  if (c) {
    colors.bg = c.background;
    colors.surface = c.surface;
    colors.surfaceHover = c.surfaceHover || c.surface;
    colors.border = c.border;
    colors.text = c.text;
    colors.textSecondary = c.textSecondary || c.text;
    colors.accent = c.accent || c.primary;
    colors.accentHover = c.accentHover || colors.accent;
    colors.onPrimary = c.onPrimary || (t === 'dark' ? '#1a1d23' : '#ffffff');
  }
  return `(function(t, c) {
    document.body.className = document.body.className.replace(/theme-\\w+/, '') + ' theme-' + t;
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('agent-comm-theme', t);
    localStorage.setItem('agent-tasks-theme', t);
    localStorage.setItem('agent-knowledge-theme', t);
    localStorage.setItem('agent-discover-theme', t);
    var toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.style.display = 'none';
    var icon = document.querySelector('.theme-icon');
    if (icon) icon.textContent = t === 'dark' ? 'light_mode' : 'dark_mode';
    if (!c || !c.bg) return;
    var r = document.body.style;
    r.setProperty('--bg', c.bg);
    r.setProperty('--bg-surface', c.surface);
    r.setProperty('--bg-elevated', c.surfaceHover);
    r.setProperty('--bg-hover', c.surfaceHover);
    r.setProperty('--bg-inset', c.bg);
    r.setProperty('--border', c.border);
    r.setProperty('--border-light', c.border);
    r.setProperty('--text', c.text);
    r.setProperty('--text-secondary', c.textSecondary);
    // Muted/dim: blend text + textSecondary for readable but dimmed appearance
    var tR = parseInt(c.text.slice(1,3),16), tG = parseInt(c.text.slice(3,5),16), tB = parseInt(c.text.slice(5,7),16);
    var sR = parseInt(c.textSecondary.slice(1,3),16), sG = parseInt(c.textSecondary.slice(3,5),16), sB = parseInt(c.textSecondary.slice(5,7),16);
    var muted = '#' + [Math.round((tR+sR)/2), Math.round((tG+sG)/2), Math.round((tB+sB)/2)].map(function(v){return v.toString(16).padStart(2,'0')}).join('');
    r.setProperty('--text-muted', muted);
    r.setProperty('--text-dim', c.textSecondary);
    r.setProperty('--accent', c.accent);
    r.setProperty('--accent-hover', c.accentHover);
    var rgb = parseInt(c.accent.slice(1,3),16)+','+parseInt(c.accent.slice(3,5),16)+','+parseInt(c.accent.slice(5,7),16);
    r.setProperty('--accent-dim', 'rgba('+rgb+',0.15)');
    r.setProperty('--accent-glow', 'rgba('+rgb+',0.35)');
    r.setProperty('--accent-solid', c.onPrimary);
    r.setProperty('--shadow-1', t==='dark' ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.1)');
    r.setProperty('--shadow-2', t==='dark' ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.15)');
    var style = document.getElementById('agent-desk-theme-overrides');
    if (!style) { style = document.createElement('style'); style.id = 'agent-desk-theme-overrides'; document.head.appendChild(style); }
    style.textContent =
      '.nav-badge, .importance-badge, .stuck-badge, .stage-badge, .priority-pill, .tag-pill { background: ' + c.accent + ' !important; }' +
      'a, .nav-item.active, .nav-link.active, .tab.active { color: ' + c.accent + ' !important; }' +
      'h1, h2, h3, .header-title, .dashboard-title, .stat-value, .section-heading, .card-title { color: ' + c.text + ' !important; }' +
      '.version, .status-text, .stat-label, .meta, .subtitle, .hint, time, .timestamp { color: ' + muted + ' !important; }' +
      '.connected-badge, .status-badge { color: ' + c.accent + ' !important; }' +
      'input, select, textarea, .search-input { background: ' + c.surface + ' !important; color: ' + c.text + ' !important; border-color: ' + c.border + ' !important; }' +
      'input::placeholder { color: ' + c.textSecondary + ' !important; }';
  })(${JSON.stringify(t)}, ${JSON.stringify(colors)})`;
}

// Sidebar setup

export function setupSidebar() {
  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) switchView(view);
    });
  });

  const terminalsBtn = document.querySelector('.nav-btn[data-view="terminals"]');
  if (terminalsBtn) {
    terminalsBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      registry.showContextMenu(e.clientX, e.clientY, [
        { label: 'Close Idle Terminals', icon: 'delete_sweep', action: () => registry.closeIdleTerminals() },
        { label: 'Auto-Arrange', icon: 'grid_view', action: () => registry.reorderTerminals() },
        { type: 'separator' },
        { label: 'Save Workspace', icon: 'save', action: () => registry.showWorkspaceSaveDialog() },
      ]);
    });
  }
}

export function setupAgentButton() {
  document.getElementById('btn-start-agent')?.addEventListener('click', () => {
    if (state.activeView !== 'terminals') switchView('terminals');
    const agentProfile = _getDefaultAgentProfile();
    registry.createTerminalFromProfile(agentProfile);
  });
}

export function setupThemeToggle() {
  const webviews = document.querySelectorAll('webview');
  webviews.forEach((wv) => {
    const syncTheme = () => applyTheme(getSetting('themeId') || null);
    wv.addEventListener('did-finish-load', syncTheme);
    wv.addEventListener('dom-ready', () => setTimeout(syncTheme, 1000));
    wv.addEventListener('did-finish-load', () => {
      // Watch for theme changes inside the webview and sync back to shell
      wv.executeJavaScript(
        `
        (function() {
          if (window.__agentDeskThemeObserver) return;
          function notifyTheme(mutations) {
            var t = null;
            for (var i = 0; mutations && i < mutations.length; i++) {
              if (mutations[i].target === document.body) {
                var m = document.body.className.match(/theme-(\\w+)/);
                if (m) t = m[1];
              }
            }
            if (!t) {
              var dt = document.documentElement.getAttribute('data-theme');
              if (dt) t = dt;
            }
            if (!t) t = 'light';
            if (t === window.__agentDeskLastSyncedTheme) return;
            window.__agentDeskLastSyncedTheme = t;
            console.log('__agent_desk_theme__:' + t);
          }
          var obs = new MutationObserver(notifyTheme);
          obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
          obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
          window.__agentDeskThemeObserver = obs;
        })();
      `,
      ).catch(() => {});
    });

    // Listen for theme change signals from webviews
    wv.addEventListener('console-message', (e) => {
      if (e.message && e.message.startsWith('__agent_desk_theme__:')) {
        const newTheme = e.message.split(':')[1];
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        if (newTheme !== current) {
          const newId = newTheme === 'dark' ? 'default-dark' : 'default-light';
          setSetting('themeId', newId);
          setSetting('theme', newTheme);
          applyTheme(newId);
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Theme Toggle Button (sidebar) + OS auto-detect
// ---------------------------------------------------------------------------

function _updateThemeToggleIcon() {
  const btn = document.getElementById('btn-theme-toggle');
  if (!btn) return;
  const currentTheme = typeof getThemeById === 'function' ? getThemeById(getSetting('themeId')) : null;
  const isDark = !currentTheme || currentTheme.type === 'dark';
  const icon = btn.querySelector('.material-symbols-outlined');
  if (icon) icon.textContent = isDark ? 'light_mode' : 'dark_mode';
}

export function setupThemeToggleButton() {
  const btn = document.getElementById('btn-theme-toggle');
  if (!btn) return;

  _updateThemeToggleIcon();

  btn.addEventListener('click', () => {
    const currentTheme = typeof getThemeById === 'function' ? getThemeById(getSetting('themeId')) : null;
    const isDark = !currentTheme || currentTheme.type === 'dark';

    const targetId = isDark
      ? getSetting('preferredLightTheme') || 'default-light'
      : getSetting('preferredDarkTheme') || 'default-dark';

    setSetting('themeId', targetId);
    const targetTheme = typeof getThemeById === 'function' ? getThemeById(targetId) : null;
    setSetting('theme', targetTheme ? targetTheme.type : 'dark');
    applyTheme(targetId);
    _updateThemeToggleIcon();
  });

  // Listen for theme changes from other sources (settings, webview sync)
  window.addEventListener('settings-changed', () => _updateThemeToggleIcon());
}

// OS theme auto-detect
export function setupSystemThemeListener() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');

  function onSystemThemeChange(e) {
    if (getSetting('followSystemTheme') !== true) return;
    const targetId = e.matches
      ? getSetting('preferredDarkTheme') || 'default-dark'
      : getSetting('preferredLightTheme') || 'default-light';

    setSetting('themeId', targetId);
    const targetTheme = typeof getThemeById === 'function' ? getThemeById(targetId) : null;
    setSetting('theme', targetTheme ? targetTheme.type : 'dark');
    applyTheme(targetId);
    _updateThemeToggleIcon();
  }

  mq.addEventListener('change', onSystemThemeChange);

  // Apply on startup if followSystemTheme is enabled
  if (getSetting('followSystemTheme') === true) {
    onSystemThemeChange(mq);
  }

  // Re-enable listener when the setting changes
  window.addEventListener('follow-system-theme-changed', (e) => {
    if (e.detail === true) {
      onSystemThemeChange(mq);
    }
  });
}

// BUG FIX: Dashboard webview error handling with fallback UI
export function setupWebviewStates() {
  const webviews = [
    { id: 'webview-comm', container: 'view-comm', label: 'Agent Comm', port: '3421' },
    { id: 'webview-tasks', container: 'view-tasks', label: 'Tasks', port: '3422' },
    { id: 'webview-knowledge', container: 'view-knowledge', label: 'Agent Knowledge', port: '3423' },
    { id: 'webview-discover', container: 'view-discover', label: 'Discover', port: '3424' },
  ];

  webviews.forEach((wv) => {
    const webview = document.getElementById(wv.id);
    const container = document.getElementById(wv.container);
    if (!webview || !container) return;

    let retryTimer = null;
    let retryDelay = 3000;
    let countdownInterval = null;
    const MAX_DELAY = 30000;

    const overlay = document.createElement('div');
    overlay.className = 'webview-overlay';
    overlay.innerHTML =
      '<div class="webview-spinner"></div>' + '<span class="webview-msg">Connecting to ' + wv.label + '...</span>';
    container.appendChild(overlay);

    function clearRetry() {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    }

    webview.addEventListener('did-finish-load', () => {
      clearRetry();
      retryDelay = 3000;
      overlay.classList.add('fade-out');
      setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
      }, 300);
    });

    webview.addEventListener('did-fail-load', (_event) => {
      clearRetry();

      let secondsLeft = Math.ceil(retryDelay / 1000);
      overlay.classList.remove('fade-out');
      overlay.innerHTML =
        '<span class="material-symbols-outlined webview-error-icon">cloud_off</span>' +
        '<span class="webview-msg">Dashboard not available</span>' +
        '<span class="webview-hint">' +
        wv.label +
        ' server at localhost:' +
        wv.port +
        ' is not running</span>' +
        '<span class="webview-countdown">Retrying in ' +
        secondsLeft +
        's...</span>' +
        '<button class="webview-retry">Retry Now</button>';

      countdownInterval = setInterval(() => {
        secondsLeft--;
        const cd = overlay.querySelector('.webview-countdown');
        if (cd) cd.textContent = 'Retrying in ' + Math.max(0, secondsLeft) + 's...';
      }, 1000);

      retryTimer = setTimeout(() => {
        clearInterval(countdownInterval);
        countdownInterval = null;
        overlay.innerHTML =
          '<div class="webview-spinner"></div>' +
          '<span class="webview-msg">Reconnecting to ' +
          wv.label +
          '...</span>';
        webview.reload();
        retryDelay = Math.min(retryDelay * 2, MAX_DELAY);
      }, retryDelay);

      const retryBtn = overlay.querySelector('.webview-retry');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          clearRetry();
          retryDelay = 3000;
          overlay.innerHTML =
            '<div class="webview-spinner"></div>' +
            '<span class="webview-msg">Connecting to ' +
            wv.label +
            '...</span>';
          webview.reload();
        });
      }
    });
  });
}

// Status bar

export function updateStatusBar() {
  const left = dom.statusLeft;
  if (left) {
    if (state.activeView === 'terminals') {
      const total = state.terminals.size;
      if (total === 0) {
        left.textContent = '0 terminals';
      } else {
        const counts = { running: 0, waiting: 0, idle: 0, exited: 0 };
        for (const ts of state.terminals.values()) {
          counts[ts.status] = (counts[ts.status] || 0) + 1;
        }
        const parts = [];
        if (counts.running > 0) parts.push(`${counts.running} running`);
        if (counts.waiting > 0) parts.push(`${counts.waiting} waiting`);
        if (counts.idle > 0) parts.push(`${counts.idle} idle`);
        if (counts.exited > 0) parts.push(`${counts.exited} exited`);
        left.textContent = `${total} terminal${total !== 1 ? 's' : ''}: ${parts.join(', ')}`;
      }
    } else {
      const viewNames = {
        comm: 'Communication',
        tasks: 'Tasks',
        knowledge: 'Agent Knowledge',
        discover: 'Discover',
        monitor: 'Agent Monitor',
        events: 'Event Stream',
        settings: 'Settings',
      };
      left.textContent = viewNames[state.activeView] || state.activeView;
    }
  }

  const center = document.querySelector('#status-bar .status-center');
  if (center) {
    if (state.activeView === 'terminals' && state.activeTerminalId && typeof ShellIntegration !== 'undefined') {
      const cwd = ShellIntegration.getCwd(state.activeTerminalId);
      center.textContent = cwd ? '\uD83D\uDCC1 ' + cwd : '';
    } else {
      center.textContent = '';
    }
  }

  const right = dom.statusRight;
  if (right) {
    // Use a dedicated span for terminal info to avoid clobbering widget children
    let infoSpan = right.querySelector('.status-right-info');
    if (!infoSpan) {
      infoSpan = document.createElement('span');
      infoSpan.className = 'status-right-info';
      right.appendChild(infoSpan);
    }
    if (state.activeView === 'terminals' && state.activeTerminalId) {
      const ts = state.terminals.get(state.activeTerminalId);
      if (ts) {
        let rightText = ts.title + ' \u2014 ' + ts.status;
        if (typeof ShellIntegration !== 'undefined') {
          const exitCode = ShellIntegration.getLastExitCode(state.activeTerminalId);
          if (exitCode !== null) {
            rightText += exitCode === 0 ? ' \u2714' : ' \u2718 ' + exitCode;
          }
        }
        infoSpan.textContent = rightText;
      } else {
        infoSpan.textContent = '';
      }
    } else {
      infoSpan.textContent = '';
    }
  }
}

// Window Controls

export function setupWindowControls() {
  document.getElementById('btn-minimize')?.addEventListener('click', () => agentDesk.window.minimize());
  document.getElementById('btn-maximize')?.addEventListener('click', () => agentDesk.window.maximize());
  document.getElementById('btn-close')?.addEventListener('click', () => agentDesk.window.close());
}

// Help button

export function setupHelpButton() {
  const btn = document.getElementById('btn-help');
  if (btn) btn.addEventListener('click', () => registry.showShortcutsOverlay());
}

// Event Stream Setup

export function setupEventStream() {
  eventStream.init();
  const panel = eventStream.getPanel();
  const container = document.getElementById('view-events');
  if (container && panel) {
    container.appendChild(panel);
  }
}

// Tray Actions

export function setupTrayActions() {
  state._cleanupOnAction = agentDesk.onAction((action) => {
    switch (action) {
      case 'new-terminal':
        registry.createTerminal();
        break;
      default:
        console.log('Unknown tray action:', action);
    }
  });

  if (agentDesk.onOpenCwd) {
    agentDesk.onOpenCwd((cwd, command) => {
      if (state.activeView !== 'terminals') switchView('terminals');
      const opts = {};
      if (cwd) opts.cwd = cwd;
      if (command === 'default') {
        opts.command = getSetting('defaultNewTerminalCommand') || undefined;
      } else if (command) {
        opts.command = command;
      }
      registry.createTerminal(opts);
    });
  }
}

// New Tab / Terminal buttons

export function _buildProfileMenuItems() {
  const profiles = typeof getProfiles === 'function' ? getProfiles() : [];
  const items = profiles.map((p) => ({
    label: p.name,
    icon: p.icon || 'terminal',
    action: () => registry.createTerminalFromProfile(p),
  }));
  if (items.length > 0) items.push({ type: 'separator' });
  return items;
}

function _getDefaultProfile() {
  const profiles = typeof getProfiles === 'function' ? getProfiles() : [];
  const defaultId = typeof getSetting === 'function' ? getSetting('defaultProfile') : 'default-shell';
  return profiles.find((p) => p.id === defaultId) || profiles[0] || null;
}

function _getDefaultAgentProfile() {
  const profiles = typeof getProfiles === 'function' ? getProfiles() : [];
  const defaultId = typeof getSetting === 'function' ? getSetting('defaultProfile') : '';
  if (defaultId) {
    const match = profiles.find((p) => p.id === defaultId);
    if (match && match.id !== 'default-shell') return match;
  }
  const shellIds = new Set(['default-shell']);
  return (
    profiles.find((p) => !shellIds.has(p.id) && p.command && p.command !== '') ||
    profiles[0] || { command: '', icon: 'terminal', name: 'Terminal' }
  );
}

function _launchDefaultProfile() {
  const profile = _getDefaultProfile();
  if (profile) {
    registry.createTerminalFromProfile(profile);
  } else {
    registry.createTerminal();
  }
}

export function setupNewTerminalButton() {
  const btn = document.getElementById('btn-new-terminal');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (state.activeView !== 'terminals') switchView('terminals');
    _launchDefaultProfile();
  });

  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const items = _buildProfileMenuItems();
    registry.showContextMenu(e.clientX, e.clientY, items);
  });
}

export function setupNewTabButton() {
  const btn = dom.btnNewTab;
  if (!btn) return;

  btn.addEventListener('click', () => _launchDefaultProfile());

  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const items = _buildProfileMenuItems();
    items.push(
      {
        label: 'Split Right',
        icon: 'vertical_split',
        shortcut: 'Ctrl+Shift+D',
        action: () => registry.splitTerminalRight(),
      },
      {
        label: 'Split Down',
        icon: 'horizontal_split',
        shortcut: 'Ctrl+Shift+E',
        action: () => registry.splitTerminalDown(),
      },
      { type: 'separator' },
      {
        label: 'Toggle Maximize',
        icon: 'open_in_full',
        shortcut: 'Ctrl+Shift+M',
        action: () => registry.toggleMaximize(),
      },
      { type: 'separator' },
      { label: 'Close Idle Terminals', icon: 'delete_sweep', action: () => registry.closeIdleTerminals() },
      { label: 'Auto-Arrange', icon: 'grid_view', action: () => registry.reorderTerminals() },
      { type: 'separator' },
      { label: 'Save Workspace', icon: 'save', action: () => registry.showWorkspaceSaveDialog() },
    );
    registry.showContextMenu(e.clientX, e.clientY, items);
  });
}

// ---------------------------------------------------------------------------
// Dashboard Health Status Indicators
// ---------------------------------------------------------------------------

const _serviceViewMap = {
  comm: { btnView: 'comm', webviewId: 'webview-comm', containerId: 'view-comm' },
  tasks: { btnView: 'tasks', webviewId: 'webview-tasks', containerId: 'view-tasks' },
  knowledge: { btnView: 'knowledge', webviewId: 'webview-knowledge', containerId: 'view-knowledge' },
  discover: { btnView: 'discover', webviewId: 'webview-discover', containerId: 'view-discover' },
};

let _lastDashboardStatus = { comm: 'unknown', tasks: 'unknown', knowledge: 'unknown', discover: 'unknown' };

function _createStatusDots() {
  for (const [key, info] of Object.entries(_serviceViewMap)) {
    const btn = document.querySelector(`.nav-btn[data-view="${info.btnView}"]`);
    if (!btn) continue;
    const existing = btn.querySelector('.service-dot');
    if (existing) existing.remove();
    const dot = document.createElement('span');
    dot.className = 'service-dot';
    dot.dataset.service = key;
    btn.appendChild(dot);
  }
}

function _updateStatusDots(status) {
  for (const [key, state] of Object.entries(status)) {
    const dot = document.querySelector(`.service-dot[data-service="${key}"]`);
    if (!dot) continue;
    dot.classList.toggle('up', state === 'up');
    dot.classList.toggle('down', state === 'down');
    dot.classList.remove('unknown');
    if (state === 'unknown') dot.classList.add('unknown');
  }
}

function _handleStatusTransitions(prev, next) {
  for (const [key, info] of Object.entries(_serviceViewMap)) {
    const prevState = prev[key];
    const nextState = next[key];
    if (prevState === nextState) continue;

    const webview = document.getElementById(info.webviewId);
    const container = document.getElementById(info.containerId);
    if (!webview || !container) continue;

    if (prevState === 'down' && nextState === 'up') {
      const overlay = container.querySelector('.webview-overlay');
      if (overlay && !overlay.classList.contains('fade-out')) {
        overlay.innerHTML = '<div class="webview-spinner"></div>' + '<span class="webview-msg">Reconnecting...</span>';
        if (webview.src) {
          webview.reload();
        } else if (webview.dataset.src) {
          webview.src = webview.dataset.src;
        }
      }
    } else if (prevState === 'up' && nextState === 'down') {
      if (webview.src) {
        webview.reload();
      }
    }
  }
}

export function setupDashboardHealth() {
  _createStatusDots();

  if (typeof agentDesk !== 'undefined' && agentDesk.dashboard) {
    agentDesk.dashboard.getStatus().then((status) => {
      _lastDashboardStatus = status;
      _updateStatusDots(status);
    });

    // Listen for status changes
    agentDesk.dashboard.onStatusChanged((status) => {
      _handleStatusTransitions(_lastDashboardStatus, status);
      _lastDashboardStatus = status;
      _updateStatusDots(status);
    });
  }
}

registry.setupDashboardHealth = setupDashboardHealth;

registry.switchView = switchView;
registry.updateSidebar = updateSidebar;
registry.applySettings = applySettings;
registry.applyTheme = applyTheme;
registry.updateStatusBar = updateStatusBar;
registry.setupWebviewStates = setupWebviewStates;
registry.setupSidebar = setupSidebar;
registry.setupAgentButton = setupAgentButton;
registry.setupThemeToggle = setupThemeToggle;
registry.setupThemeToggleButton = setupThemeToggleButton;
registry.setupSystemThemeListener = setupSystemThemeListener;
registry.setupWindowControls = setupWindowControls;
registry.setupHelpButton = setupHelpButton;
registry.setupEventStream = setupEventStream;
registry.setupTrayActions = setupTrayActions;
registry.setupNewTerminalButton = setupNewTerminalButton;
registry.setupNewTabButton = setupNewTabButton;
