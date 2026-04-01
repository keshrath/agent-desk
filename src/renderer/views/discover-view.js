// =============================================================================
// Agent Desk — Native Discover View
// =============================================================================
// 2 tabs: Servers (installed + active) and Browse (marketplace)
// Uses window.agentDesk.discover.* IPC calls
// =============================================================================

'use strict';

let _discRoot = null;
let _discCleanup = null;
let _discActiveTab = 'servers';
let _discServers = [];
let _discBrowseResults = [];
let _discBrowseQuery = '';
let _discExpandedId = null;

const DISC_TABS = [
  { id: 'servers', label: 'Servers', icon: 'dns' },
  { id: 'browse', label: 'Browse', icon: 'explore' },
];

const APPROVAL_COLORS = {
  approved: '#3fb950',
  pending: '#d29922',
  rejected: '#f85149',
};

const HEALTH_COLORS = {
  healthy: '#3fb950',
  unhealthy: '#f85149',
  unknown: '#8b949e',
};

function _discStyles() {
  return `
    .disc-view { display: flex; flex-direction: column; height: 100%; font-family: 'Inter', sans-serif; color: var(--text, #c8d1da); background: var(--bg, #1a1d23); }
    .disc-tabs { display: flex; gap: 2px; padding: 8px 12px 0; border-bottom: 1px solid var(--border, #2d323b); background: var(--bg-surface, #21252b); flex-shrink: 0; }
    .disc-tab { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; background: transparent; color: var(--text-secondary, #8b949e); cursor: pointer; font-size: 13px; font-weight: 500; border-bottom: 2px solid transparent; transition: all 0.15s; border-radius: 6px 6px 0 0; }
    .disc-tab:hover { color: var(--text, #c8d1da); background: var(--bg-hover, #282d35); }
    .disc-tab.active { color: var(--accent, #5d8da8); border-bottom-color: var(--accent, #5d8da8); }
    .disc-tab .material-symbols-outlined { font-size: 18px; }
    .disc-content { flex: 1; overflow-y: auto; padding: 16px; }
    .disc-card { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 14px; margin-bottom: 10px; cursor: pointer; transition: border-color 0.15s; }
    .disc-card:hover { border-color: var(--accent, #5d8da8); }
    .disc-card.expanded { border-color: var(--accent, #5d8da8); }
    .disc-card-header { display: flex; align-items: center; gap: 10px; }
    .disc-card-title { font-size: 14px; font-weight: 600; flex: 1; }
    .disc-health-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .disc-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .disc-card-meta { font-size: 12px; color: var(--text-secondary, #8b949e); margin-top: 4px; display: flex; gap: 10px; flex-wrap: wrap; }
    .disc-card-actions { display: flex; gap: 6px; margin-top: 10px; }
    .disc-btn { padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border, #2d323b); background: transparent; color: var(--text, #c8d1da); cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px; transition: all 0.15s; }
    .disc-btn:hover { border-color: var(--accent, #5d8da8); }
    .disc-btn .material-symbols-outlined { font-size: 14px; }
    .disc-btn-primary { background: var(--accent, #5d8da8); color: var(--bg, #1a1d23); border-color: var(--accent, #5d8da8); }
    .disc-btn-danger { color: #f85149; border-color: #f85149; }
    .disc-btn-danger:hover { background: rgba(248,81,73,0.1); }
    .disc-detail { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border, #2d323b); }
    .disc-section { margin-bottom: 12px; }
    .disc-section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary, #8b949e); margin-bottom: 6px; }
    .disc-kv { display: flex; gap: 8px; padding: 3px 0; font-size: 12px; }
    .disc-kv-key { font-family: 'JetBrains Mono', monospace; color: var(--accent, #5d8da8); min-width: 100px; }
    .disc-kv-val { font-family: 'JetBrains Mono', monospace; color: var(--text, #c8d1da); word-break: break-all; }
    .disc-tool-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .disc-tool-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-family: 'JetBrains Mono', monospace; background: var(--bg, #1a1d23); border: 1px solid var(--border, #2d323b); }
    .disc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; color: var(--text-secondary, #8b949e); }
    .disc-empty .material-symbols-outlined { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
    .disc-search-bar { display: flex; gap: 8px; margin-bottom: 16px; }
    .disc-search-bar input { flex: 1; padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border, #2d323b); background: var(--bg-surface, #21252b); color: var(--text, #c8d1da); font-size: 13px; outline: none; }
    .disc-search-bar input:focus { border-color: var(--accent, #5d8da8); }
    .disc-search-bar button { padding: 8px 16px; border-radius: 6px; border: none; background: var(--accent, #5d8da8); color: var(--bg, #1a1d23); font-weight: 600; cursor: pointer; font-size: 13px; }
    .disc-browse-card { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 14px; margin-bottom: 10px; }
    .disc-browse-desc { font-size: 12px; color: var(--text-secondary, #8b949e); margin-top: 6px; max-height: 60px; overflow: hidden; }
    .disc-active-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; background: rgba(63,185,80,0.2); color: #3fb950; }
    .disc-inactive-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; background: rgba(139,148,158,0.2); color: #8b949e; }
  `;
}

