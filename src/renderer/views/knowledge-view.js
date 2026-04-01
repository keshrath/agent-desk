// =============================================================================
// Agent Desk — Native Knowledge View
// =============================================================================
// 3 tabs: Entries (by category), Sessions, Search
// Uses window.agentDesk.knowledge.* IPC calls
// =============================================================================

'use strict';

let _knRoot = null;
let _knCleanup = null;
let _knActiveTab = 'entries';
let _knEntries = [];
let _knSessions = [];
let _knSearchResults = [];
let _knSearchQuery = '';
let _knSelectedCategory = '';
let _knExpandedEntry = null;
let _knExpandedSession = null;

const CATEGORIES = ['projects', 'people', 'decisions', 'workflows', 'notes'];

const KN_TABS = [
  { id: 'entries', label: 'Entries', icon: 'article' },
  { id: 'sessions', label: 'Sessions', icon: 'history' },
  { id: 'search', label: 'Search', icon: 'search' },
];

function _knStyles() {
  return `
    .kn-view { display: flex; flex-direction: column; height: 100%; font-family: 'Inter', sans-serif; color: var(--text, #c8d1da); background: var(--bg, #1a1d23); }
    .kn-tabs { display: flex; gap: 2px; padding: 8px 12px 0; border-bottom: 1px solid var(--border, #2d323b); background: var(--bg-surface, #21252b); flex-shrink: 0; }
    .kn-tab { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; background: transparent; color: var(--text-secondary, #8b949e); cursor: pointer; font-size: 13px; font-weight: 500; border-bottom: 2px solid transparent; transition: all 0.15s; border-radius: 6px 6px 0 0; }
    .kn-tab:hover { color: var(--text, #c8d1da); background: var(--bg-hover, #282d35); }
    .kn-tab.active { color: var(--accent, #5d8da8); border-bottom-color: var(--accent, #5d8da8); }
    .kn-tab .material-symbols-outlined { font-size: 18px; }
    .kn-content { flex: 1; overflow-y: auto; padding: 16px; }
    .kn-cat-bar { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
    .kn-cat-btn { padding: 4px 12px; border-radius: 16px; border: 1px solid var(--border, #2d323b); background: transparent; color: var(--text-secondary, #8b949e); cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.15s; }
    .kn-cat-btn:hover { border-color: var(--accent, #5d8da8); color: var(--text, #c8d1da); }
    .kn-cat-btn.active { background: var(--accent, #5d8da8); color: var(--bg, #1a1d23); border-color: var(--accent, #5d8da8); }
    .kn-card { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s; }
    .kn-card:hover { border-color: var(--accent, #5d8da8); }
    .kn-card.expanded { border-color: var(--accent, #5d8da8); }
    .kn-card-title { font-size: 14px; font-weight: 500; margin-bottom: 4px; }
    .kn-card-meta { font-size: 11px; color: var(--text-secondary, #8b949e); display: flex; gap: 10px; }
    .kn-card-body { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border, #2d323b); font-family: 'JetBrains Mono', monospace; font-size: 12px; white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow-y: auto; color: var(--text-secondary, #8b949e); }
    .kn-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; color: var(--text-secondary, #8b949e); }
    .kn-empty .material-symbols-outlined { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
    .kn-search-bar { display: flex; gap: 8px; margin-bottom: 16px; }
    .kn-search-bar input { flex: 1; padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border, #2d323b); background: var(--bg-surface, #21252b); color: var(--text, #c8d1da); font-size: 13px; outline: none; }
    .kn-search-bar input:focus { border-color: var(--accent, #5d8da8); }
    .kn-search-bar button { padding: 8px 16px; border-radius: 6px; border: none; background: var(--accent, #5d8da8); color: var(--bg, #1a1d23); font-weight: 600; cursor: pointer; font-size: 13px; }
    .kn-search-bar button:hover { opacity: 0.9; }
    .kn-result-score { font-size: 11px; color: var(--accent, #5d8da8); font-weight: 600; }
    .kn-session-card { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s; }
    .kn-session-card:hover { border-color: var(--accent, #5d8da8); }
    .kn-session-title { font-size: 13px; font-weight: 500; margin-bottom: 4px; }
    .kn-session-meta { font-size: 11px; color: var(--text-secondary, #8b949e); display: flex; gap: 10px; flex-wrap: wrap; }
    .kn-session-detail { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border, #2d323b); }
    .kn-session-topics { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .kn-session-topic { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 500; background: rgba(93,141,168,0.15); color: var(--accent, #5d8da8); }
    .kn-cat-tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; background: rgba(93,141,168,0.15); color: var(--accent, #5d8da8); }
  `;
}

