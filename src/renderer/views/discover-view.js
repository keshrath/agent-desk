// =============================================================================
// Agent Desk — Native Discover View
// =============================================================================
// 2 tabs: Servers (installed + active) and Browse (marketplace)
// Uses window.agentDesk.discover.* IPC calls
// Feature parity with standalone agent-discover dashboard
// =============================================================================

'use strict';

let _discRoot = null;
let _discCleanup = null;
let _discActiveTab = 'servers';
let _discServers = [];
let _discBrowseResults = [];
let _discBrowseQuery = '';
let _discSearchTimeout = null;
let _discOpenSections = {}; // track open sections per server: { "serverId-sectionName": true }
let _discConnected = false;

const DISC_TABS = [
  { id: 'servers', label: 'Servers', icon: 'dns' },
  { id: 'browse', label: 'Browse', icon: 'explore' },
];

const HEALTH_COLORS = {
  healthy: '#3fb950',
  unhealthy: '#f85149',
  unknown: '#8b949e',
};

const TRANSPORT_COLORS = {
  'streamable-http': 'var(--accent, #5d8da8)',
  sse: '#e67e22',
  stdio: '#27ae60',
};

function _discStyles() {
  return `
    .disc-view { display: flex; flex-direction: column; height: 100%; font-family: 'Inter', sans-serif; color: var(--text, #c8d1da); background: var(--bg, #1a1d23); }
    .disc-tabs { display: flex; gap: 2px; padding: 8px 12px 0; border-bottom: 1px solid var(--border, #2d323b); background: var(--bg-surface, #21252b); flex-shrink: 0; }
    .disc-tab { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; background: transparent; color: var(--text-secondary, #8b949e); cursor: pointer; font-size: 13px; font-weight: 500; border-bottom: 2px solid transparent; transition: all 0.15s; border-radius: 6px 6px 0 0; }
    .disc-tab:hover { color: var(--text, #c8d1da); background: var(--bg-hover, #282d35); }
    .disc-tab.active { color: var(--accent, #5d8da8); border-bottom-color: var(--accent, #5d8da8); }
    .disc-tab .material-symbols-outlined { font-size: 18px; }
    .disc-tab .disc-badge-count { margin-left: 4px; background: var(--accent-dim, rgba(93,141,168,0.2)); color: var(--accent, #5d8da8); font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 10px; font-family: 'JetBrains Mono', monospace; }
    .disc-conn-status { display: flex; align-items: center; gap: 6px; margin-left: auto; padding: 4px 10px; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--text-secondary, #8b949e); }
    .disc-conn-dot { width: 6px; height: 6px; border-radius: 50%; }
    .disc-conn-dot.connected { background: #3fb950; }
    .disc-conn-dot.disconnected { background: #f85149; }
    .disc-content { flex: 1; overflow-y: auto; padding: 16px; }
    .disc-card { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 16px; margin-bottom: 10px; transition: border-color 0.15s; }
    .disc-card:hover { border-color: var(--accent, #5d8da8); }
    .disc-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .disc-card-name { font-size: 14px; font-weight: 600; font-family: 'JetBrains Mono', monospace; }
    .disc-card-status { display: flex; align-items: center; gap: 8px; }
    .disc-health-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
    .disc-status-label { font-size: 12px; font-weight: 500; }
    .disc-error-count { font-size: 11px; color: #f85149; font-weight: 500; }
    .disc-card-desc { font-size: 13px; color: var(--text-secondary, #8b949e); margin-bottom: 10px; line-height: 1.4; }
    .disc-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .disc-tag { font-size: 11px; padding: 2px 8px; background: rgba(255,255,255,0.08); color: var(--text-secondary, #8b949e); border-radius: 4px; font-family: 'JetBrains Mono', monospace; }
    .disc-card-meta { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--text-secondary, #8b949e); }
    .disc-card-meta .material-symbols-outlined { font-size: 16px; }
    .disc-tool-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border, #2d323b); }
    .disc-tool-section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary, #8b949e); margin-bottom: 6px; }
    .disc-tool-grid { display: grid; grid-template-columns: 140px 1fr; gap: 0 16px; margin-top: 8px; padding-top: 4px; border-top: 1px solid var(--border, #2d323b); }
    .disc-tool-item { display: contents; }
    .disc-tool-name { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--accent, #5d8da8); font-weight: 500; white-space: nowrap; padding: 6px 0; overflow: hidden; text-overflow: ellipsis; }
    .disc-tool-desc { font-size: 12px; color: var(--text-secondary, #8b949e); line-height: 1.5; padding: 6px 0; border-bottom: 1px solid var(--border, #2d323b); }
    .disc-tool-item:last-child .disc-tool-desc { border-bottom: none; }
    .disc-card-actions { display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border, #2d323b); }
    .disc-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border, #2d323b); background: transparent; color: var(--text, #c8d1da); cursor: pointer; font-size: 12px; font-family: 'Inter', sans-serif; font-weight: 500; transition: all 0.15s; white-space: nowrap; }
    .disc-btn:hover { border-color: var(--accent, #5d8da8); }
    .disc-btn:disabled { opacity: 0.5; cursor: default; }
    .disc-btn .material-symbols-outlined { font-size: 14px; }
    .disc-btn-activate { border-color: #3fb950; color: #3fb950; }
    .disc-btn-activate:hover { background: #3fb950; color: var(--bg, #1a1d23); }
    .disc-btn-deactivate { border-color: #e57373; color: #e57373; }
    .disc-btn-deactivate:hover { background: #e57373; color: var(--bg, #1a1d23); }
    .disc-btn-health { border-color: var(--border, #2d323b); color: var(--text-secondary, #8b949e); }
    .disc-btn-health:hover { border-color: #3fb950; color: #3fb950; }
    .disc-btn-delete { border-color: var(--border, #2d323b); color: var(--text-secondary, #8b949e); margin-left: auto; }
    .disc-btn-delete:hover { border-color: #e57373; color: #e57373; }
    .disc-section { border-top: 1px solid var(--border, #2d323b); margin-top: 12px; padding-top: 8px; }
    .disc-section-toggle { cursor: pointer; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary, #8b949e); display: flex; align-items: center; gap: 4px; background: none; border: none; padding: 0; font-family: 'Inter', sans-serif; }
    .disc-section-toggle .material-symbols-outlined { font-size: 16px; transition: transform 0.2s; }
    .disc-section-toggle.open .material-symbols-outlined { transform: rotate(90deg); }
    .disc-section-content { display: none; padding-top: 8px; }
    .disc-section-content.open { display: block; }
    .disc-secret-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; }
    .disc-secret-key { font-family: 'JetBrains Mono', monospace; color: var(--accent, #5d8da8); }
    .disc-secret-value { color: var(--text-secondary, #8b949e); font-family: 'JetBrains Mono', monospace; }
    .disc-secret-delete { background: none; border: none; color: var(--text-secondary, #8b949e); cursor: pointer; padding: 2px; display: flex; align-items: center; }
    .disc-secret-delete:hover { color: #f85149; }
    .disc-secret-add-form { display: flex; gap: 8px; padding: 8px 0; align-items: center; }
    .disc-secret-add-form input { background: var(--bg, #1a1d23); border: 1px solid var(--border, #2d323b); border-radius: 4px; padding: 4px 8px; color: var(--text, #c8d1da); font-size: 12px; font-family: 'JetBrains Mono', monospace; outline: none; }
    .disc-secret-add-form input:focus { border-color: var(--accent, #5d8da8); }
    .disc-secret-add-form button { background: var(--accent, #5d8da8); color: #fff; border: none; border-radius: 4px; padding: 4px 10px; font-size: 12px; cursor: pointer; font-family: 'Inter', sans-serif; }
    .disc-metrics-table { width: 100%; font-size: 12px; border-collapse: collapse; }
    .disc-metrics-table th { text-align: left; color: var(--text-secondary, #8b949e); font-weight: 500; padding: 4px 8px; border-bottom: 1px solid var(--border, #2d323b); }
    .disc-metrics-table td { padding: 4px 8px; color: var(--text, #c8d1da); }
    .disc-config-form { display: flex; flex-direction: column; gap: 8px; }
    .disc-config-field { display: flex; flex-direction: column; gap: 2px; }
    .disc-config-field label { font-size: 11px; font-weight: 500; color: var(--text-secondary, #8b949e); text-transform: uppercase; letter-spacing: 0.3px; }
    .disc-config-field input, .disc-config-field textarea { background: var(--bg, #1a1d23); border: 1px solid var(--border, #2d323b); border-radius: 4px; padding: 6px 8px; color: var(--text, #c8d1da); font-size: 12px; font-family: 'JetBrains Mono', monospace; outline: none; }
    .disc-config-field input:focus, .disc-config-field textarea:focus { border-color: var(--accent, #5d8da8); }
    .disc-config-field textarea { min-height: 60px; resize: vertical; }
    .disc-config-save { align-self: flex-start; background: var(--accent, #5d8da8); color: #fff; border: none; border-radius: 4px; padding: 6px 14px; font-size: 12px; cursor: pointer; font-family: 'Inter', sans-serif; font-weight: 500; }
    .disc-config-save:hover { opacity: 0.85; }
    .disc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; color: var(--text-secondary, #8b949e); }
    .disc-empty .material-symbols-outlined { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
    .disc-empty .disc-hint { font-size: 12px; margin-top: 4px; }
    .disc-search-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 8px 12px; }
    .disc-search-bar .material-symbols-outlined { font-size: 20px; color: var(--text-secondary, #8b949e); }
    .disc-search-bar input { flex: 1; padding: 0; border-radius: 0; border: none; background: transparent; color: var(--text, #c8d1da); font-size: 14px; outline: none; font-family: 'Inter', sans-serif; }
    .disc-search-bar input::placeholder { color: var(--text-secondary, #8b949e); }
    .disc-browse-card { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 16px; margin-bottom: 10px; transition: border-color 0.15s; }
    .disc-browse-card:hover { border-color: var(--accent, #5d8da8); }
    .disc-browse-desc { font-size: 13px; color: var(--text-secondary, #8b949e); margin: 6px 0 10px; line-height: 1.4; }
    .disc-browse-header { display: flex; align-items: center; justify-content: space-between; }
    .disc-browse-name { font-weight: 600; font-size: 14px; font-family: 'JetBrains Mono', monospace; }
    .disc-browse-right { display: flex; align-items: center; gap: 8px; }
    .disc-version-badge { font-size: 11px; padding: 2px 8px; background: rgba(255,255,255,0.08); color: var(--text-secondary, #8b949e); border-radius: 4px; font-family: 'JetBrains Mono', monospace; }
    .disc-transport-badge { font-size: 11px; padding: 2px 8px; border: 1px solid; border-radius: 4px; font-family: 'JetBrains Mono', monospace; }
    .disc-btn-install { border: 1px solid var(--accent, #5d8da8); color: var(--accent, #5d8da8); background: transparent; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-family: 'Inter', sans-serif; font-weight: 500; display: flex; align-items: center; gap: 4px; transition: all 0.15s; white-space: nowrap; }
    .disc-btn-install:hover { background: var(--accent, #5d8da8); color: var(--bg, #1a1d23); }
    .disc-btn-install:disabled { opacity: 0.5; cursor: default; }
    .disc-btn-install:disabled:hover { background: transparent; color: var(--accent, #5d8da8); }
    .disc-btn-install.disc-installed { color: var(--text-secondary, #8b949e); border-color: var(--border, #2d323b); }
    .disc-btn-install.disc-installed:hover { background: transparent; color: var(--text-secondary, #8b949e); }
    .disc-browse-repo { margin-top: 8px; display: flex; align-items: center; gap: 6px; font-size: 12px; }
    .disc-browse-repo a { color: var(--accent, #5d8da8); text-decoration: none; }
    .disc-browse-repo a:hover { text-decoration: underline; }
    .disc-hint-link { color: var(--accent, #5d8da8); cursor: pointer; font-size: 13px; margin-top: 8px; background: none; border: none; font-family: 'Inter', sans-serif; }
    .disc-hint-link:hover { text-decoration: underline; }
    .disc-npm-form { display: flex; gap: 8px; margin-top: 12px; max-width: 500px; }
    .disc-npm-form input { flex: 1; background: var(--bg, #1a1d23); border: 1px solid var(--border, #2d323b); border-radius: 6px; padding: 8px 12px; color: var(--text, #c8d1da); font-family: 'JetBrains Mono', monospace; font-size: 12px; outline: none; }
    .disc-npm-form input:focus { border-color: var(--accent, #5d8da8); }
    .disc-loading { display: flex; align-items: center; justify-content: center; padding: 40px; color: var(--text-secondary, #8b949e); font-size: 14px; }
    .disc-toast { position: fixed; bottom: 20px; right: 20px; background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 10px 16px; font-size: 13px; color: var(--text, #c8d1da); box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 10000; animation: disc-toast-in 0.2s ease-out; pointer-events: none; }
    .disc-toast.disc-toast-success { border-color: #3fb950; }
    .disc-toast.disc-toast-error { border-color: #f85149; }
    @keyframes disc-toast-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `;
}

