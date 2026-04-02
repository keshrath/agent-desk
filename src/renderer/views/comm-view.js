// =============================================================================
// Agent Desk — Native Comm View
// =============================================================================
// 6 tabs: Overview, Agents, Messages, Channels, State, Activity Feed
// Uses window.agentDesk.comm.* IPC calls
// Feature-parity with standalone agent-comm dashboard
// =============================================================================

'use strict';

let _commRoot = null;
let _commCleanup = null;
let _commActiveTab = 'overview';
let _commData = { agents: [], messages: [], channels: [], state: [], feed: [], branches: [], messageCount: 0 };
let _commAgentNameCache = {};
let _commStateFilter = '';
let _commFeedTypeFilter = '';
let _commSelectedMsgId = null;
let _commMsgFilter = { agent: null, channel: null };

const COMM_TABS = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'agents', label: 'Agents', icon: 'smart_toy' },
  { id: 'messages', label: 'Messages', icon: 'chat' },
  { id: 'channels', label: 'Channels', icon: 'forum' },
  { id: 'state', label: 'State', icon: 'database' },
  { id: 'feed', label: 'Activity', icon: 'rss_feed' },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function _commStyles() {
  return `
    .comm-view { display: flex; flex-direction: column; height: 100%; font-family: 'Inter', sans-serif; color: var(--text, #c8d1da); background: var(--bg, #1a1d23); }
    .comm-tabs { display: flex; gap: 2px; padding: 8px 12px 0; border-bottom: 1px solid var(--border, #2d323b); background: var(--bg-surface, #21252b); flex-shrink: 0; }
    .comm-tab { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; background: transparent; color: var(--text-secondary, #8b949e); cursor: pointer; font-size: 13px; font-weight: 500; border-bottom: 2px solid transparent; transition: all 0.15s; border-radius: 6px 6px 0 0; position: relative; }
    .comm-tab:hover { color: var(--text, #c8d1da); background: var(--bg-hover, #282d35); }
    .comm-tab.active { color: var(--accent, #5d8da8); border-bottom-color: var(--accent, #5d8da8); }
    .comm-tab .material-symbols-outlined { font-size: 18px; }
    .comm-tab-badge { font-size: 10px; min-width: 18px; padding: 0 5px; height: 16px; line-height: 16px; text-align: center; border-radius: 8px; background: var(--accent, #5d8da8); color: #fff; font-weight: 600; margin-left: 2px; }
    .comm-tab-badge.zero { opacity: 0.4; }
    .comm-content { flex: 1; overflow-y: auto; padding: 16px; }

    /* Stat cards */
    .comm-stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .comm-stat { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 12px; padding: 16px; text-align: center; cursor: pointer; transition: box-shadow 0.15s, border-color 0.15s; }
    .comm-stat:hover { border-color: var(--accent, #5d8da8); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
    .comm-stat-icon { font-size: 24px; color: var(--accent, #5d8da8); margin-bottom: 4px; }
    .comm-stat-value { font-size: 28px; font-weight: 700; color: var(--accent, #5d8da8); }
    .comm-stat-label { font-size: 12px; color: var(--text-secondary, #8b949e); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

    /* Cards */
    .comm-card { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 12px; padding: 14px; margin-bottom: 10px; transition: border-color 0.15s; }
    .comm-card:hover { border-color: var(--border-light, #3d444d); }
    .comm-card-title { font-weight: 600; font-size: 14px; margin-bottom: 6px; color: var(--text, #c8d1da); display: flex; align-items: center; gap: 8px; }
    .comm-card-meta { font-size: 12px; color: var(--text-secondary, #8b949e); margin-top: 2px; }
    .comm-card-action { font-size: 12px; color: var(--accent, #5d8da8); cursor: pointer; margin-top: 8px; }
    .comm-card-action:hover { text-decoration: underline; }

    /* Panel sections */
    .comm-panel { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .comm-panel-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; color: var(--text, #c8d1da); }
    .comm-panel-title .material-symbols-outlined { font-size: 18px; color: var(--accent, #5d8da8); }

    /* Badges */
    .comm-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .comm-badge-online { background: rgba(46, 160, 67, 0.2); color: var(--green, #3fb950); }
    .comm-badge-offline { background: rgba(139, 148, 158, 0.2); color: var(--text-secondary, #8b949e); }

    /* Status dot */
    .comm-status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .comm-status-dot.online { background: var(--green, #3fb950); box-shadow: 0 0 6px rgba(63, 185, 80, 0.4); }
    .comm-status-dot.offline { background: var(--text-secondary, #8b949e); }

    /* Heartbeat freshness */
    .hb-fresh { color: var(--green, #3fb950); }
    .hb-warm { color: var(--yellow, #d29922); }
    .hb-stale { color: var(--red, #f85149); }

    /* Stuck badge */
    .comm-stuck-badge { display: inline-flex; align-items: center; gap: 2px; font-size: 11px; color: var(--orange, #db6d28); background: rgba(219,109,40,0.15); padding: 1px 6px; border-radius: 4px; margin-left: 6px; }

    /* Capability tags */
    .comm-cap-tag { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 4px; margin: 2px 2px 0 0; background: rgba(93,141,168,0.15); color: var(--accent, #5d8da8); }

    /* Skill pills */
    .comm-skill-pill { display: inline-block; font-size: 11px; font-family: 'JetBrains Mono', monospace; padding: 2px 8px; border-radius: 10px; margin: 2px 2px 0 0; background: rgba(30,58,74,0.6); color: #8ec8e8; border: 1px solid rgba(44,80,96,0.6); cursor: default; }

    /* Status text */
    .comm-status-text { font-size: 12px; color: var(--accent, #5d8da8); font-style: italic; margin-top: 2px; }

    /* Agent card grid */
    .comm-agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }

    /* Channel card grid */
    .comm-channel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }

    /* Empty states */
    .comm-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; color: var(--text-secondary, #8b949e); }
    .comm-empty .material-symbols-outlined { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
    .comm-empty-hint { font-size: 12px; margin-top: 4px; opacity: 0.7; }

    /* Tables */
    .comm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .comm-table th { text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary, #8b949e); border-bottom: 1px solid var(--border, #2d323b); position: sticky; top: 0; background: var(--bg, #1a1d23); z-index: 1; }
    .comm-table td { padding: 8px 12px; border-bottom: 1px solid var(--border, #2d323b); }
    .comm-table .value-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'JetBrains Mono', monospace; font-size: 12px; }

    /* Messages */
    .comm-split-pane { display: flex; gap: 0; height: 100%; min-height: 400px; }
    .comm-split-left { flex: 1; min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--border, #2d323b); }
    .comm-split-right { width: 400px; min-width: 300px; overflow-y: auto; padding: 16px; }
    .comm-split-left-header { display: flex; align-items: center; gap: 8px; padding: 0 0 12px; flex-shrink: 0; }
    .comm-msg-search { flex: 1; background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 6px 10px 6px 32px; color: var(--text, #c8d1da); font-size: 13px; outline: none; }
    .comm-msg-search:focus { border-color: var(--accent, #5d8da8); }
    .comm-search-wrap { position: relative; flex: 1; }
    .comm-search-wrap .material-symbols-outlined { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 18px; color: var(--text-secondary, #8b949e); pointer-events: none; }
    .comm-msg-list { flex: 1; overflow-y: auto; }
    .comm-filter-chips { display: flex; gap: 6px; padding: 0 0 8px; flex-wrap: wrap; }
    .comm-filter-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(93,141,168,0.15); color: var(--accent, #5d8da8); }
    .comm-chip-remove { background: none; border: none; color: var(--text-secondary, #8b949e); cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px; }
    .comm-chip-remove:hover { color: var(--text, #c8d1da); }

    /* Message compact item */
    .comm-msg-compact { padding: 10px 12px; border-bottom: 1px solid var(--border, #2d323b); cursor: pointer; transition: background 0.1s; }
    .comm-msg-compact:hover { background: var(--bg-hover, #282d35); }
    .comm-msg-compact.selected { background: rgba(93,141,168,0.12); border-left: 3px solid var(--accent, #5d8da8); }
    .comm-msg-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .comm-msg-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--accent, #5d8da8); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .comm-msg-from { font-weight: 600; font-size: 13px; color: var(--text, #c8d1da); }
    .comm-msg-to { font-size: 12px; color: var(--text-secondary, #8b949e); }
    .comm-msg-time { font-size: 11px; color: var(--text-secondary, #8b949e); margin-left: auto; white-space: nowrap; }
    .comm-msg-preview { font-size: 12px; color: var(--text-secondary, #8b949e); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 32px; }
    .comm-msg-badges { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; margin-left: 32px; }
    .comm-msg-tag { display: inline-flex; align-items: center; gap: 2px; font-size: 10px; padding: 1px 6px; border-radius: 3px; background: var(--bg-hover, #282d35); color: var(--text-secondary, #8b949e); }
    .comm-msg-tag.importance-urgent { background: rgba(248,81,73,0.15); color: var(--red, #f85149); }
    .comm-msg-tag.importance-high { background: rgba(219,109,40,0.15); color: var(--orange, #db6d28); }
    .comm-msg-tag.importance-low { background: rgba(139,148,158,0.15); color: var(--text-secondary, #8b949e); }
    .comm-msg-tag.handoff-tag { background: rgba(219,109,40,0.15); color: var(--orange, #db6d28); }
    .comm-msg-tag.fwd-tag { background: rgba(93,141,168,0.15); color: var(--accent, #5d8da8); }
    .comm-msg-tag.branch-tag { background: rgba(142,154,208,0.15); color: var(--purple, #8e9ad0); }
    .comm-msg-tag.ack-tag { background: rgba(210,153,34,0.15); color: var(--yellow, #d29922); }

    /* Message detail pane */
    .comm-detail-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary, #8b949e); }
    .comm-detail-empty .material-symbols-outlined { font-size: 48px; margin-bottom: 8px; opacity: 0.4; }
    .comm-detail-card { padding: 0; }
    .comm-detail-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
    .comm-detail-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--accent, #5d8da8); color: #fff; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .comm-detail-sender-name { font-weight: 600; font-size: 14px; }
    .comm-detail-sender-meta { font-size: 12px; color: var(--text-secondary, #8b949e); }
    .comm-detail-badges { margin-left: auto; display: flex; gap: 4px; flex-wrap: wrap; }
    .comm-detail-body { font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; padding: 12px 0; border-top: 1px solid var(--border, #2d323b); }
    .comm-detail-thread { margin-top: 16px; border-top: 1px solid var(--border, #2d323b); padding-top: 12px; }
    .comm-detail-thread-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary, #8b949e); margin-bottom: 8px; }
    .comm-thread-msg { display: flex; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border, #2d323b); }
    .comm-thread-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--accent, #5d8da8); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .comm-thread-name { font-weight: 600; font-size: 12px; }
    .comm-thread-time { font-size: 11px; color: var(--text-secondary, #8b949e); margin-left: 8px; }
    .comm-thread-body { font-size: 12px; white-space: pre-wrap; word-break: break-word; margin-top: 4px; }
    .comm-reply-context { font-size: 12px; color: var(--text-secondary, #8b949e); padding: 6px 8px; background: var(--bg-hover, #282d35); border-radius: 6px; margin-bottom: 12px; cursor: pointer; border-left: 3px solid var(--accent, #5d8da8); }
    .comm-handoff-block { background: rgba(219,109,40,0.08); border: 1px solid rgba(219,109,40,0.25); border-radius: 8px; padding: 12px; margin: 8px 0; }
    .comm-handoff-header { font-size: 12px; font-weight: 600; color: var(--orange, #db6d28); margin-bottom: 8px; }
    .comm-fwd-block { background: rgba(93,141,168,0.08); border: 1px solid rgba(93,141,168,0.25); border-radius: 8px; padding: 12px; margin: 8px 0; }
    .comm-fwd-header { font-size: 12px; font-weight: 600; color: var(--accent, #5d8da8); margin-bottom: 8px; }
    .comm-branch-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border, #2d323b); }
    .comm-branch-item { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 0; }

    /* Section title */
    .comm-section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary, #8b949e); margin: 16px 0 8px; }

    /* Activity overview item */
    .comm-activity-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; }
    .comm-activity-item .comm-msg-from { flex-shrink: 0; }
    .comm-activity-item .comm-msg-time { font-size: 11px; color: var(--text-secondary, #8b949e); }

    /* Feed items */
    .comm-feed-item { display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid var(--border, #2d323b); }
    .comm-feed-icon { flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .comm-feed-icon .material-symbols-outlined { font-size: 18px; }
    .comm-feed-content { flex: 1; }
    .comm-feed-header { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
    .comm-feed-type { font-size: 12px; font-weight: 600; }
    .comm-feed-agent { font-size: 12px; color: var(--text-secondary, #8b949e); }
    .comm-feed-time { font-size: 11px; color: var(--text-secondary, #8b949e); margin-left: auto; }
    .comm-feed-target { font-size: 12px; color: var(--text, #c8d1da); }
    .comm-feed-preview { font-size: 12px; color: var(--text-secondary, #8b949e); margin-top: 2px; }
    .comm-feed-filter { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .comm-feed-select { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 6px 10px; color: var(--text, #c8d1da); font-size: 13px; outline: none; max-width: 200px; }
    .comm-feed-select:focus { border-color: var(--accent, #5d8da8); }

    /* State filter */
    .comm-state-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .comm-state-filter { flex: 1; max-width: 300px; background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 6px 10px 6px 32px; color: var(--text, #c8d1da); font-size: 13px; outline: none; }
    .comm-state-filter:focus { border-color: var(--accent, #5d8da8); }

    /* Mono text */
    .comm-mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  `;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function _esc(str) {
  if (!str && str !== 0) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function _escAttr(str) {
  return _esc(str).replace(/"/g, '&quot;');
}

function _timeAgo(ts) {
  if (!ts) return '';
  const dateStr = String(ts);
  const then = new Date(dateStr + (dateStr.includes('Z') || dateStr.includes('+') ? '' : 'Z')).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return seconds + 's ago';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

function _stripMd(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _parseCaps(a) {
  try {
    return typeof a.capabilities === 'string' ? JSON.parse(a.capabilities) : a.capabilities || [];
  } catch (_e) {
    return [];
  }
}

function _resolveAgentName(id) {
  if (!id) return 'unknown';
  const agents = _commData.agents || [];
  for (let i = 0; i < agents.length; i++) {
    if (agents[i].id === id) return agents[i].name;
  }
  if (_commAgentNameCache[id]) return _commAgentNameCache[id];
  return String(id).substring(0, 8);
}

function _resolveChannelName(id) {
  if (!id) return '#channel';
  const channels = _commData.channels || [];
  for (let i = 0; i < channels.length; i++) {
    if (channels[i].id === id) return '#' + channels[i].name;
  }
  return '#' + String(id).substring(0, 8);
}

function _heartbeatFreshness(dateStr) {
  if (!dateStr) return { text: '', cls: '' };
  const then = new Date(dateStr + (dateStr.includes('Z') || dateStr.includes('+') ? '' : 'Z')).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const text = _timeAgo(dateStr);
  const cls = seconds < 30 ? 'hb-fresh' : seconds < 120 ? 'hb-warm' : 'hb-stale';
  return { text, cls };
}

function _isAgentStuck(a) {
  if (a.status === 'offline') return false;
  if (!a.last_activity) return false;
  const actTime = new Date(
    a.last_activity + (a.last_activity.includes('Z') || a.last_activity.includes('+') ? '' : 'Z'),
  ).getTime();
  return Math.floor((Date.now() - actTime) / 60000) >= 10;
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

function _renderCommOverview() {
  const d = _commData;
  const onlineCount = d.agents.filter((a) => a.status !== 'offline').length;
  const msgCount = d.messageCount || d.messages.length;

  const agentsHtml =
    d.agents.length === 0
      ? '<div class="comm-empty"><span class="material-symbols-outlined">link_off</span><span>No agents online</span><div class="comm-empty-hint">Agents will appear when they register</div></div>'
      : d.agents
          .map((a) => {
            const caps = _parseCaps(a);
            return (
              '<div class="comm-activity-item">' +
              '<span class="comm-status-dot ' +
              _esc(a.status) +
              '"></span>' +
              '<span class="comm-msg-from">' +
              _esc(a.name) +
              '</span>' +
              (caps.length > 0
                ? ' <span style="font-size:11px;color:var(--text-secondary,#8b949e)">' +
                  caps.map((c) => _esc(c)).join(', ') +
                  '</span>'
                : '') +
              '<span class="comm-msg-time">' +
              _timeAgo(a.last_heartbeat) +
              '</span>' +
              '</div>'
            );
          })
          .join('');

  const msgs = d.messages || [];
  const activityHtml =
    msgs.length === 0
      ? '<div class="comm-empty"><span class="material-symbols-outlined">forum</span><span>No recent activity</span></div>'
      : msgs
          .slice(0, 15)
          .map((m) => {
            const stripped = _stripMd(m.content || '');
            let preview = stripped.substring(0, 80);
            if (stripped.length > 80) preview += '...';
            return (
              '<div class="comm-activity-item">' +
              '<span class="comm-msg-from">' +
              _esc(_resolveAgentName(m.from_agent)) +
              '</span> ' +
              '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
              _esc(preview) +
              '</span>' +
              '<span class="comm-msg-time">' +
              _timeAgo(m.created_at) +
              '</span>' +
              '</div>'
            );
          })
          .join('');

  return `
    <div class="comm-stat-grid">
      <div class="comm-stat" data-nav="agents">
        <span class="material-symbols-outlined comm-stat-icon">smart_toy</span>
        <div class="comm-stat-value">${onlineCount}</div>
        <div class="comm-stat-label">Agents Online</div>
      </div>
      <div class="comm-stat" data-nav="channels">
        <span class="material-symbols-outlined comm-stat-icon">forum</span>
        <div class="comm-stat-value">${d.channels.length}</div>
        <div class="comm-stat-label">Channels</div>
      </div>
      <div class="comm-stat" data-nav="messages">
        <span class="material-symbols-outlined comm-stat-icon">chat</span>
        <div class="comm-stat-value">${msgCount}</div>
        <div class="comm-stat-label">Messages</div>
      </div>
      <div class="comm-stat" data-nav="state">
        <span class="material-symbols-outlined comm-stat-icon">database</span>
        <div class="comm-stat-value">${d.state.length}</div>
        <div class="comm-stat-label">State Entries</div>
      </div>
    </div>
    <div class="comm-panel">
      <div class="comm-panel-title"><span class="material-symbols-outlined">group</span>Active Agents</div>
      ${agentsHtml}
    </div>
    <div class="comm-panel">
      <div class="comm-panel-title"><span class="material-symbols-outlined">history</span>Recent Activity</div>
      ${activityHtml}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Agents tab
// ---------------------------------------------------------------------------

function _buildAgentCard(a) {
  const caps = _parseCaps(a);
  const msgCount = (_commData.messages || []).filter((m) => m.from_agent === a.id || m.to_agent === a.id).length;
  const hb = _heartbeatFreshness(a.last_heartbeat);
  const stuck = _isAgentStuck(a);
  const skills = a.skills || [];

  return (
    '<div class="comm-card-title">' +
    '<span class="comm-status-dot ' +
    _esc(a.status) +
    '"></span>' +
    _esc(a.name) +
    (stuck
      ? '<span class="comm-stuck-badge"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">hourglass_top</span> idle ' +
        _timeAgo(a.last_activity) +
        '</span>'
      : '') +
    '</div>' +
    (a.status_text ? '<div class="comm-status-text">' + _esc(a.status_text) + '</div>' : '') +
    '<div class="comm-card-meta">Status: ' +
    _esc(a.status) +
    ' &middot; Heartbeat: <span class="' +
    hb.cls +
    '">' +
    hb.text +
    '</span></div>' +
    (a.last_activity ? '<div class="comm-card-meta">Last activity: ' + _timeAgo(a.last_activity) + '</div>' : '') +
    '<div class="comm-card-meta">Registered: ' +
    _timeAgo(a.registered_at) +
    '</div>' +
    (msgCount > 0 ? '<div class="comm-card-meta">' + msgCount + ' messages</div>' : '') +
    (caps.length > 0
      ? '<div style="margin-top:8px">' +
        caps.map((c) => '<span class="comm-cap-tag">' + _esc(c) + '</span>').join('') +
        '</div>'
      : '') +
    (skills.length > 0
      ? '<div style="margin-top:4px">' +
        skills
          .map((s) => {
            const tags = (s.tags || []).join(', ');
            return '<span class="comm-skill-pill" title="' + _escAttr(tags) + '">' + _esc(s.name) + '</span>';
          })
          .join('') +
        '</div>'
      : '') +
    '<div class="comm-card-action" data-filter-agent="' +
    _escAttr(a.id) +
    '">View messages &rarr;</div>'
  );
}

function _renderCommAgents() {
  const agents = _commData.agents || [];
  if (agents.length === 0) {
    return '<div class="comm-empty"><span class="material-symbols-outlined">smart_toy</span><span>No agents registered</span><div class="comm-empty-hint">Use comm_register to connect an agent</div></div>';
  }
  return (
    '<div class="comm-agent-grid">' +
    agents
      .map((a) => '<div class="comm-card" data-agent-id="' + _escAttr(a.id) + '">' + _buildAgentCard(a) + '</div>')
      .join('') +
    '</div>'
  );
}

// ---------------------------------------------------------------------------
// Messages tab
// ---------------------------------------------------------------------------

function _getFilteredMessages() {
  let msgs = _commData.messages || [];
  if (_commMsgFilter.agent) {
    const agentId = _commMsgFilter.agent;
    msgs = msgs.filter((m) => m.from_agent === agentId || m.to_agent === agentId);
  }
  if (_commMsgFilter.channel) {
    const chId = _commMsgFilter.channel;
    msgs = msgs.filter((m) => m.channel_id === chId);
  }
  return msgs;
}

function _renderMsgDetail(msgId) {
  const messages = _commData.messages || [];
  const msg = messages.find((m) => m.id === msgId);
  if (!msg) {
    return '<div class="comm-detail-empty"><span class="material-symbols-outlined">mail</span><div>Message not found</div></div>';
  }

  const fromName = _resolveAgentName(msg.from_agent);
  const toLabel = msg.to_agent
    ? 'To: ' + _esc(_resolveAgentName(msg.to_agent))
    : msg.channel_id
      ? 'In: ' + _esc(_resolveChannelName(msg.channel_id))
      : '';

  const handoffMatch = (msg.content || '').match(
    /^--- HANDOFF from (.+?) to (.+?) ---\n\n([\s\S]*?)\n--- End of handoff ---$/,
  );
  const isHandoff = !!handoffMatch;

  const fwdMatch = !isHandoff ? (msg.content || '').match(/^([\s\S]*?)--- Forwarded from (.+?) ---\n([\s\S]*)$/) : null;
  const isForwarded = !!fwdMatch;

  const replies = messages.filter((m) => m.thread_id === msg.id);

  let html =
    '<div class="comm-detail-card">' +
    '<div class="comm-detail-header">' +
    '<div class="comm-detail-avatar">' +
    _esc(fromName.substring(0, 2).toUpperCase()) +
    '</div>' +
    '<div>' +
    '<div class="comm-detail-sender-name">' +
    _esc(fromName) +
    '</div>' +
    '<div class="comm-detail-sender-meta">' +
    toLabel +
    ' &middot; ' +
    _timeAgo(msg.created_at) +
    (msg.edited_at ? ' &middot; edited' : '') +
    '</div>' +
    '</div>' +
    '<div class="comm-detail-badges">' +
    (isHandoff
      ? '<span class="comm-msg-tag handoff-tag"><span class="material-symbols-outlined" style="font-size:12px;vertical-align:-2px">swap_horiz</span> handoff</span>'
      : '') +
    (isForwarded
      ? '<span class="comm-msg-tag fwd-tag"><span class="material-symbols-outlined" style="font-size:12px;vertical-align:-2px">forward_to_inbox</span> forwarded</span>'
      : '') +
    (msg.branch_id
      ? '<span class="comm-msg-tag branch-tag"><span class="material-symbols-outlined" style="font-size:12px;vertical-align:-2px">call_split</span> branch</span>'
      : '') +
    (msg.importance && msg.importance !== 'normal'
      ? '<span class="comm-msg-tag importance-' + _esc(msg.importance) + '">' + _esc(msg.importance) + '</span>'
      : '') +
    (msg.ack_required ? '<span class="comm-msg-tag ack-tag">ack</span>' : '') +
    '</div>' +
    '</div>';

  if (msg.thread_id) {
    const parent = messages.find((m) => m.id === msg.thread_id);
    if (parent) {
      let parentPreview = _stripMd(parent.content || '').substring(0, 120);
      if ((parent.content || '').length > 120) parentPreview += '...';
      html +=
        '<div class="comm-reply-context" data-goto-msg="' +
        parent.id +
        '">' +
        '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;margin-right:4px;color:var(--text-secondary)">reply</span>' +
        '<strong>' +
        _esc(_resolveAgentName(parent.from_agent)) +
        '</strong> ' +
        _esc(parentPreview) +
        '</div>';
    }
  }

  if (isHandoff) {
    html +=
      '<div class="comm-handoff-block">' +
      '<div class="comm-handoff-header"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px;margin-right:6px">swap_horiz</span>Handoff from <strong>' +
      _esc(handoffMatch[1]) +
      '</strong> to <strong>' +
      _esc(handoffMatch[2]) +
      '</strong></div>' +
      '<div class="comm-detail-body" style="border:none;padding-top:0">' +
      _esc(handoffMatch[3]) +
      '</div>' +
      '</div>';
  } else if (isForwarded) {
    const fwdComment = fwdMatch[1].trim();
    const fwdFrom = fwdMatch[2];
    const fwdBody = fwdMatch[3];
    if (fwdComment) {
      html += '<div class="comm-detail-body">' + _esc(fwdComment) + '</div>';
    }
    html +=
      '<div class="comm-fwd-block">' +
      '<div class="comm-fwd-header"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;margin-right:4px">forward_to_inbox</span>Forwarded from <strong>' +
      _esc(fwdFrom) +
      '</strong></div>' +
      '<div class="comm-detail-body" style="border:none;padding-top:0">' +
      _esc(fwdBody) +
      '</div>' +
      '</div>';
  } else {
    html += '<div class="comm-detail-body">' + _esc(msg.content) + '</div>';
  }

  const msgBranches = (_commData.branches || []).filter((b) => b.parent_message_id === msg.id);
  if (msgBranches.length > 0) {
    html +=
      '<div class="comm-branch-section">' +
      '<div class="comm-section-title"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;margin-right:4px">account_tree</span>Branches (' +
      msgBranches.length +
      ')</div>';
    msgBranches.forEach((b) => {
      const creatorName = b.created_by ? _resolveAgentName(b.created_by) : 'unknown';
      html +=
        '<div class="comm-branch-item">' +
        '<span class="material-symbols-outlined" style="font-size:14px;color:var(--purple,#8e9ad0);margin-right:6px">call_split</span>' +
        '<span style="font-weight:600">' +
        _esc(b.name || 'branch-' + b.id) +
        '</span>' +
        '<span style="font-size:12px;color:var(--text-secondary)"> by ' +
        _esc(creatorName) +
        ' &middot; ' +
        _timeAgo(b.created_at) +
        '</span>' +
        '</div>';
    });
    html += '</div>';
  }

  if (replies.length > 0) {
    html +=
      '<div class="comm-detail-thread">' +
      '<div class="comm-detail-thread-title">Thread (' +
      replies.length +
      ' replies)</div>';
    replies.forEach((r) => {
      const rName = _resolveAgentName(r.from_agent);
      html +=
        '<div class="comm-thread-msg" data-goto-msg="' +
        r.id +
        '">' +
        '<div class="comm-thread-avatar">' +
        _esc(rName.substring(0, 2).toUpperCase()) +
        '</div>' +
        '<div style="flex:1">' +
        '<div style="display:flex;align-items:center">' +
        '<span class="comm-thread-name">' +
        _esc(rName) +
        '</span>' +
        '<span class="comm-thread-time">' +
        _timeAgo(r.created_at) +
        '</span>' +
        '</div>' +
        '<div class="comm-thread-body">' +
        _esc(r.content) +
        '</div>' +
        '</div>' +
        '</div>';
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function _renderCommMessages() {
  const filtered = _getFilteredMessages();

  let chipsHtml = '';
  if (_commMsgFilter.agent) {
    chipsHtml +=
      '<span class="comm-filter-chip">Agent: ' +
      _esc(_resolveAgentName(_commMsgFilter.agent)) +
      ' <button class="comm-chip-remove" data-clear="agent">&times;</button></span>';
  }
  if (_commMsgFilter.channel) {
    chipsHtml +=
      '<span class="comm-filter-chip">Channel: ' +
      _esc(_resolveChannelName(_commMsgFilter.channel)) +
      ' <button class="comm-chip-remove" data-clear="channel">&times;</button></span>';
  }

  const threadRoots = {};
  (_commData.messages || []).forEach((m) => {
    if (m.thread_id) {
      if (!threadRoots[m.thread_id]) threadRoots[m.thread_id] = [];
      threadRoots[m.thread_id].push(m);
    }
  });

  let listHtml = '';
  if (filtered.length === 0) {
    const hasFilter = _commMsgFilter.agent || _commMsgFilter.channel;
    listHtml =
      '<div class="comm-empty">' +
      (hasFilter
        ? '<span>No matching messages</span>'
        : '<span class="material-symbols-outlined">inbox</span><span>No messages yet</span>') +
      '</div>';
  } else {
    listHtml = filtered
      .map((m) => {
        const fromName = _resolveAgentName(m.from_agent);
        const toLabel = m.to_agent
          ? '&rarr; ' + _esc(_resolveAgentName(m.to_agent))
          : m.channel_id
            ? '&rarr; ' + _esc(_resolveChannelName(m.channel_id))
            : '';
        const isFwd = /--- Forwarded from .+ ---/.test(m.content || '');
        const isHandoff = /--- HANDOFF from .+ to .+ ---/.test(m.content || '');
        let rawPreview = _stripMd(m.content || '');
        if (isFwd) {
          const fwdParts = (m.content || '').match(/--- Forwarded from .+ ---\n([\s\S]*)/);
          rawPreview = fwdParts ? _stripMd(fwdParts[1]) : rawPreview;
        }
        let preview = rawPreview.substring(0, 80);
        if (rawPreview.length > 80) preview += '...';
        const replies = threadRoots[m.id] || [];
        const isSelected = _commSelectedMsgId === m.id;

        const branchesFromMsg = (_commData.branches || []).filter((b) => b.parent_message_id === m.id);

        return (
          '<div class="comm-msg-compact' +
          (isSelected ? ' selected' : '') +
          '" data-msg-id="' +
          m.id +
          '">' +
          '<div class="comm-msg-header">' +
          '<span class="comm-msg-avatar">' +
          _esc(fromName.substring(0, 2).toUpperCase()) +
          '</span>' +
          '<span class="comm-msg-from">' +
          _esc(fromName) +
          '</span>' +
          '<span class="comm-msg-to">' +
          toLabel +
          '</span>' +
          '<span class="comm-msg-time">' +
          _timeAgo(m.created_at) +
          '</span>' +
          '</div>' +
          '<div class="comm-msg-preview">' +
          _esc(preview) +
          '</div>' +
          '<div class="comm-msg-badges">' +
          (m.importance && m.importance !== 'normal'
            ? '<span class="comm-msg-tag importance-' + _esc(m.importance) + '">' + _esc(m.importance) + '</span>'
            : '') +
          (isHandoff
            ? '<span class="comm-msg-tag handoff-tag"><span class="material-symbols-outlined" style="font-size:11px;vertical-align:-1px">swap_horiz</span> handoff</span>'
            : '') +
          (isFwd && !isHandoff ? '<span class="comm-msg-tag fwd-tag">fwd</span>' : '') +
          (m.branch_id
            ? '<span class="comm-msg-tag branch-tag"><span class="material-symbols-outlined" style="font-size:11px;vertical-align:-1px">call_split</span> branch</span>'
            : '') +
          (replies.length > 0 ? '<span class="comm-msg-tag">' + replies.length + ' replies</span>' : '') +
          (m.thread_id ? '<span class="comm-msg-tag">reply</span>' : '') +
          (m.ack_required ? '<span class="comm-msg-tag ack-tag">ack</span>' : '') +
          (branchesFromMsg.length > 0
            ? '<span class="comm-msg-tag branch-tag"><span class="material-symbols-outlined" style="font-size:11px;vertical-align:-1px">account_tree</span> ' +
              branchesFromMsg.length +
              ' branch' +
              (branchesFromMsg.length > 1 ? 'es' : '') +
              '</span>'
            : '') +
          '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  const detailHtml = _commSelectedMsgId
    ? _renderMsgDetail(_commSelectedMsgId)
    : '<div class="comm-detail-empty"><span class="material-symbols-outlined">mail</span><div>Select a message to view details</div></div>';

  return (
    '<div class="comm-split-pane">' +
    '<div class="comm-split-left">' +
    (chipsHtml ? '<div class="comm-filter-chips">' + chipsHtml + '</div>' : '') +
    '<div class="comm-msg-list">' +
    listHtml +
    '</div>' +
    '</div>' +
    '<div class="comm-split-right">' +
    detailHtml +
    '</div>' +
    '</div>'
  );
}

// ---------------------------------------------------------------------------
// Channels tab
// ---------------------------------------------------------------------------

function _renderCommChannels() {
  const channels = _commData.channels || [];
  if (channels.length === 0) {
    return '<div class="comm-empty"><span class="material-symbols-outlined">forum</span><span>No channels created</span><div class="comm-empty-hint">Use comm_channel({ action: "create" }) to add a channel</div></div>';
  }
  return (
    '<div class="comm-channel-grid">' +
    channels
      .map((ch) => {
        const msgCount = (_commData.messages || []).filter((m) => m.channel_id === ch.id).length;
        return (
          '<div class="comm-card" data-channel-id="' +
          _escAttr(ch.id) +
          '">' +
          '<div class="comm-card-title">#' +
          _esc(ch.name) +
          '</div>' +
          (ch.description ? '<div class="comm-card-meta">' + _esc(ch.description) + '</div>' : '') +
          '<div class="comm-card-meta">Created: ' +
          _timeAgo(ch.created_at) +
          '</div>' +
          '<div class="comm-card-meta">' +
          msgCount +
          ' messages</div>' +
          (ch.archived_at ? '<div class="comm-card-meta" style="color:var(--yellow,#d29922)">Archived</div>' : '') +
          '<div class="comm-card-action" data-filter-channel="' +
          _escAttr(ch.id) +
          '">View messages &rarr;</div>' +
          '</div>'
        );
      })
      .join('') +
    '</div>'
  );
}

// ---------------------------------------------------------------------------
// State tab
// ---------------------------------------------------------------------------

function _renderCommState() {
  const entries = _commData.state || [];
  const filter = _commStateFilter.toLowerCase();

  let filtered = entries;
  if (filter) {
    filtered = entries.filter(
      (e) =>
        (e.key || '').toLowerCase().indexOf(filter) !== -1 || (e.namespace || '').toLowerCase().indexOf(filter) !== -1,
    );
  }

  let bodyHtml = '';
  if (filtered.length === 0) {
    bodyHtml =
      '<div class="comm-empty">' +
      (filter
        ? '<span>No matching entries</span>'
        : '<span class="material-symbols-outlined">database</span><span>No shared state</span>') +
      '</div>';
  } else {
    bodyHtml =
      '<div style="overflow-x:auto"><table class="comm-table"><thead><tr>' +
      '<th>Namespace</th><th>Key</th><th>Value</th><th>Updated By</th><th>Updated At</th>' +
      '</tr></thead><tbody>' +
      filtered
        .map((e) => {
          const val = typeof e.value === 'string' ? e.value : JSON.stringify(e.value);
          return (
            '<tr>' +
            '<td>' +
            _esc(e.namespace) +
            '</td>' +
            '<td>' +
            _esc(e.key) +
            '</td>' +
            '<td class="value-cell" title="' +
            _escAttr(val) +
            '">' +
            _esc(val) +
            '</td>' +
            '<td>' +
            _esc(_resolveAgentName(e.updated_by)) +
            '</td>' +
            '<td>' +
            _timeAgo(e.updated_at) +
            '</td>' +
            '</tr>'
          );
        })
        .join('') +
      '</tbody></table></div>';
  }

  return (
    '<div class="comm-state-toolbar">' +
    '<div class="comm-search-wrap">' +
    '<span class="material-symbols-outlined">search</span>' +
    '<input type="search" class="comm-state-filter" placeholder="Filter by namespace or key..." value="' +
    _escAttr(_commStateFilter) +
    '" />' +
    '</div>' +
    '</div>' +
    bodyHtml
  );
}

// ---------------------------------------------------------------------------
// Feed tab
// ---------------------------------------------------------------------------

const FEED_TYPE_ICONS = {
  commit: 'commit',
  test_pass: 'check_circle',
  test_fail: 'cancel',
  file_edit: 'edit_document',
  task_complete: 'task_alt',
  error: 'error',
  custom: 'extension',
  register: 'person_add',
  message: 'chat_bubble',
  state_change: 'sync_alt',
  handoff: 'swap_horiz',
  branch: 'call_split',
};

const FEED_TYPE_COLORS = {
  commit: 'var(--purple, #7c3aed)',
  test_pass: 'var(--green, #22c55e)',
  test_fail: 'var(--red, #ef4444)',
  file_edit: 'var(--accent, #5d8da8)',
  task_complete: 'var(--green, #22c55e)',
  error: 'var(--red, #ef4444)',
  custom: 'var(--text-secondary, #888)',
  register: 'var(--accent, #5d8da8)',
  message: 'var(--accent, #5d8da8)',
  state_change: 'var(--yellow, #eab308)',
  handoff: 'var(--orange, #db6d28)',
  branch: 'var(--purple, #7c3aed)',
};

function _renderFeedItem(e) {
  const icon = FEED_TYPE_ICONS[e.type] || FEED_TYPE_ICONS[e.event_type] || 'circle';
  const color = FEED_TYPE_COLORS[e.type] || FEED_TYPE_COLORS[e.event_type] || 'var(--text-secondary)';
  const agentName = e.agent_id ? _resolveAgentName(e.agent_id) : 'system';
  return (
    '<div class="comm-feed-item">' +
    '<div class="comm-feed-icon" style="background:' +
    color
      .replace(')', ',0.12)')
      .replace('var(', 'rgba(')
      .replace(/,\s*#[0-9a-f]+/i, '') +
    ';color:' +
    color +
    '">' +
    '<span class="material-symbols-outlined">' +
    icon +
    '</span></div>' +
    '<div class="comm-feed-content">' +
    '<div class="comm-feed-header">' +
    '<span class="comm-feed-type" style="color:' +
    color +
    '">' +
    _esc(e.type || e.event_type || '') +
    '</span>' +
    '<span class="comm-feed-agent">' +
    _esc(agentName) +
    '</span>' +
    '<span class="comm-feed-time">' +
    _timeAgo(e.created_at) +
    '</span>' +
    '</div>' +
    (e.target ? '<div class="comm-feed-target">' + _esc(e.target) + '</div>' : '') +
    (e.preview || e.summary ? '<div class="comm-feed-preview">' + _esc(e.preview || e.summary) + '</div>' : '') +
    '</div>' +
    '</div>'
  );
}

function _renderCommFeed() {
  const feed = _commData.feed || [];
  const typeFilter = _commFeedTypeFilter;

  let filtered = feed;
  if (typeFilter) {
    filtered = feed.filter((e) => (e.type || e.event_type) === typeFilter);
  }

  let bodyHtml = '';
  if (filtered.length === 0) {
    bodyHtml =
      '<div class="comm-empty">' +
      '<span class="material-symbols-outlined">rss_feed</span>' +
      (typeFilter
        ? '<span>No events of type "' + _esc(typeFilter) + '"</span>'
        : '<span>No activity events yet</span>') +
      '<div class="comm-empty-hint">Events appear when agents log activities</div>' +
      '</div>';
  } else {
    bodyHtml = filtered.map(_renderFeedItem).join('');
  }

  const filterOptions = [
    '',
    'commit',
    'test_pass',
    'test_fail',
    'file_edit',
    'task_complete',
    'error',
    'custom',
    'register',
    'message',
    'state_change',
    'handoff',
    'branch',
  ];

  return (
    '<div class="comm-feed-filter">' +
    '<span class="material-symbols-outlined" style="font-size:18px;color:var(--text-secondary)">filter_list</span>' +
    '<select class="comm-feed-select">' +
    filterOptions
      .map(
        (v) =>
          '<option value="' +
          _escAttr(v) +
          '"' +
          (v === typeFilter ? ' selected' : '') +
          '>' +
          (v ? v : 'All types') +
          '</option>',
      )
      .join('') +
    '</select>' +
    '</div>' +
    bodyHtml
  );
}

// ---------------------------------------------------------------------------
// Tab badges
// ---------------------------------------------------------------------------

function _updateTabBadges() {
  if (!_commRoot) return;
  const d = _commData;
  const onlineCount = d.agents.filter((a) => a.status !== 'offline').length;
  const msgCount = d.messageCount || d.messages.length;
  const counts = {
    agents: onlineCount,
    messages: msgCount,
    channels: d.channels.length,
    state: d.state.length,
    feed: d.feed.length,
  };
  _commRoot.querySelectorAll('.comm-tab').forEach((tab) => {
    const id = tab.dataset.tab;
    if (id === 'overview') return;
    let badge = tab.querySelector('.comm-tab-badge');
    const count = counts[id];
    if (count === undefined) return;
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'comm-tab-badge';
      tab.appendChild(badge);
    }
    badge.textContent = count;
    badge.className = 'comm-tab-badge' + (count === 0 ? ' zero' : '');
  });
}

// ---------------------------------------------------------------------------
// Rendering orchestration
// ---------------------------------------------------------------------------

function _renderCommTab() {
  const content = _commRoot?.querySelector('.comm-content');
  if (!content) return;
  switch (_commActiveTab) {
    case 'overview':
      content.innerHTML = _renderCommOverview();
      _bindOverviewEvents(content);
      break;
    case 'agents':
      content.innerHTML = _renderCommAgents();
      _bindAgentEvents(content);
      break;
    case 'messages':
      content.innerHTML = _renderCommMessages();
      _bindMessageEvents(content);
      break;
    case 'channels':
      content.innerHTML = _renderCommChannels();
      _bindChannelEvents(content);
      break;
    case 'state':
      content.innerHTML = _renderCommState();
      _bindStateEvents(content);
      break;
    case 'feed':
      content.innerHTML = _renderCommFeed();
      _bindFeedEvents(content);
      break;
  }
  _updateTabBadges();
}

// ---------------------------------------------------------------------------
// Event binding helpers
// ---------------------------------------------------------------------------

function _switchToTab(tabId) {
  _commActiveTab = tabId;
  if (!_commRoot) return;
  _commRoot.querySelectorAll('.comm-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabId));
  _renderCommTab();
}

function _bindOverviewEvents(content) {
  content.querySelectorAll('.comm-stat[data-nav]').forEach((card) => {
    card.addEventListener('click', () => _switchToTab(card.dataset.nav));
  });
}

function _bindAgentEvents(content) {
  content.querySelectorAll('[data-filter-agent]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      _commMsgFilter.agent = el.dataset.filterAgent;
      _commMsgFilter.channel = null;
      _switchToTab('messages');
    });
  });
}

function _bindMessageEvents(content) {
  content.querySelectorAll('.comm-chip-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.clear;
      _commMsgFilter[key] = null;
      _renderCommTab();
    });
  });
  content.querySelectorAll('.comm-msg-compact').forEach((el) => {
    el.addEventListener('click', () => {
      _commSelectedMsgId = parseInt(el.dataset.msgId, 10);
      _renderCommTab();
    });
  });
  content.querySelectorAll('[data-goto-msg]').forEach((el) => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      _commSelectedMsgId = parseInt(el.dataset.gotoMsg, 10);
      _renderCommTab();
      setTimeout(() => {
        const target = _commRoot?.querySelector('.comm-msg-compact[data-msg-id="' + _commSelectedMsgId + '"]');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    });
  });
}

function _bindChannelEvents(content) {
  content.querySelectorAll('[data-filter-channel]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      _commMsgFilter.channel = el.dataset.filterChannel;
      _commMsgFilter.agent = null;
      _switchToTab('messages');
    });
  });
}

function _bindStateEvents(content) {
  const input = content.querySelector('.comm-state-filter');
  if (input) {
    input.addEventListener('input', () => {
      _commStateFilter = input.value;
      _renderCommTab();
    });
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function _bindFeedEvents(content) {
  const select = content.querySelector('.comm-feed-select');
  if (select) {
    select.addEventListener('change', () => {
      _commFeedTypeFilter = select.value;
      _renderCommTab();
    });
  }
}

// ---------------------------------------------------------------------------
// Data update handler (builds name cache)
// ---------------------------------------------------------------------------

function _handleCommData(data) {
  if (!data) return;
  _commData = data;
  if (!_commData.feed) _commData.feed = [];
  if (!_commData.branches) _commData.branches = [];
  if (!_commData.messageCount) _commData.messageCount = (_commData.messages || []).length;
  (_commData.agents || []).forEach((a) => {
    _commAgentNameCache[a.id] = a.name;
  });
  _renderCommTab();
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function initCommView(container) {
  const style = document.createElement('style');
  style.id = 'comm-view-styles';
  style.textContent = _commStyles();
  document.head.appendChild(style);

  _commRoot = document.createElement('div');
  _commRoot.className = 'comm-view';

  const tabBar = document.createElement('div');
  tabBar.className = 'comm-tabs';
  COMM_TABS.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'comm-tab' + (t.id === _commActiveTab ? ' active' : '');
    btn.dataset.tab = t.id;
    btn.innerHTML = `<span class="material-symbols-outlined">${t.icon}</span>${t.label}`;
    btn.addEventListener('click', () => _switchToTab(t.id));
    tabBar.appendChild(btn);
  });

  const content = document.createElement('div');
  content.className = 'comm-content';

  _commRoot.appendChild(tabBar);
  _commRoot.appendChild(content);
  container.appendChild(_commRoot);

  agentDesk.comm.getState().then((data) => _handleCommData(data));

  _commCleanup = agentDesk.comm.onUpdate((data) => _handleCommData(data));
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
  _commActiveTab = 'overview';
  _commData = { agents: [], messages: [], channels: [], state: [], feed: [], branches: [], messageCount: 0 };
  _commAgentNameCache = {};
  _commStateFilter = '';
  _commFeedTypeFilter = '';
  _commSelectedMsgId = null;
  _commMsgFilter = { agent: null, channel: null };
}