function _esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function _timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

function _renderEntries() {
  const filtered = _knSelectedCategory ? _knEntries.filter((e) => e.category === _knSelectedCategory) : _knEntries;

  let html = '<div class="kn-cat-bar">';
  html += `<button class="kn-cat-btn${!_knSelectedCategory ? ' active' : ''}" data-cat="">All</button>`;
  CATEGORIES.forEach((c) => {
    const count = _knEntries.filter((e) => e.category === c).length;
    html += `<button class="kn-cat-btn${_knSelectedCategory === c ? ' active' : ''}" data-cat="${c}">${c} (${count})</button>`;
  });
  html += '</div>';

  if (filtered.length === 0) {
    html += '<div class="kn-empty"><span class="material-symbols-outlined">article</span><span>No entries</span></div>';
  } else {
    filtered.forEach((entry) => {
      const isExpanded = _knExpandedEntry === entry.category + '/' + entry.name;
      html += `<div class="kn-card${isExpanded ? ' expanded' : ''}" data-entry="${_esc(entry.category + '/' + entry.name)}">`;
      html += `<div class="kn-card-title">${_esc(entry.title || entry.name)}</div>`;
      html += `<div class="kn-card-meta"><span class="kn-cat-tag">${_esc(entry.category)}</span><span>${_timeAgo(entry.updated_at || entry.created_at)}</span></div>`;
      if (isExpanded && entry._body) {
        html += `<div class="kn-card-body">${_esc(entry._body)}</div>`;
      }
      html += '</div>';
    });
  }

  return html;
}

function _renderSessions() {
  if (_knSessions.length === 0) {
    return '<div class="kn-empty"><span class="material-symbols-outlined">history</span><span>No sessions found</span></div>';
  }
  return _knSessions
    .slice(0, 50)
    .map((s) => {
      const isExpanded = _knExpandedSession === s.id;
      let html = `<div class="kn-session-card" data-session="${_esc(s.id)}">`;
      html += `<div class="kn-session-title">${_esc(s.project || s.id)}</div>`;
      html += `<div class="kn-session-meta"><span>${_timeAgo(s.lastActive || s.startedAt)}</span>`;
      if (s.messageCount != null) html += `<span>${s.messageCount} messages</span>`;
      if (s.duration) html += `<span>${s.duration}</span>`;
      html += '</div>';
      if (isExpanded && s.topics && s.topics.length > 0) {
        html += '<div class="kn-session-detail"><div class="kn-session-topics">';
        s.topics.forEach((t) => (html += `<span class="kn-session-topic">${_esc(t)}</span>`));
        html += '</div></div>';
      }
      html += '</div>';
      return html;
    })
    .join('');
}

function _renderSearch() {
  let html = `<div class="kn-search-bar">
    <input type="text" placeholder="Search knowledge base..." value="${_esc(_knSearchQuery)}" />
    <button>Search</button>
  </div>`;

  if (_knSearchResults.length === 0 && _knSearchQuery) {
    html +=
      '<div class="kn-empty"><span class="material-symbols-outlined">search_off</span><span>No results</span></div>';
  } else if (_knSearchResults.length > 0) {
    _knSearchResults.forEach((r) => {
      html += `<div class="kn-card">`;
      html += `<div class="kn-card-title">${_esc(r.title || r.name || r.path)} <span class="kn-result-score">${r.score != null ? r.score.toFixed(2) : ''}</span></div>`;
      if (r.excerpt) html += `<div class="kn-card-body" style="max-height:80px">${_esc(r.excerpt)}</div>`;
      html += '</div>';
    });
  }

  return html;
}