function _esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

// -------------------------------------------------------------------------
// Toast notifications
// -------------------------------------------------------------------------

function _discToast(message, type) {
  const existing = document.querySelector('.disc-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'disc-toast disc-toast-' + (type || 'success');
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 3000);
}

// -------------------------------------------------------------------------
// Transport label helper
// -------------------------------------------------------------------------

function _transportLabel(transport) {
  if (transport === 'sse') return 'remote sse';
  if (transport === 'streamable-http') return 'remote http';
  return 'local stdio';
}

// -------------------------------------------------------------------------
// Expandable section helper
// -------------------------------------------------------------------------

function _discRenderSection(serverId, name, label, contentFn) {
  const key = serverId + '-' + name;
  const isOpen = _discOpenSections[key] || false;
  let html = '<div class="disc-section">';
  html +=
    '<button class="disc-section-toggle' +
    (isOpen ? ' open' : '') +
    '" data-section-toggle="' +
    key +
    '" data-server-id="' +
    serverId +
    '" data-section-name="' +
    name +
    '">';
  html += '<span class="material-symbols-outlined">chevron_right</span>';
  html += _esc(label);
  html += '</button>';
  html += '<div class="disc-section-content' + (isOpen ? ' open' : '') + '">';
  html += contentFn();
  html += '</div></div>';
  return html;
}