function _esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function _renderServerCard(server) {
  const isExpanded = _discExpandedId === server.id;
  const healthColor = HEALTH_COLORS[server.health_status] || HEALTH_COLORS.unknown;
  const approvalColor = APPROVAL_COLORS[server.approval_status] || '#8b949e';

  let html = `<div class="disc-card${isExpanded ? ' expanded' : ''}" data-server-id="${_esc(server.id)}">`;
  html += '<div class="disc-card-header">';
  html += `<span class="disc-health-dot" style="background:${healthColor}" title="${server.health_status || 'unknown'}"></span>`;
  html += `<span class="disc-card-title">${_esc(server.name)}</span>`;
  html += server.active
    ? '<span class="disc-active-tag">active</span>'
    : '<span class="disc-inactive-tag">inactive</span>';
  if (server.approval_status) {
    html += `<span class="disc-badge" style="background:${approvalColor}22;color:${approvalColor}">${server.approval_status}</span>`;
  }
  html += '</div>';

  html += '<div class="disc-card-meta">';
  if (server.source) html += `<span>${_esc(server.source)}</span>`;
  if (server.transport) html += `<span>${_esc(server.transport)}</span>`;
  if (server.version) html += `<span>v${_esc(server.version)}</span>`;
  if (server.error_count > 0) html += `<span style="color:#f85149">${server.error_count} errors</span>`;
  html += '</div>';

  if (isExpanded) {
    html += '<div class="disc-detail">';

    // Tools
    if (server.tools && server.tools.length > 0) {
      html += '<div class="disc-section"><div class="disc-section-title">Tools</div>';
      html += '<div class="disc-tool-list">';
      server.tools.forEach((t) => {
        const name = typeof t === 'string' ? t : t.name || '';
        html += `<span class="disc-tool-tag">${_esc(name)}</span>`;
      });
      html += '</div></div>';
    }

    // Config
    if (server.command || server.args) {
      html += '<div class="disc-section"><div class="disc-section-title">Configuration</div>';
      if (server.command)
        html += `<div class="disc-kv"><span class="disc-kv-key">command</span><span class="disc-kv-val">${_esc(server.command)}</span></div>`;
      if (server.args)
        html += `<div class="disc-kv"><span class="disc-kv-key">args</span><span class="disc-kv-val">${_esc(JSON.stringify(server.args))}</span></div>`;
      if (server.env)
        html += `<div class="disc-kv"><span class="disc-kv-key">env</span><span class="disc-kv-val">${_esc(JSON.stringify(server.env))}</span></div>`;
      html += '</div>';
    }

    // Secrets placeholder
    html += `<div class="disc-section"><div class="disc-section-title">Secrets</div><div class="disc-kv"><span class="disc-kv-val" style="color:var(--text-secondary)">Click "View Secrets" to load</span></div></div>`;

    // Actions
    html += '<div class="disc-card-actions">';
    if (server.active) {
      html += `<button class="disc-btn" data-action="deactivate" data-id="${_esc(server.id)}"><span class="material-symbols-outlined">stop_circle</span>Deactivate</button>`;
    } else {
      html += `<button class="disc-btn disc-btn-primary" data-action="activate" data-id="${_esc(server.id)}"><span class="material-symbols-outlined">play_circle</span>Activate</button>`;
    }
    html += `<button class="disc-btn" data-action="health" data-id="${_esc(server.id)}"><span class="material-symbols-outlined">favorite</span>Health Check</button>`;
    html += `<button class="disc-btn" data-action="secrets" data-id="${_esc(server.id)}"><span class="material-symbols-outlined">key</span>View Secrets</button>`;
    html += `<button class="disc-btn" data-action="metrics" data-id="${_esc(server.id)}"><span class="material-symbols-outlined">analytics</span>Metrics</button>`;
    html += `<button class="disc-btn disc-btn-danger" data-action="delete" data-id="${_esc(server.id)}"><span class="material-symbols-outlined">delete</span>Delete</button>`;
    html += '</div>';

    html += '</div>';
  }

  html += '</div>';
  return html;
}

