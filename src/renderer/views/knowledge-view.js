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
let _knSearchLoading = false;
let _knSelectedCategory = '';
let _knExpandedEntry = null;
let _knExpandedSession = null;
let _knSessionProjectFilter = '';
let _knSessionsLoaded = false;

const CATEGORIES = ['projects', 'people', 'decisions', 'workflows', 'notes'];
const CAT_ICONS = {
  projects: 'code',
  people: 'group',
  decisions: 'gavel',
  workflows: 'account_tree',
  notes: 'sticky_note_2',
};

const KN_TABS = [
  { id: 'entries', label: 'Entries', icon: 'article' },
  { id: 'sessions', label: 'Sessions', icon: 'history' },
  { id: 'search', label: 'Search', icon: 'search' },
];

// ── Styles ──────────────────────────────────────────────────────────────────

function _knStyles() {
  return `
    .kn-view { display: flex; flex-direction: column; height: 100%; font-family: 'Inter', sans-serif; color: var(--text, #c8d1da); background: var(--bg, #1a1d23); }
    .kn-tabs { display: flex; gap: 2px; padding: 8px 12px 0; border-bottom: 1px solid var(--border, #2d323b); background: var(--bg-surface, #21252b); flex-shrink: 0; }
    .kn-tab { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; background: transparent; color: var(--text-secondary, #8b949e); cursor: pointer; font-size: 13px; font-weight: 500; border-bottom: 2px solid transparent; transition: all 0.15s; border-radius: 6px 6px 0 0; }
    .kn-tab:hover { color: var(--text, #c8d1da); background: var(--bg-hover, #282d35); }
    .kn-tab.active { color: var(--accent, #5d8da8); border-bottom-color: var(--accent, #5d8da8); }
    .kn-tab .material-symbols-outlined { font-size: 18px; }
    .kn-header { display: flex; align-items: center; justify-content: space-between; padding: 0 0 8px; flex-shrink: 0; }
    .kn-header-stats { display: flex; gap: 12px; align-items: center; }
    .kn-stat { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary, #8b949e); }
    .kn-stat .material-symbols-outlined { font-size: 16px; }
    .kn-stat-value { font-weight: 600; color: var(--text, #c8d1da); }
    .kn-content { flex: 1; overflow-y: auto; padding: 16px; }

    /* Category filter bar */
    .kn-cat-bar { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
    .kn-cat-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 16px; border: 1px solid var(--border, #2d323b); background: transparent; color: var(--text-secondary, #8b949e); cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.15s; }
    .kn-cat-btn:hover { border-color: var(--accent, #5d8da8); color: var(--text, #c8d1da); }
    .kn-cat-btn.active { background: var(--accent, #5d8da8); color: var(--bg, #1a1d23); border-color: var(--accent, #5d8da8); }
    .kn-cat-btn .material-symbols-outlined { font-size: 14px; }
    .kn-cat-btn .kn-count { opacity: 0.7; font-size: 11px; }

    /* Entry cards */
    .kn-card { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
    .kn-card:hover { border-color: var(--accent, #5d8da8); }
    .kn-card.expanded { border-color: var(--accent, #5d8da8); box-shadow: 0 0 0 1px var(--accent, #5d8da8); }
    .kn-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .kn-card-title { font-size: 14px; font-weight: 500; flex: 1; }
    .kn-card-meta { font-size: 11px; color: var(--text-secondary, #8b949e); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .kn-card-tags { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
    .kn-card-tag { display: inline-block; padding: 1px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; background: rgba(93,141,168,0.1); color: var(--accent, #5d8da8); }
    .kn-card-body { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border, #2d323b); font-family: 'JetBrains Mono', monospace; font-size: 12px; white-space: pre-wrap; word-break: break-word; max-height: 400px; overflow-y: auto; color: var(--text-secondary, #8b949e); line-height: 1.5; }
    .kn-card-body-loading { text-align: center; padding: 16px; color: var(--text-secondary, #8b949e); font-size: 12px; }

    /* Category tag */
    .kn-cat-tag { display: inline-flex; align-items: center; gap: 3px; padding: 1px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; background: rgba(93,141,168,0.15); color: var(--accent, #5d8da8); }
    .kn-cat-tag .material-symbols-outlined { font-size: 12px; }

    /* Empty states */
    .kn-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; color: var(--text-secondary, #8b949e); }
    .kn-empty .material-symbols-outlined { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
    .kn-empty-text { font-size: 14px; margin-bottom: 4px; }
    .kn-empty-hint { font-size: 12px; opacity: 0.7; }

    /* Search bar */
    .kn-search-bar { display: flex; gap: 8px; margin-bottom: 16px; }
    .kn-search-bar input { flex: 1; padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border, #2d323b); background: var(--bg-surface, #21252b); color: var(--text, #c8d1da); font-size: 13px; outline: none; font-family: inherit; }
    .kn-search-bar input:focus { border-color: var(--accent, #5d8da8); }
    .kn-search-bar button { padding: 8px 16px; border-radius: 6px; border: none; background: var(--accent, #5d8da8); color: var(--bg, #1a1d23); font-weight: 600; cursor: pointer; font-size: 13px; }
    .kn-search-bar button:hover { opacity: 0.9; }

    /* Search results */
    .kn-result { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s; }
    .kn-result:hover { border-color: var(--accent, #5d8da8); }
    .kn-result-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .kn-result-title { font-size: 13px; font-weight: 500; flex: 1; }
    .kn-result-score { font-size: 11px; color: var(--accent, #5d8da8); font-weight: 600; }
    .kn-result-excerpt { font-size: 12px; color: var(--text-secondary, #8b949e); line-height: 1.5; max-height: 80px; overflow: hidden; }
    .kn-result-excerpt mark { background: rgba(93,141,168,0.3); color: var(--text, #c8d1da); border-radius: 2px; padding: 0 2px; }

    /* Loading */
    .kn-loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 24px; color: var(--text-secondary, #8b949e); font-size: 13px; }
    .kn-spinner { width: 16px; height: 16px; border: 2px solid var(--border, #2d323b); border-top-color: var(--accent, #5d8da8); border-radius: 50%; animation: kn-spin 0.6s linear infinite; }
    @keyframes kn-spin { to { transform: rotate(360deg); } }

    /* Session cards */
    .kn-session-card { background: var(--bg-surface, #21252b); border: 1px solid var(--border, #2d323b); border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s; }
    .kn-session-card:hover { border-color: var(--accent, #5d8da8); }
    .kn-session-card.expanded { border-color: var(--accent, #5d8da8); box-shadow: 0 0 0 1px var(--accent, #5d8da8); }
    .kn-session-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .kn-session-title { font-size: 13px; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .kn-session-date { font-size: 11px; color: var(--text-secondary, #8b949e); white-space: nowrap; margin-left: 8px; }
    .kn-session-meta { font-size: 11px; color: var(--text-secondary, #8b949e); display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .kn-session-meta-item { display: inline-flex; align-items: center; gap: 3px; }
    .kn-session-meta-item .material-symbols-outlined { font-size: 14px; }

    /* Session detail (expanded) */
    .kn-session-detail { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border, #2d323b); }
    .kn-session-section { margin-bottom: 10px; }
    .kn-session-section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary, #8b949e); margin-bottom: 6px; display: flex; align-items: center; gap: 4px; }
    .kn-session-section-title .material-symbols-outlined { font-size: 14px; }
    .kn-session-summary { font-size: 12px; color: var(--text, #c8d1da); line-height: 1.5; }
    .kn-session-topics { display: flex; flex-wrap: wrap; gap: 4px; }
    .kn-session-topic { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; background: rgba(93,141,168,0.15); color: var(--accent, #5d8da8); }
    .kn-session-files { list-style: none; padding: 0; margin: 0; }
    .kn-session-files li { font-size: 11px; font-family: 'JetBrains Mono', monospace; padding: 2px 0; color: var(--text-secondary, #8b949e); display: flex; align-items: center; gap: 4px; }
    .kn-session-files li .material-symbols-outlined { font-size: 14px; color: var(--accent, #5d8da8); }
    .kn-session-tools { display: flex; flex-wrap: wrap; gap: 4px; }
    .kn-session-tool { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; background: rgba(93,141,168,0.1); color: var(--text-secondary, #8b949e); font-family: 'JetBrains Mono', monospace; }

    /* Session filter */
    .kn-filter-bar { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; }
    .kn-filter-select { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border, #2d323b); background: var(--bg-surface, #21252b); color: var(--text, #c8d1da); font-size: 12px; outline: none; cursor: pointer; font-family: inherit; }
    .kn-filter-select:focus { border-color: var(--accent, #5d8da8); }
  `;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function _esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function _timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 0) return 'just now';
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  const days = Math.floor(diff / 86400000);
  if (days < 30) return days + 'd ago';
  const months = Math.floor(days / 30);
  if (months < 12) return months + 'mo ago';
  return Math.floor(months / 12) + 'y ago';
}