// -------------------------------------------------------------------------
// Secrets section content
// -------------------------------------------------------------------------

function _discRenderSecretsContent(server) {
  const key = server.id + '-secrets';
  if (!_discOpenSections[key]) return '<div class="disc-loading">Click to load...</div>';

  const cached = _discOpenSections[key + '-data'];
  if (!cached) return '<div class="disc-loading">Loading...</div>';

  let html = '';
  if (Array.isArray(cached)) {
    cached.forEach((s) => {
      html += '<div class="disc-secret-item">';
      html += '<span class="disc-secret-key">' + _esc(s.key) + '</span>';
      html += '<span class="disc-secret-value">' + _esc(s.masked_value || '********') + '</span>';
      html +=
        '<button class="disc-secret-delete" data-action="delete-secret" data-server-id="' +
        server.id +
        '" data-secret-key="' +
        _esc(s.key) +
        '" title="Delete secret">';
      html += '<span class="material-symbols-outlined" style="font-size:14px">close</span>';
      html += '</button></div>';
    });
  }

  html += '<div class="disc-secret-add-form">';
  html += '<input type="text" placeholder="Key" data-secret-input="key-' + server.id + '" />';
  html += '<input type="password" placeholder="Value" data-secret-input="val-' + server.id + '" />';
  html += '<button data-action="add-secret" data-server-id="' + server.id + '">Save</button>';
  html += '</div>';

  return html;
}