function _renderKnTab() {
  const content = _knRoot?.querySelector('.kn-content');
  if (!content) return;

  switch (_knActiveTab) {
    case 'entries':
      content.innerHTML = _renderEntries();
      content.querySelectorAll('.kn-cat-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          _knSelectedCategory = btn.dataset.cat || '';
          _renderKnTab();
        });
      });
      content.querySelectorAll('.kn-card[data-entry]').forEach((card) => {
        card.addEventListener('click', () => {
          const key = card.dataset.entry;
          if (_knExpandedEntry === key) {
            _knExpandedEntry = null;
            _renderKnTab();
          } else {
            _knExpandedEntry = key;
            const parts = key.split('/');
            const entry = _knEntries.find((e) => e.category === parts[0] && e.name === parts.slice(1).join('/'));
            if (entry && !entry._body) {
              agentDesk.knowledge.read(parts[0], parts.slice(1).join('/')).then((data) => {
                if (data) {
                  entry._body = data.content || data.body || '';
                  _renderKnTab();
                }
              });
            } else {
              _renderKnTab();
            }
          }
        });
      });
      break;

    case 'sessions':
      content.innerHTML = _renderSessions();
      content.querySelectorAll('.kn-session-card').forEach((card) => {
        card.addEventListener('click', () => {
          const id = card.dataset.session;
          if (_knExpandedSession === id) {
            _knExpandedSession = null;
            _renderKnTab();
          } else {
            _knExpandedSession = id;
            agentDesk.knowledge.session(id).then((data) => {
              if (data) {
                const s = _knSessions.find((x) => x.id === id);
                if (s) {
                  s.topics = data.topics || [];
                  s.messageCount = data.messageCount ?? s.messageCount;
                }
              }
              _renderKnTab();
            });
          }
        });
      });
      break;

    case 'search': {
      content.innerHTML = _renderSearch();
      const input = content.querySelector('.kn-search-bar input');
      const btn = content.querySelector('.kn-search-bar button');
      const doSearch = () => {
        const q = input.value.trim();
        if (!q) return;
        _knSearchQuery = q;
        agentDesk.knowledge.search(q).then((results) => {
          _knSearchResults = results || [];
          _renderKnTab();
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

export function initKnowledgeView(container) {
  const style = document.createElement('style');
  style.id = 'knowledge-view-styles';
  style.textContent = _knStyles();
  document.head.appendChild(style);

  _knRoot = document.createElement('div');
  _knRoot.className = 'kn-view';

  const tabBar = document.createElement('div');
  tabBar.className = 'kn-tabs';
  KN_TABS.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'kn-tab' + (t.id === _knActiveTab ? ' active' : '');
    btn.dataset.tab = t.id;
    btn.innerHTML = `<span class="material-symbols-outlined">${t.icon}</span>${t.label}`;
    btn.addEventListener('click', () => {
      _knActiveTab = t.id;
      tabBar.querySelectorAll('.kn-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === t.id));
      _renderKnTab();
    });
    tabBar.appendChild(btn);
  });

  const content = document.createElement('div');
  content.className = 'kn-content';

  _knRoot.appendChild(tabBar);
  _knRoot.appendChild(content);
  container.appendChild(_knRoot);

  // Initial load
  agentDesk.knowledge.entries().then((entries) => {
    _knEntries = entries || [];
    _renderKnTab();
  });
  agentDesk.knowledge.sessions().then((sessions) => {
    _knSessions = sessions || [];
  });

  // Subscribe to updates
  _knCleanup = agentDesk.knowledge.onUpdate((data) => {
    if (data && data.entries) {
      _knEntries = data.entries;
      if (_knActiveTab === 'entries') _renderKnTab();
    }
  });
}

export function destroyKnowledgeView() {
  if (_knCleanup) {
    _knCleanup();
    _knCleanup = null;
  }
  const style = document.getElementById('knowledge-view-styles');
  if (style) style.remove();
  if (_knRoot) {
    _knRoot.remove();
    _knRoot = null;
  }
}