function _formatDate(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function _highlightExcerpt(text, query) {
  if (!text || !query) return _esc(text || '');
  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escaped})`, 'gi');
    return _esc(text).replace(re, '<mark>$1</mark>');
  } catch {
    return _esc(text);
  }
}

function _stripFrontmatter(content) {
  if (!content) return '';
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1].trim() : content;
}

function _debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ── Stats Header ────────────────────────────────────────────────────────────

function _renderStatsHeader() {
  const entryCount = _knEntries.length;
  const sessionCount = _knSessions.length;
  return `<div class="kn-header">
    <div class="kn-header-stats">
      <span class="kn-stat">
        <span class="material-symbols-outlined">article</span>
        <span class="kn-stat-value">${entryCount}</span> entries
      </span>
      <span class="kn-stat">
        <span class="material-symbols-outlined">history</span>
        <span class="kn-stat-value">${sessionCount}</span> sessions
      </span>
    </div>
  </div>`;
}

// ── Entries Tab ─────────────────────────────────────────────────────────────

function _renderEntries() {
  const filtered = _knSelectedCategory ? _knEntries.filter((e) => e.category === _knSelectedCategory) : _knEntries;

  let html = _renderStatsHeader();

  html += '<div class="kn-cat-bar">';
  html += `<button class="kn-cat-btn${!_knSelectedCategory ? ' active' : ''}" data-cat="">
    <span class="material-symbols-outlined">select_all</span>All <span class="kn-count">(${_knEntries.length})</span>
  </button>`;
  CATEGORIES.forEach((c) => {
    const count = _knEntries.filter((e) => e.category === c).length;
    const icon = CAT_ICONS[c] || 'article';
    html += `<button class="kn-cat-btn${_knSelectedCategory === c ? ' active' : ''}" data-cat="${c}">
      <span class="material-symbols-outlined">${icon}</span>${c} <span class="kn-count">(${count})</span>
    </button>`;
  });
  html += '</div>';

  if (filtered.length === 0) {
    html += `<div class="kn-empty">
      <span class="material-symbols-outlined">folder_off</span>
      <div class="kn-empty-text">No entries found</div>
      <div class="kn-empty-hint">Entries will appear here when added via the knowledge MCP tools</div>
    </div>`;
  } else {
    filtered.forEach((entry) => {
      const key = (entry.category || '') + '/' + (entry.name || entry.path || '');
      const isExpanded = _knExpandedEntry === key;
      const icon = CAT_ICONS[entry.category] || 'article';
      const tags = entry.tags || [];
      const updated = entry.updated || entry.created_at || '';

      html += `<div class="kn-card${isExpanded ? ' expanded' : ''}" data-entry="${_esc(key)}">`;
      html += '<div class="kn-card-header">';
      html += `<div class="kn-card-title">${_esc(entry.title || entry.name || entry.path || 'Untitled')}</div>`;
      html += '</div>';
      html += '<div class="kn-card-meta">';
      html += `<span class="kn-cat-tag"><span class="material-symbols-outlined">${icon}</span>${_esc(entry.category)}</span>`;
      if (updated) html += `<span>${_timeAgo(updated)}</span>`;
      html += '</div>';
      if (tags.length > 0) {
        html += '<div class="kn-card-tags">';
        tags.slice(0, 5).forEach((t) => {
          html += `<span class="kn-card-tag">${_esc(t)}</span>`;
        });
        html += '</div>';
      }
      if (isExpanded) {
        if (entry._body != null) {
          html += `<div class="kn-card-body">${_esc(_stripFrontmatter(entry._body))}</div>`;
        } else {
          html += '<div class="kn-card-body-loading"><div class="kn-spinner" style="margin:0 auto"></div></div>';
        }
      }
      html += '</div>';
    });
  }

  return html;
}

// ── Sessions Tab ────────────────────────────────────────────────────────────

function _getSessionProjects() {
  return [...new Set(_knSessions.map((s) => s.project).filter(Boolean))].sort();
}

function _renderSessions() {
  let html = '';

  const projects = _getSessionProjects();
  if (projects.length > 0) {
    html += '<div class="kn-filter-bar">';
    html += '<select class="kn-filter-select" data-role="project-filter">';
    html += '<option value="">All projects</option>';
    projects.forEach((p) => {
      html += `<option value="${_esc(p)}"${_knSessionProjectFilter === p ? ' selected' : ''}>${_esc(p)}</option>`;
    });
    html += '</select>';
    html += '</div>';
  }

  const filtered = _knSessionProjectFilter
    ? _knSessions.filter((s) => s.project === _knSessionProjectFilter)
    : _knSessions;

  if (filtered.length === 0) {
    html += `<div class="kn-empty">
      <span class="material-symbols-outlined">event_busy</span>
      <div class="kn-empty-text">No sessions found</div>
      <div class="kn-empty-hint">Sessions will appear here once indexed</div>
    </div>`;
    return html;
  }

  filtered.slice(0, 100).forEach((s) => {
    const isExpanded = _knExpandedSession === s.sessionId;
    const preview = s.preview || '';
    const title = preview
      ? preview.length > 80
        ? preview.slice(0, 80) + '\u2026'
        : preview
      : (s.sessionId || s.id || '').slice(0, 8);
    const dateStr = _formatDate(s.startTime || s.date || s.startedAt);
    const timeAgo = _timeAgo(s.startTime || s.date || s.startedAt);
    const project = s.project || '';
    const branch = s.branch || s.gitBranch || '';
    const count = s.messageCount || s.message_count || 0;
    const sid = s.sessionId || s.id || '';

    html += `<div class="kn-session-card${isExpanded ? ' expanded' : ''}" data-session="${_esc(sid)}">`;
    html += '<div class="kn-session-header">';
    html += `<div class="kn-session-title">${_esc(title)}</div>`;
    html += `<span class="kn-session-date">${_esc(dateStr || timeAgo)}</span>`;
    html += '</div>';
    html += '<div class="kn-session-meta">';
    if (project) {
      html += `<span class="kn-session-meta-item"><span class="material-symbols-outlined">folder</span>${_esc(project)}</span>`;
    }
    if (branch) {
      html += `<span class="kn-session-meta-item"><span class="material-symbols-outlined">alt_route</span>${_esc(branch)}</span>`;
    }
    html += `<span class="kn-session-meta-item"><span class="material-symbols-outlined">chat</span>${count} messages</span>`;
    html += `<span class="kn-session-meta-item"><span class="material-symbols-outlined">tag</span>${_esc(sid.slice(0, 8))}</span>`;
    html += '</div>';

    if (isExpanded && s._detail) {
      html += '<div class="kn-session-detail">';

      if (s._detail.topics && s._detail.topics.length > 0) {
        html += '<div class="kn-session-section">';
        html +=
          '<div class="kn-session-section-title"><span class="material-symbols-outlined">topic</span>Topics</div>';
        html += '<div class="kn-session-topics">';
        s._detail.topics.slice(0, 10).forEach((t) => {
          const text = typeof t === 'string' ? t : t.content || '';
          if (text)
            html += `<span class="kn-session-topic">${_esc(text.length > 60 ? text.slice(0, 60) + '\u2026' : text)}</span>`;
        });
        html += '</div></div>';
      }

      if (s._detail.filesModified && s._detail.filesModified.length > 0) {
        html += '<div class="kn-session-section">';
        html +=
          '<div class="kn-session-section-title"><span class="material-symbols-outlined">description</span>Files Modified</div>';
        html += '<ul class="kn-session-files">';
        s._detail.filesModified.slice(0, 15).forEach((f) => {
          html += `<li><span class="material-symbols-outlined">insert_drive_file</span>${_esc(f)}</li>`;
        });
        if (s._detail.filesModified.length > 15) {
          html += `<li style="color:var(--text-secondary)">...and ${s._detail.filesModified.length - 15} more</li>`;
        }
        html += '</ul></div>';
      }

      if (s._detail.toolsUsed && s._detail.toolsUsed.length > 0) {
        html += '<div class="kn-session-section">';
        html +=
          '<div class="kn-session-section-title"><span class="material-symbols-outlined">build</span>Tools Used</div>';
        html += '<div class="kn-session-tools">';
        s._detail.toolsUsed.forEach((tool) => {
          html += `<span class="kn-session-tool">${_esc(tool)}</span>`;
        });
        html += '</div></div>';
      }

      html += '</div>';
    } else if (isExpanded && !s._detail) {
      html +=
        '<div class="kn-session-detail"><div class="kn-loading"><div class="kn-spinner"></div>Loading...</div></div>';
    }

    html += '</div>';
  });

  return html;
}

// ── Search Tab ──────────────────────────────────────────────────────────────

function _renderSearch() {
  let html = `<div class="kn-search-bar">
    <input type="text" placeholder="Search knowledge base..." value="${_esc(_knSearchQuery)}" />
    <button>Search</button>
  </div>`;

  if (_knSearchLoading) {
    html += '<div class="kn-loading"><div class="kn-spinner"></div>Searching...</div>';
  } else if (_knSearchResults.length === 0 && _knSearchQuery) {
    html += `<div class="kn-empty">
      <span class="material-symbols-outlined">search_off</span>
      <div class="kn-empty-text">No results found</div>
      <div class="kn-empty-hint">No matches for "${_esc(_knSearchQuery)}"</div>
    </div>`;
  } else if (_knSearchResults.length === 0 && !_knSearchQuery) {
    html += `<div class="kn-empty">
      <span class="material-symbols-outlined">manage_search</span>
      <div class="kn-empty-text">Search across knowledge entries</div>
      <div class="kn-empty-hint">Enter a query above to find matching entries</div>
    </div>`;
  } else {
    _knSearchResults.forEach((r) => {
      const entry = r.entry || r;
      const title = entry.title || entry.name || entry.path || 'Untitled';
      const excerpt = r.excerpt || '';
      const score = r.score;
      const category = entry.category || '';
      const icon = CAT_ICONS[category] || 'article';

      html += `<div class="kn-result" data-path="${_esc(entry.path || entry.category + '/' + entry.name)}">`;
      html += '<div class="kn-result-header">';
      html += `<div class="kn-result-title">${_esc(title)}</div>`;
      if (score != null) {
        html += `<span class="kn-result-score">${score.toFixed(2)}</span>`;
      }
      html += '</div>';
      html += '<div class="kn-card-meta">';
      if (category) {
        html += `<span class="kn-cat-tag"><span class="material-symbols-outlined">${icon}</span>${_esc(category)}</span>`;
      }
      html += '</div>';
      if (excerpt) {
        html += `<div class="kn-result-excerpt">${_highlightExcerpt(excerpt, _knSearchQuery)}</div>`;
      }
      html += '</div>';
    });
  }

  return html;
}

// ── Tab Rendering ───────────────────────────────────────────────────────────

function _renderKnTab() {
  const content = _knRoot?.querySelector('.kn-content');
  if (!content) return;

  switch (_knActiveTab) {
    case 'entries':
      content.innerHTML = _renderEntries();
      _bindEntriesEvents(content);
      break;

    case 'sessions':
      content.innerHTML = _renderSessions();
      _bindSessionsEvents(content);
      break;

    case 'search':
      content.innerHTML = _renderSearch();
      _bindSearchEvents(content);
      break;
  }
}

// ── Event Binding ───────────────────────────────────────────────────────────

function _bindEntriesEvents(content) {
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
        const cat = parts[0];
        const name = parts.slice(1).join('/');
        const entry = _knEntries.find((e) => e.category === cat && (e.name === name || e.path === key));
        if (entry && entry._body == null) {
          _renderKnTab();
          agentDesk.knowledge.read(cat, name).then((data) => {
            if (data) {
              entry._body = data.content || data.body || '';
            } else {
              entry._body = '(Unable to load content)';
            }
            _renderKnTab();
          });
        } else {
          _renderKnTab();
        }
      }
    });
  });
}

function _bindSessionsEvents(content) {
  const filterSelect = content.querySelector('[data-role="project-filter"]');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      _knSessionProjectFilter = filterSelect.value;
      _renderKnTab();
    });
  }

  content.querySelectorAll('.kn-session-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.session;
      if (_knExpandedSession === id) {
        _knExpandedSession = null;
        _renderKnTab();
      } else {
        _knExpandedSession = id;
        const session = _knSessions.find((s) => (s.sessionId || s.id) === id);
        if (session && !session._detail) {
          _renderKnTab();
          const project = session.project || undefined;
          agentDesk.knowledge.session(id, project).then((data) => {
            if (data) {
              session._detail = {
                topics: data.topics || [],
                toolsUsed: data.toolsUsed || [],
                filesModified: data.filesModified || [],
                messageCount: data.meta?.messageCount || data.messageCount || session.messageCount,
              };
            } else {
              session._detail = { topics: [], toolsUsed: [], filesModified: [] };
            }
            _renderKnTab();
          });
        } else {
          _renderKnTab();
        }
      }
    });
  });
}

const _doSearch = _debounce(() => {
  const q = _knSearchQuery.trim();
  if (!q) {
    _knSearchResults = [];
    _knSearchLoading = false;
    _renderKnTab();
    return;
  }
  _knSearchLoading = true;
  _renderKnTab();
  agentDesk.knowledge.search(q).then((results) => {
    _knSearchResults = results || [];
    _knSearchLoading = false;
    _renderKnTab();
  });
}, 300);

function _bindSearchEvents(content) {
  const input = content.querySelector('.kn-search-bar input');
  const btn = content.querySelector('.kn-search-bar button');

  const triggerSearch = () => {
    const q = input ? input.value.trim() : '';
    _knSearchQuery = q;
    _doSearch();
  };

  if (input) {
    input.addEventListener('input', triggerSearch);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') triggerSearch();
    });
    requestAnimationFrame(() => input.focus());
  }
  if (btn) btn.addEventListener('click', triggerSearch);

  content.querySelectorAll('.kn-result[data-path]').forEach((card) => {
    card.addEventListener('click', () => {
      const path = card.dataset.path;
      if (path) {
        _knActiveTab = 'entries';
        _knExpandedEntry = path;
        const parts = path.split('/');
        const cat = parts[0];
        const name = parts.slice(1).join('/');
        const entry = _knEntries.find((e) => e.category === cat && (e.name === name || e.path === path));
        if (entry && entry._body == null) {
          agentDesk.knowledge.read(cat, name).then((data) => {
            if (data) {
              entry._body = data.content || data.body || '';
            }
            _knRoot
              ?.querySelectorAll('.kn-tab')
              .forEach((b) => b.classList.toggle('active', b.dataset.tab === 'entries'));
            _renderKnTab();
          });
        } else {
          _knRoot
            ?.querySelectorAll('.kn-tab')
            .forEach((b) => b.classList.toggle('active', b.dataset.tab === 'entries'));
          _renderKnTab();
        }
      }
    });
  });
}

// ── Init / Destroy ──────────────────────────────────────────────────────────

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

      if (t.id === 'sessions' && !_knSessionsLoaded) {
        _knSessionsLoaded = true;
        agentDesk.knowledge.sessions().then((sessions) => {
          _knSessions = sessions || [];
          if (_knActiveTab === 'sessions') _renderKnTab();
        });
      }

      _renderKnTab();
    });
    tabBar.appendChild(btn);
  });

  const content = document.createElement('div');
  content.className = 'kn-content';

  _knRoot.appendChild(tabBar);
  _knRoot.appendChild(content);
  container.appendChild(_knRoot);

  agentDesk.knowledge.entries().then((entries) => {
    _knEntries = entries || [];
    _renderKnTab();
  });

  agentDesk.knowledge.sessions().then((sessions) => {
    _knSessions = sessions || [];
    _knSessionsLoaded = true;
  });

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
  _knEntries = [];
  _knSessions = [];
  _knSearchResults = [];
  _knSearchQuery = '';
  _knSearchLoading = false;
  _knSelectedCategory = '';
  _knExpandedEntry = null;
  _knExpandedSession = null;
  _knSessionProjectFilter = '';
  _knSessionsLoaded = false;
}