// -------------------------------------------------------------------------
// Metrics section content
// -------------------------------------------------------------------------

function _discRenderMetricsContent(server) {
  const key = server.id + '-metrics';
  if (!_discOpenSections[key]) return '<div class="disc-loading">Click to load...</div>';

  const cached = _discOpenSections[key + '-data'];
  if (!cached) return '<div class="disc-loading">Loading...</div>';

  if (!Array.isArray(cached) || cached.length === 0) {
    return '<div style="font-size:12px;color:var(--text-secondary)">No metrics data yet</div>';
  }

  let html = '<table class="disc-metrics-table">';
  html += '<thead><tr><th>Tool</th><th>Calls</th><th>Errors</th><th>Avg Latency</th></tr></thead>';
  html += '<tbody>';
  cached.forEach((m) => {
    html += '<tr>';
    html += '<td>' + _esc(m.tool || m.tool_name || m.name || '') + '</td>';
    html += '<td>' + (m.calls || m.call_count || 0) + '</td>';
    html += '<td>' + (m.errors || m.error_count || 0) + '</td>';
    html += '<td>' + (m.avg_latency != null ? m.avg_latency.toFixed(0) + 'ms' : '-') + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

// -------------------------------------------------------------------------
// Config section content
// -------------------------------------------------------------------------

function _discRenderConfigContent(server) {
  let html = '<div class="disc-config-form">';
  html += '<div class="disc-config-field"><label>Description</label>';
  html +=
    '<input type="text" data-config-input="desc-' +
    server.id +
    '" value="' +
    _esc(server.description || '').replace(/"/g, '&quot;') +
    '" /></div>';
  html += '<div class="disc-config-field"><label>Command</label>';
  html +=
    '<input type="text" data-config-input="cmd-' +
    server.id +
    '" value="' +
    _esc(server.command || '').replace(/"/g, '&quot;') +
    '" /></div>';
  html += '<div class="disc-config-field"><label>Args (comma-separated)</label>';
  html +=
    '<input type="text" data-config-input="args-' +
    server.id +
    '" value="' +
    _esc((server.args || []).join(', ')).replace(/"/g, '&quot;') +
    '" /></div>';
  html += '<div class="disc-config-field"><label>Env vars (KEY=VALUE per line)</label>';
  html += '<textarea data-config-input="env-' + server.id + '">';
  html += _esc(
    Object.entries(server.env || {})
      .map((e) => e[0] + '=' + e[1])
      .join('\n'),
  );
  html += '</textarea></div>';
  html +=
    '<button class="disc-config-save" data-action="save-config" data-server-id="' +
    server.id +
    '">Save Config</button>';
  html += '</div>';
  return html;
}

// -------------------------------------------------------------------------
// Server card rendering
// -------------------------------------------------------------------------

function _renderServerCard(server) {
  const statusClass = server.active ? (server.health_status === 'unhealthy' ? 'unhealthy' : 'active') : 'inactive';
  const statusLabel = server.active ? (server.health_status === 'unhealthy' ? 'Unhealthy' : 'Active') : 'Inactive';
  const healthColor =
    statusClass === 'active'
      ? HEALTH_COLORS.healthy
      : statusClass === 'unhealthy'
        ? HEALTH_COLORS.unhealthy
        : HEALTH_COLORS.unknown;

  let html = '<div class="disc-card" data-server-id="' + _esc(server.id) + '">';

  // Header: name + status
  html += '<div class="disc-card-header">';
  html +=
    '<div style="display:flex;align-items:center;gap:8px"><span class="disc-card-name">' +
    _esc(server.name) +
    '</span></div>';
  html += '<div class="disc-card-status">';
  if (server.error_count > 0) {
    html +=
      '<span class="disc-error-count">' +
      server.error_count +
      ' error' +
      (server.error_count > 1 ? 's' : '') +
      '</span>';
  }
  html +=
    '<span class="disc-status-label"><span class="disc-health-dot" style="background:' +
    healthColor +
    '"></span> ' +
    statusLabel +
    '</span>';
  html += '</div></div>';

  // Description
  if (server.description) {
    html += '<div class="disc-card-desc">' + _esc(server.description) + '</div>';
  }

  // Tags
  const tags = server.tags || [];
  if (tags.length > 0) {
    html += '<div class="disc-tags">';
    tags.forEach((t) => {
      html += '<span class="disc-tag">' + _esc(t) + '</span>';
    });
    html += '</div>';
  }

  // Meta: source, transport, URL
  html += '<div class="disc-card-meta">';
  html += '<span>' + _esc(server.source || 'local') + '</span>';
  html += '<span>' + _transportLabel(server.transport) + '</span>';
  if (server.transport && server.transport !== 'stdio' && server.homepage) {
    html += '<span style="font-size:11px;color:var(--text-secondary)">' + _esc(server.homepage) + '</span>';
  }
  html += '</div>';

  // Tools section (grid layout with name + description)
  if (server.tools && server.tools.length > 0) {
    html += '<div class="disc-tool-section">';
    html += '<div class="disc-tool-section-title">Tools (' + server.tools.length + ')</div>';
    html += '<div class="disc-tool-grid">';
    server.tools.forEach((t) => {
      const name = typeof t === 'string' ? t : t.name || '';
      const desc = typeof t === 'object' ? t.description || '' : '';
      html += '<div class="disc-tool-item">';
      html += '<span class="disc-tool-name">' + _esc(name) + '</span>';
      html += '<span class="disc-tool-desc">' + _esc(desc) + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // Action buttons
  html += '<div class="disc-card-actions">';
  if (server.active) {
    html +=
      '<button class="disc-btn disc-btn-deactivate" data-action="deactivate" data-id="' +
      _esc(server.id) +
      '"><span class="material-symbols-outlined">stop_circle</span>Deactivate</button>';
  } else {
    html +=
      '<button class="disc-btn disc-btn-activate" data-action="activate" data-id="' +
      _esc(server.id) +
      '"><span class="material-symbols-outlined">play_circle</span>Activate</button>';
  }
  html +=
    '<button class="disc-btn disc-btn-health" data-action="health" data-id="' +
    _esc(server.id) +
    '"><span class="material-symbols-outlined">favorite</span>Check Health</button>';
  html +=
    '<button class="disc-btn disc-btn-delete" data-action="delete" data-id="' +
    _esc(server.id) +
    '"><span class="material-symbols-outlined">delete</span>Delete</button>';
  html += '</div>';

  // Expandable sections: Secrets, Metrics, Config
  html += _discRenderSection(server.id, 'secrets', 'Secrets', () => _discRenderSecretsContent(server));
  html += _discRenderSection(server.id, 'metrics', 'Metrics', () => _discRenderMetricsContent(server));
  html += _discRenderSection(server.id, 'config', 'Config', () => _discRenderConfigContent(server));

  html += '</div>';
  return html;
}

// -------------------------------------------------------------------------
// Servers tab
// -------------------------------------------------------------------------

function _renderServers() {
  if (_discServers.length === 0) {
    return '<div class="disc-empty"><span class="material-symbols-outlined">dns</span><span>No servers registered</span><span class="disc-hint">Use registry_install or browse the marketplace</span></div>';
  }

  // Sort: active first, then by name
  const sorted = [..._discServers].sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  return sorted.map(_renderServerCard).join('');
}

// -------------------------------------------------------------------------
// Browse tab
// -------------------------------------------------------------------------

function _renderBrowse() {
  let html = '<div class="disc-search-bar">';
  html += '<span class="material-symbols-outlined">search</span>';
  html += '<input type="text" placeholder="Search MCP servers..." value="' + _esc(_discBrowseQuery) + '" />';
  html += '</div>';

  if (_discBrowseResults.length === 0 && _discBrowseQuery) {
    html +=
      '<div class="disc-empty"><span class="material-symbols-outlined">search_off</span><span>No results in MCP registry</span>';
    html += '<button class="disc-hint-link" data-action="show-npm-form">Can\'t find it? Install from npm</button>';
    html += '<div class="disc-npm-form" style="display:none">';
    html +=
      '<input type="text" data-npm-input placeholder="npm package name (e.g. @modelcontextprotocol/server-everything)" />';
    html +=
      '<button class="disc-btn-install" data-action="install-npm"><span class="material-symbols-outlined" style="font-size:14px">download</span> Install</button>';
    html += '</div></div>';
  } else if (_discBrowseResults.length === 0) {
    html +=
      '<div class="disc-empty"><span class="material-symbols-outlined">explore</span><span>Search the official MCP registry</span><span class="disc-hint">Type a query above to discover servers</span></div>';
  } else {
    const installedNames = _discServers.map((s) => s.name);

    _discBrowseResults.forEach((s, idx) => {
      html += '<div class="disc-browse-card">';

      // Header: name + version badge + install button
      html += '<div class="disc-browse-header">';
      html += '<span class="disc-browse-name">' + _esc(s.name || s.title) + '</span>';
      html += '<div class="disc-browse-right">';

      if (s.version) {
        html += '<span class="disc-version-badge">' + _esc(s.version) + '</span>';
      }

      // Transport badges (color-coded)
      const pkgs = s.packages || [];
      pkgs.forEach((p) => {
        const rt = p.runtime || p.transport || 'stdio';
        const color = TRANSPORT_COLORS[rt] || TRANSPORT_COLORS.stdio;
        html +=
          '<span class="disc-transport-badge" style="border-color:' +
          color +
          ';color:' +
          color +
          '">' +
          _esc(rt) +
          '</span>';
      });

      // Install / Installed button
      const safeName = (s.name || '').replace(/\//g, '-');
      const isInstalled = installedNames.indexOf(safeName) !== -1 || installedNames.indexOf(s.name) !== -1;

      if (isInstalled) {
        html +=
          '<button class="disc-btn-install disc-installed" disabled><span class="material-symbols-outlined" style="font-size:14px">check_circle</span>Installed</button>';
      } else {
        html +=
          '<button class="disc-btn-install" data-action="install-browse" data-browse-idx="' +
          idx +
          '"><span class="material-symbols-outlined" style="font-size:14px">download</span>Install</button>';
      }

      html += '</div></div>';

      // Description
      if (s.description) {
        html += '<div class="disc-browse-desc">' + _esc(s.description) + '</div>';
      }

      // Package transport badges below description
      if (pkgs.length > 0) {
        html += '<div class="disc-tags">';
        pkgs.forEach((p) => {
          const rt = p.runtime || p.transport || 'stdio';
          const color = TRANSPORT_COLORS[rt] || TRANSPORT_COLORS.stdio;
          html +=
            '<span class="disc-tag" style="border:1px solid ' +
            color +
            ';color:' +
            color +
            '">' +
            _esc(rt) +
            ': ' +
            _esc(p.name) +
            '</span>';
        });
        html += '</div>';
      }

      // Repository link
      if (s.repository) {
        html += '<div class="disc-browse-repo">';
        html += '<span class="material-symbols-outlined" style="font-size:16px">code</span>';
        html += '<a href="' + _esc(s.repository) + '" target="_blank">' + _esc(s.repository) + '</a>';
        html += '</div>';
      }

      html += '</div>';
    });
  }

  return html;
}

// -------------------------------------------------------------------------
// Event binding for server cards
// -------------------------------------------------------------------------

function _bindServerActions(content) {
  // Section toggles
  content.querySelectorAll('[data-section-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', async (e) => {
      e.stopPropagation();
      const serverId = toggle.dataset.serverId;
      const name = toggle.dataset.sectionName;
      const key = serverId + '-' + name;
      _discOpenSections[key] = !_discOpenSections[key];

      if (_discOpenSections[key]) {
        // Load data when opening
        if (name === 'secrets') {
          try {
            const data = await agentDesk.discover.secrets(Number(serverId));
            _discOpenSections[key + '-data'] = Array.isArray(data) ? data : [];
          } catch {
            _discOpenSections[key + '-data'] = [];
          }
        } else if (name === 'metrics') {
          try {
            const data = await agentDesk.discover.metrics(Number(serverId));
            _discOpenSections[key + '-data'] = Array.isArray(data) ? data : data?.tools || [];
          } catch {
            _discOpenSections[key + '-data'] = [];
          }
        }
      }
      _renderDiscTab();
    });
  });

  // Action buttons (activate, deactivate, delete, health)
  content.querySelectorAll('[data-action]').forEach((btn) => {
    const action = btn.dataset.action;
    if (action === 'activate' || action === 'deactivate' || action === 'delete' || action === 'health') {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);

        switch (action) {
          case 'activate': {
            try {
              const result = await agentDesk.discover.activate(id);
              if (result) {
                _discToast('Server activated', 'success');
              } else {
                _discToast('Activation failed', 'error');
              }
            } catch (err) {
              _discToast('Activation failed: ' + (err.message || err), 'error');
            }
            break;
          }
          case 'deactivate': {
            try {
              await agentDesk.discover.deactivate(id);
              _discToast('Server deactivated', 'success');
            } catch (err) {
              _discToast('Deactivate failed: ' + (err.message || err), 'error');
            }
            break;
          }
          case 'delete': {
            if (!confirm('Delete this server?')) return;
            try {
              await agentDesk.discover.delete(id);
              _discToast('Server deleted', 'success');
            } catch (err) {
              _discToast('Delete failed: ' + (err.message || err), 'error');
            }
            break;
          }
          case 'health': {
            try {
              const result = await agentDesk.discover.health(id);
              const status = result?.health_status || result?.status || 'unknown';
              _discToast('Health check: ' + status, status === 'healthy' ? 'success' : 'error');
            } catch {
              _discToast('Health check failed', 'error');
            }
            break;
          }
        }

        // Refresh servers
        try {
          const servers = await agentDesk.discover.servers();
          _discServers = servers || [];
          _renderDiscTab();
        } catch {
          /* ignore */
        }
      });
    }

    // Secret delete
    if (action === 'delete-secret') {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const _sid = btn.dataset.serverId;
        const secretKey = btn.dataset.secretKey;
        if (!confirm('Delete secret "' + secretKey + '"?')) return;
        _discToast('Secret deletion requires server-side support (server ' + _sid + ')', 'error');
      });
    }

    // Secret add
    if (action === 'add-secret') {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const serverId = btn.dataset.serverId;
        const keyInput = content.querySelector('[data-secret-input="key-' + serverId + '"]');
        const valInput = content.querySelector('[data-secret-input="val-' + serverId + '"]');
        if (!keyInput || !valInput) return;
        const key = keyInput.value.trim();
        const value = valInput.value;
        if (!key || !value) return;
        _discToast('Secret save requires server-side support', 'error');
      });
    }

    // Config save
    if (action === 'save-config') {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const serverId = btn.dataset.serverId;
        const desc = content.querySelector('[data-config-input="desc-' + serverId + '"]');
        const cmd = content.querySelector('[data-config-input="cmd-' + serverId + '"]');
        const argsEl = content.querySelector('[data-config-input="args-' + serverId + '"]');
        const envEl = content.querySelector('[data-config-input="env-' + serverId + '"]');
        if (!desc || !cmd || !argsEl || !envEl) return;
        _discToast('Config save requires server-side support', 'error');
      });
    }

    // Show npm form
    if (action === 'show-npm-form') {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const form = btn.nextElementSibling;
        if (form) {
          form.style.display = form.style.display === 'none' ? 'flex' : 'none';
          btn.style.display = 'none';
        }
      });
    }

    // Install from npm
    if (action === 'install-npm') {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const input = content.querySelector('[data-npm-input]');
        if (!input) return;
        const pkg = input.value.trim();
        if (!pkg) return;
        _discToast('npm install requires server-side support', 'error');
      });
    }

    // Install from browse
    if (action === 'install-browse') {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.browseIdx);
        const server = _discBrowseResults[idx];
        if (!server) return;

        btn.disabled = true;
        btn.innerHTML =
          '<span class="material-symbols-outlined" style="font-size:14px">hourglass_top</span>Installing...';

        // Build install data -- for browse results we attempt to construct what we can
        _discToast('Browse install requires server-side support', 'error');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">download</span>Install';
      });
    }
  });
}