function _renderServers() {
  if (_discServers.length === 0) {
    return '<div class="disc-empty"><span class="material-symbols-outlined">dns</span><span>No servers registered</span></div>';
  }

  // Sort: active first, then by name
  const sorted = [..._discServers].sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  return sorted.map(_renderServerCard).join('');
}

function _renderBrowse() {
  let html = `<div class="disc-search-bar">
    <input type="text" placeholder="Search MCP marketplace..." value="${_esc(_discBrowseQuery)}" />
    <button>Search</button>
  </div>`;

  if (_discBrowseResults.length === 0 && _discBrowseQuery) {
    html +=
      '<div class="disc-empty"><span class="material-symbols-outlined">search_off</span><span>No results</span></div>';
  } else if (_discBrowseResults.length === 0) {
    html +=
      '<div class="disc-empty"><span class="material-symbols-outlined">explore</span><span>Search the marketplace to find MCP servers</span></div>';
  } else {
    _discBrowseResults.forEach((s) => {
      html += '<div class="disc-browse-card">';
      html += `<div class="disc-card-header"><span class="disc-card-title">${_esc(s.name || s.title)}</span></div>`;
      if (s.description) html += `<div class="disc-browse-desc">${_esc(s.description)}</div>`;
      html += '</div>';
    });
  }

  return html;
}

