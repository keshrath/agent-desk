// =============================================================================
// Agent Desk — Native Comm View
// =============================================================================
// 6 tabs: Overview, Agents, Messages, Channels, State, Activity Feed
// Uses window.agentDesk.comm.* IPC calls
// =============================================================================

'use strict';

let _commRoot = null;
let _commCleanup = null;
let _commActiveTab = 'overview';
let _commData = { agents: [], messages: [], channels: [], state: [], feed: [] };

const COMM_TABS = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'agents', label: 'Agents', icon: 'people' },
  { id: 'messages', label: 'Messages', icon: 'chat' },
  { id: 'channels', label: 'Channels', icon: 'forum' },
  { id: 'state', label: 'State', icon: 'data_object' },
  { id: 'feed', label: 'Activity', icon: 'rss_feed' },
];

function _commStyles() {
  return `
    .comm-view { display: flex; flex-direction: column; height: 100%; font-family: 'Inter', sans-serif; color: var(--text, #c8d1da); background: var(--bg, #1a1d23); }
    .comm-tabs { display: flex; gap: 2px; padding: 8px 12px 0; border-bottom: 1px solid var(--border, #2d323b); background: var(--bg-surface, #21252b); flex-shrink: 0; }
    .comm-tab { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; background: transparent; color: var(--text-secondary, #8b949e); cursor: pointer; font-size: 13px; font-weight: 500; border-bottom: 2px solid transparent; transition: all 0.15s; border-radius: 6px 6px 0 0; }
    .comm-tab:hover { color: var(--text, #c8d1da); background: var(--bg-hover, #282d35); }
    .comm-tab.active { color: var(--accent, #5d8da8); border-bottom-color: var(--accent, #5d8da8); }
    .comm-tab .material-symbols-outlined { font-size: 18px; }
    .comm-content { flex: 1; overflow-y: auto; padding: 16px; }
    .comm-card { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 14px; margin-bottom: 10px; }
    .comm-card-title { font-weight: 600; font-size: 14px; margin-bottom: 6px; color: var(--text, #c8d1da); }
    .comm-card-meta { font-size: 12px; color: var(--text-secondary, #8b949e); }
    .comm-stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .comm-stat { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 16px; text-align: center; }
    .comm-stat-value { font-size: 28px; font-weight: 700; color: var(--accent, #5d8da8); }
    .comm-stat-label { font-size: 12px; color: var(--text-secondary, #8b949e); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    .comm-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .comm-badge-online { background: rgba(46, 160, 67, 0.2); color: #3fb950; }
    .comm-badge-offline { background: rgba(139, 148, 158, 0.2); color: #8b949e; }
    .comm-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; color: var(--text-secondary, #8b949e); }
    .comm-empty .material-symbols-outlined { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
    .comm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .comm-table th { text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary, #8b949e); border-bottom: 1px solid var(--border, #2d323b); }
    .comm-table td { padding: 8px 12px; border-bottom: 1px solid var(--border, #2d323b); }
    .comm-msg-content { font-family: 'JetBrains Mono', monospace; font-size: 12px; white-space: pre-wrap; word-break: break-word; max-height: 80px; overflow: hidden; }
    .comm-section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary, #8b949e); margin: 16px 0 8px; }
    .comm-kv { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; }
    .comm-kv-key { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--accent, #5d8da8); min-width: 120px; }
    .comm-kv-val { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text, #c8d1da); word-break: break-all; }
    .comm-feed-item { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid var(--border, #2d323b); }
    .comm-feed-icon { flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; background: var(--accent-dim, rgba(93,141,168,0.15)); display: flex; align-items: center; justify-content: center; }
    .comm-feed-icon .material-symbols-outlined { font-size: 16px; color: var(--accent, #5d8da8); }
    .comm-feed-text { flex: 1; font-size: 13px; }
    .comm-feed-time { font-size: 11px; color: var(--text-secondary, #8b949e); }
  `;
}

function _timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

function _renderCommOverview() {
  const d = _commData;
  const onlineCount = d.agents.filter((a) => a.status === 'online').length;
  return `
    <div class="comm-stat-grid">
      <div class="comm-stat"><div class="comm-stat-value">${d.agents.length}</div><div class="comm-stat-label">Agents</div></div>
      <div class="comm-stat"><div class="comm-stat-value">${onlineCount}</div><div class="comm-stat-label">Online</div></div>
      <div class="comm-stat"><div class="comm-stat-value">${d.messages.length}</div><div class="comm-stat-label">Messages</div></div>
      <div class="comm-stat"><div class="comm-stat-value">${d.channels.length}</div><div class="comm-stat-label">Channels</div></div>
      <div class="comm-stat"><div class="comm-stat-value">${d.state.length}</div><div class="comm-stat-label">State Entries</div></div>
      <div class="comm-stat"><div class="comm-stat-value">${d.feed.length}</div><div class="comm-stat-label">Feed Events</div></div>
    </div>
    <div class="comm-section-title">Online Agents</div>
    ${
      onlineCount === 0
        ? '<div class="comm-empty"><span class="material-symbols-outlined">group_off</span><span>No agents online</span></div>'
        : d.agents
            .filter((a) => a.status === 'online')
            .map(
              (a) =>
                `<div class="comm-card"><div class="comm-card-title">${_esc(a.name)}</div><div class="comm-card-meta">${_esc(a.status_text || '')} &middot; ${_timeAgo(a.last_seen)}</div></div>`,
            )
            .join('')
    }
    <div class="comm-section-title">Recent Activity</div>
    ${_renderFeedItems(d.feed.slice(0, 10))}
  `;
}