// -------------------------------------------------------------------------
// Browse tab event binding
// -------------------------------------------------------------------------

function _bindBrowseActions(content) {
  // Search input with debounce
  const input = content.querySelector('.disc-search-bar input');
  if (input) {
    input.addEventListener('input', () => {
      clearTimeout(_discSearchTimeout);
      const q = input.value.trim();
      _discBrowseQuery = q;
      if (!q) {
        _discBrowseResults = [];
        _renderDiscTab();
        return;
      }
      _discSearchTimeout = setTimeout(() => {
        _discFetchBrowse(q);
      }, 400);
    });
    // Focus the input
    input.focus();
    // Position cursor at end
    input.setSelectionRange(input.value.length, input.value.length);
  }

  // Bind browse card actions (install, npm form, etc.)
  _bindServerActions(content);
}

async function _discFetchBrowse(query) {
  const content = _discRoot?.querySelector('.disc-content');
  if (content) {
    content.innerHTML = '<div class="disc-loading">Searching...</div>';
  }
  try {
    const result = await agentDesk.discover.browse(query);
    _discBrowseResults = result?.servers || result || [];
    _renderDiscTab();
  } catch {
    if (content) {
      content.innerHTML =
        '<div class="disc-empty"><span class="material-symbols-outlined">error</span><span>Failed to fetch from registry</span></div>';
    }
  }
}