function _bindCardActions(content) {
  // Card expand/collapse
  content.querySelectorAll('.disc-card[data-server-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      // Don't toggle if clicking a button
      if (e.target.closest('button')) return;
      const id = card.dataset.serverId;
      _discExpandedId = _discExpandedId === id ? null : id;
      _renderDiscTab();
    });
  });

  // Action buttons
  content.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      switch (action) {
        case 'activate':
          await agentDesk.discover.activate(id);
          break;
        case 'deactivate':
          await agentDesk.discover.deactivate(id);
          break;
        case 'delete':
          if (confirm('Delete this server?')) {
            await agentDesk.discover.delete(id);
          }
          break;
        case 'health': {
          const result = await agentDesk.discover.health(id);
          if (result) {
            const s = _discServers.find((x) => x.id === id);
            if (s) s.health_status = result.status || result.healthy ? 'healthy' : 'unhealthy';
          }
          break;
        }
        case 'secrets': {
          const secrets = await agentDesk.discover.secrets(id);
          const section = btn.closest('.disc-detail')?.querySelector('.disc-section:nth-child(3)');
          if (section && secrets) {
            let html = '<div class="disc-section-title">Secrets</div>';
            if (secrets.length === 0) {
              html +=
                '<div class="disc-kv"><span class="disc-kv-val" style="color:var(--text-secondary)">No secrets configured</span></div>';
            } else {
              secrets.forEach((s) => {
                html += `<div class="disc-kv"><span class="disc-kv-key">${_esc(s.key)}</span><span class="disc-kv-val">${_esc(s.masked_value || '***')}</span></div>`;
              });
            }
            section.innerHTML = html;
          }
          return; // Don't re-render
        }
        case 'metrics': {
          const metrics = await agentDesk.discover.metrics(id);
          const detail = btn.closest('.disc-detail');
          if (detail && metrics) {
            let existing = detail.querySelector('.disc-metrics-section');
            if (!existing) {
              existing = document.createElement('div');
              existing.className = 'disc-section disc-metrics-section';
              detail.insertBefore(existing, detail.querySelector('.disc-card-actions'));
            }
            let html = '<div class="disc-section-title">Metrics</div>';
            if (Array.isArray(metrics) && metrics.length === 0) {
              html +=
                '<div class="disc-kv"><span class="disc-kv-val" style="color:var(--text-secondary)">No metrics recorded</span></div>';
            } else if (Array.isArray(metrics)) {
              metrics.forEach((m) => {
                html += `<div class="disc-kv"><span class="disc-kv-key">${_esc(m.tool_name || m.name)}</span><span class="disc-kv-val">${m.call_count || 0} calls, ${m.error_count || 0} errors, avg ${(m.avg_latency || 0).toFixed(0)}ms</span></div>`;
              });
            }
            existing.innerHTML = html;
          }
          return; // Don't re-render
        }
      }

      // Refresh servers
      agentDesk.discover.servers().then((servers) => {
        _discServers = servers || [];
        _renderDiscTab();
      });
    });
  });
}

function _renderDiscTab() {
  const content = _discRoot?.querySelector('.disc-content');
  if (!content) return;

  switch (_discActiveTab) {
    case 'servers':
      content.innerHTML = _renderServers();
      _bindCardActions(content);
      break;

    case 'browse': {
      content.innerHTML = _renderBrowse();
      const input = content.querySelector('.disc-search-bar input');
      const btn = content.querySelector('.disc-search-bar button');
      const doSearch = () => {
        const q = input.value.trim();
        _discBrowseQuery = q;
        agentDesk.discover.browse(q).then((result) => {
          _discBrowseResults = result?.servers || result || [];
          _renderDiscTab();
        });
      };
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') doSearch();
        });
      }
      if (btn) btn.addEventListener('click', doSearch);
      break;
    }
  }
}

export function initDiscoverView(container) {
  const style = document.createElement('style');
  style.id = 'discover-view-styles';
  style.textContent = _discStyles();
  document.head.appendChild(style);

  _discRoot = document.createElement('div');
  _discRoot.className = 'disc-view';

  const tabBar = document.createElement('div');
  tabBar.className = 'disc-tabs';
  DISC_TABS.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'disc-tab' + (t.id === _discActiveTab ? ' active' : '');
    btn.dataset.tab = t.id;
    btn.innerHTML = `<span class="material-symbols-outlined">${t.icon}</span>${t.label}`;
    btn.addEventListener('click', () => {
      _discActiveTab = t.id;
      tabBar.querySelectorAll('.disc-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === t.id));
      _renderDiscTab();
    });
    tabBar.appendChild(btn);
  });

  const content = document.createElement('div');
  content.className = 'disc-content';

  _discRoot.appendChild(tabBar);
  _discRoot.appendChild(content);
  container.appendChild(_discRoot);

  // Initial load
  agentDesk.discover.getState().then((data) => {
    if (data && data.servers) {
      _discServers = data.servers;
      _renderDiscTab();
    }
  });

  // Subscribe to updates
  _discCleanup = agentDesk.discover.onUpdate((data) => {
    if (data && data.servers) {
      _discServers = data.servers;
      if (_discActiveTab === 'servers') _renderDiscTab();
    }
  });
}

export function destroyDiscoverView() {
  if (_discCleanup) {
    _discCleanup();
    _discCleanup = null;
  }
  const style = document.getElementById('discover-view-styles');
  if (style) style.remove();
  if (_discRoot) {
    _discRoot.remove();
    _discRoot = null;
  }
}