function _renderCommAgents() {
  if (_commData.agents.length === 0) {
    return '<div class="comm-empty"><span class="material-symbols-outlined">people</span><span>No agents registered</span></div>';
  }
  return `<table class="comm-table"><thead><tr><th>Name</th><th>Status</th><th>Status Text</th><th>PID</th><th>Last Seen</th></tr></thead><tbody>${_commData.agents
    .map(
      (a) =>
        `<tr><td>${_esc(a.name)}</td><td><span class="comm-badge ${a.status === 'online' ? 'comm-badge-online' : 'comm-badge-offline'}">${a.status}</span></td><td>${_esc(a.status_text || '')}</td><td style="font-family:'JetBrains Mono',monospace;font-size:12px">${a.pid || ''}</td><td>${_timeAgo(a.last_seen)}</td></tr>`,
    )
    .join('')}</tbody></table>`;
}

function _renderCommMessages() {
  if (_commData.messages.length === 0) {
    return '<div class="comm-empty"><span class="material-symbols-outlined">chat</span><span>No messages</span></div>';
  }
  return _commData.messages
    .slice(0, 50)
    .map(
      (m) =>
        `<div class="comm-card"><div class="comm-card-title">${_esc(m.sender || 'unknown')} &rarr; ${_esc(m.recipient || m.channel || 'broadcast')}</div><div class="comm-msg-content">${_esc(m.content || '')}</div><div class="comm-card-meta">${_timeAgo(m.created_at)}</div></div>`,
    )
    .join('');
}

function _renderCommChannels() {
  if (_commData.channels.length === 0) {
    return '<div class="comm-empty"><span class="material-symbols-outlined">forum</span><span>No channels</span></div>';
  }
  return `<table class="comm-table"><thead><tr><th>Channel</th><th>Created</th></tr></thead><tbody>${_commData.channels
    .map((c) => `<tr><td>${_esc(c.name)}</td><td>${_timeAgo(c.created_at)}</td></tr>`)
    .join('')}</tbody></table>`;
}

function _renderCommState() {
  if (_commData.state.length === 0) {
    return '<div class="comm-empty"><span class="material-symbols-outlined">data_object</span><span>No state entries</span></div>';
  }
  return _commData.state
    .map(
      (s) =>
        `<div class="comm-kv"><span class="comm-kv-key">${_esc(s.namespace || '')}/${_esc(s.key || '')}</span><span class="comm-kv-val">${_esc(typeof s.value === 'string' ? s.value : JSON.stringify(s.value))}</span></div>`,
    )
    .join('');
}

function _renderFeedItems(items) {
  if (!items || items.length === 0) {
    return '<div class="comm-empty"><span class="material-symbols-outlined">rss_feed</span><span>No activity</span></div>';
  }
  const iconMap = {
    agent_registered: 'person_add',
    agent_unregistered: 'person_remove',
    message_sent: 'send',
    channel_created: 'add_circle',
    channel_joined: 'group_add',
    state_set: 'edit',
    state_deleted: 'delete',
  };
  return items
    .map(
      (f) =>
        `<div class="comm-feed-item"><div class="comm-feed-icon"><span class="material-symbols-outlined">${iconMap[f.event_type] || 'info'}</span></div><div class="comm-feed-text">${_esc(f.summary || f.event_type || '')}<div class="comm-feed-time">${_timeAgo(f.created_at)}</div></div></div>`,
    )
    .join('');
}

function _renderCommFeed() {
  return _renderFeedItems(_commData.feed);
}

function _esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function _renderCommTab() {
  const content = _commRoot?.querySelector('.comm-content');
  if (!content) return;
  switch (_commActiveTab) {
    case 'overview':
      content.innerHTML = _renderCommOverview();
      break;
    case 'agents':
      content.innerHTML = _renderCommAgents();
      break;
    case 'messages':
      content.innerHTML = _renderCommMessages();
      break;
    case 'channels':
      content.innerHTML = _renderCommChannels();
      break;
    case 'state':
      content.innerHTML = _renderCommState();
      break;
    case 'feed':
      content.innerHTML = _renderCommFeed();
      break;
  }
}

export function initCommView(container) {
  // Inject styles
  const style = document.createElement('style');
  style.id = 'comm-view-styles';
  style.textContent = _commStyles();
  document.head.appendChild(style);

  // Build DOM
  _commRoot = document.createElement('div');
  _commRoot.className = 'comm-view';

  const tabBar = document.createElement('div');
  tabBar.className = 'comm-tabs';
  COMM_TABS.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'comm-tab' + (t.id === _commActiveTab ? ' active' : '');
    btn.dataset.tab = t.id;
    btn.innerHTML = `<span class="material-symbols-outlined">${t.icon}</span>${t.label}`;
    btn.addEventListener('click', () => {
      _commActiveTab = t.id;
      tabBar.querySelectorAll('.comm-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === t.id));
      _renderCommTab();
    });
    tabBar.appendChild(btn);
  });

  const content = document.createElement('div');
  content.className = 'comm-content';

  _commRoot.appendChild(tabBar);
  _commRoot.appendChild(content);
  container.appendChild(_commRoot);

  // Initial load
  agentDesk.comm.getState().then((data) => {
    if (data) {
      _commData = data;
      _renderCommTab();
    }
  });

  // Subscribe to updates
  _commCleanup = agentDesk.comm.onUpdate((data) => {
    if (data) {
      _commData = data;
      _renderCommTab();
    }
  });
}

export function destroyCommView() {
  if (_commCleanup) {
    _commCleanup();
    _commCleanup = null;
  }
  const style = document.getElementById('comm-view-styles');
  if (style) style.remove();
  if (_commRoot) {
    _commRoot.remove();
    _commRoot = null;
  }
}