// -------------------------------------------------------------------------
// Tab rendering
// -------------------------------------------------------------------------

function _renderDiscTab() {
  const content = _discRoot?.querySelector('.disc-content');
  if (!content) return;

  switch (_discActiveTab) {
    case 'servers':
      content.innerHTML = _renderServers();
      _bindServerActions(content);
      break;

    case 'browse':
      content.innerHTML = _renderBrowse();
      _bindBrowseActions(content);
      break;
  }

  const countEl = _discRoot?.querySelector('.disc-badge-count');
  if (countEl) {
    countEl.textContent = String(_discServers.length);
  }
}

// -------------------------------------------------------------------------
// Connection status
// -------------------------------------------------------------------------

function _setDiscConnStatus(connected) {
  _discConnected = connected;
  const dot = _discRoot?.querySelector('.disc-conn-dot');
  const label = _discRoot?.querySelector('.disc-conn-label');
  if (dot) {
    dot.className = 'disc-conn-dot ' + (connected ? 'connected' : 'disconnected');
  }
  if (label) {
    label.textContent = connected ? 'Connected' : 'Disconnected';
  }
}

// -------------------------------------------------------------------------
export function initDiscoverView(container) {
  const style = document.createElement('style');
  style.id = 'discover-view-styles';
  style.textContent = _discStyles();
  document.head.appendChild(style);

  _discRoot = document.createElement('div');
  _discRoot.className = 'disc-view';

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'disc-tabs';
  DISC_TABS.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'disc-tab' + (t.id === _discActiveTab ? ' active' : '');
    btn.dataset.tab = t.id;
    let inner = '<span class="material-symbols-outlined">' + t.icon + '</span>' + t.label;
    if (t.id === 'servers') {
      inner += '<span class="disc-badge-count">' + _discServers.length + '</span>';
    }
    btn.innerHTML = inner;
    btn.addEventListener('click', () => {
      _discActiveTab = t.id;
      tabBar.querySelectorAll('.disc-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === t.id));
      _renderDiscTab();
    });
    tabBar.appendChild(btn);
  });

  // Connection status indicator
  const connStatus = document.createElement('div');
  connStatus.className = 'disc-conn-status';
  connStatus.innerHTML =
    '<span class="disc-conn-dot disconnected"></span><span class="disc-conn-label">Connecting...</span>';
  tabBar.appendChild(connStatus);

  const content = document.createElement('div');
  content.className = 'disc-content';

  _discRoot.appendChild(tabBar);
  _discRoot.appendChild(content);
  container.appendChild(_discRoot);

  // Initial load
  agentDesk.discover
    .getState()
    .then((data) => {
      if (data && data.servers) {
        _discServers = data.servers;
        _setDiscConnStatus(true);
        _renderDiscTab();
      }
    })
    .catch(() => {
      _setDiscConnStatus(false);
      _renderDiscTab();
    });

  // Subscribe to updates
  _discCleanup = agentDesk.discover.onUpdate((data) => {
    _setDiscConnStatus(true);
    if (data && data.servers) {
      _discServers = data.servers;
      if (_discActiveTab === 'servers') _renderDiscTab();
      // Also update badge count even on browse tab
      const countEl = _discRoot?.querySelector('.disc-badge-count');
      if (countEl) countEl.textContent = String(_discServers.length);
    }
  });
}

export function destroyDiscoverView() {
  if (_discCleanup) {
    _discCleanup();
    _discCleanup = null;
  }
  clearTimeout(_discSearchTimeout);
  const style = document.getElementById('discover-view-styles');
  if (style) style.remove();
  if (_discRoot) {
    _discRoot.remove();
    _discRoot = null;
  }
  _discOpenSections = {};
  _discBrowseResults = [];
  _discBrowseQuery = '';
}
