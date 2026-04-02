// =============================================================================
// Agent Desk — Native Tasks View
// =============================================================================
// Kanban board with columns per pipeline stage (backlog -> done)
// Feature-complete port of the standalone agent-tasks dashboard
// Uses window.agentDesk.tasks.* IPC calls
// =============================================================================

'use strict';

let _tasksRoot = null;
let _tasksCleanup = null;
let _tasksList = [];
let _tasksPanelId = null;
let _tasksCollapsed = new Set();
let _tasksColumnCounts = new Map();
let _keydownHandler = null;
let _panelResizeCleanup = null;

const _filters = { search: '', project: '', assignee: '', minPriority: 0 };
let _searchDebounce = null;

const STAGES = ['backlog', 'spec', 'plan', 'implement', 'test', 'review', 'done'];
const ALL_STAGES = [...STAGES, 'cancelled'];

const STAGE_ICONS = {
  backlog: 'inbox',
  spec: 'description',
  plan: 'map',
  implement: 'code',
  test: 'science',
  review: 'rate_review',
  done: 'check_circle',
  cancelled: 'cancel',
};

const STAGE_EMPTY = {
  backlog: { icon: 'inbox', text: 'Nothing in backlog' },
  spec: { icon: 'description', text: 'No specs yet' },
  plan: { icon: 'map', text: 'No plans in progress' },
  implement: { icon: 'code', text: 'Nothing being built' },
  test: { icon: 'science', text: 'Nothing to test' },
  review: { icon: 'rate_review', text: 'Nothing in review' },
  done: { icon: 'check_circle', text: 'No completed tasks' },
  cancelled: { icon: 'cancel', text: 'No cancelled tasks' },
};

const STATUS_ICONS = {
  pending: 'radio_button_unchecked',
  in_progress: 'pending',
  completed: 'check_circle',
  failed: 'cancel',
  cancelled: 'block',
};

const CARDS_PER_PAGE = 20;

const AVATAR_COLORS = [
  '#5d8da8',
  '#6f42c1',
  '#27ae60',
  '#d4870e',
  '#c0392b',
  '#007bff',
  '#5856d6',
  '#f59e0b',
  '#e83e8c',
  '#20c997',
];

// --- Styles ---

function _tasksStyles() {
  return `
    .tasks-view { display: flex; flex-direction: column; height: 100%; font-family: var(--font, 'Inter', sans-serif); color: var(--text, #c8d1da); background: var(--bg, #1a1d23); }

    /* Filter bar */
    .tasks-filter-bar { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--border, #2d323b); background: var(--surface, #21252b); flex-shrink: 0; }
    .tasks-filter-bar .material-symbols-outlined { font-size: 18px; color: var(--text-dim, #4a5260); }
    .tasks-filter-input { flex: 1; max-width: 260px; padding: 5px 10px; border: 1px solid var(--border, #2d323b); border-radius: var(--radius, 8px); background: var(--bg, #1a1d23); color: var(--text, #c8d1da); font-family: var(--font, 'Inter', sans-serif); font-size: 12px; outline: none; transition: border-color 0.15s; }
    .tasks-filter-input:focus { border-color: var(--accent, #5d8da8); box-shadow: 0 0 0 2px rgba(93,141,168,0.2); }
    .tasks-filter-input::placeholder { color: var(--text-dim, #4a5260); }
    .tasks-filter-select { padding: 5px 8px; border: 1px solid var(--border, #2d323b); border-radius: var(--radius, 8px); background: var(--bg, #1a1d23); color: var(--text, #c8d1da); font-family: var(--font, 'Inter', sans-serif); font-size: 12px; cursor: pointer; outline: none; }
    .tasks-filter-select:focus { border-color: var(--accent, #5d8da8); }
    .tasks-stats { display: flex; gap: 14px; margin-left: auto; font-size: 12px; color: var(--text-muted, #6b7785); }
    .tasks-stat { display: flex; align-items: center; gap: 4px; }
    .tasks-stat-value { font-weight: 600; color: var(--text, #c8d1da); }

    /* Board */
    .tasks-board { display: flex; gap: 10px; padding: 12px; flex: 1; overflow-x: auto; overflow-y: hidden; }

    /* Column */
    .tasks-column { display: flex; flex-direction: column; min-width: 230px; max-width: 300px; flex: 1; background: var(--surface, #21252b); border-radius: var(--radius, 8px); border: 1px solid var(--border, #2d323b); transition: all 0.2s; }
    .tasks-column.collapsed { min-width: 44px; max-width: 44px; cursor: pointer; }
    .tasks-column.collapsed .tasks-column-body,
    .tasks-column.collapsed .tasks-column-footer { display: none; }
    .tasks-column.collapsed .tasks-column-header { writing-mode: vertical-rl; text-orientation: mixed; padding: 12px 8px; gap: 8px; justify-content: flex-start; }
    .tasks-column-header { padding: 10px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border, #2d323b); display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; transition: background 0.15s; }
    .tasks-column-header:hover { background: var(--surface-hover, #282d35); }
    .tasks-column-header .material-symbols-outlined { font-size: 16px; }
    .tasks-column-header-left { display: flex; align-items: center; gap: 6px; flex: 1; }
    .tasks-column-count { background: var(--bg, #1a1d23); padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; min-width: 22px; text-align: center; }
    .tasks-column-count.wip-warning { background: rgba(212, 135, 14, 0.2); color: var(--warning, #d4870e); }
    .tasks-column-count.wip-danger { background: rgba(192, 57, 43, 0.2); color: var(--danger, #c0392b); }
    .tasks-column-body { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
    .tasks-column-footer { padding: 6px 8px; }
    .tasks-show-more { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 10px; background: none; border: 1px dashed var(--border, #2d323b); border-radius: 6px; color: var(--text-muted, #6b7785); font-size: 11px; cursor: pointer; width: 100%; transition: all 0.15s; }
    .tasks-show-more:hover { border-color: var(--accent, #5d8da8); color: var(--accent, #5d8da8); }
    .tasks-show-more .material-symbols-outlined { font-size: 16px; }

    /* Empty column */
    .tasks-empty-col { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 12px; color: var(--text-muted, #6b7785); text-align: center; gap: 6px; }
    .tasks-empty-col .material-symbols-outlined { font-size: 32px; opacity: 0.4; }
    .tasks-empty-col-text { font-size: 12px; opacity: 0.7; }

    /* Card */
    .tasks-card { background: var(--bg, #1a1d23); border: 1px solid var(--border, #2d323b); border-radius: 6px; padding: 10px; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
    .tasks-card:hover { border-color: var(--accent, #5d8da8); box-shadow: var(--shadow-1, 0 1px 3px rgba(0,0,0,0.3)); }
    .tasks-card.active-card { border-color: var(--accent, #5d8da8); box-shadow: 0 0 0 1px var(--accent, #5d8da8); }
    .tasks-card.priority-high { border-left: 3px solid var(--danger, #c0392b); }
    .tasks-card.priority-medium { border-left: 3px solid var(--warning, #d4870e); }
    .tasks-card.status-completed { opacity: 0.7; }
    .tasks-card.status-failed { border-left: 3px solid var(--danger, #c0392b); }
    .tasks-card.status-cancelled { opacity: 0.5; }

    /* Card header */
    .tasks-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .tasks-card-id { font-size: 11px; font-family: var(--font-mono, 'JetBrains Mono', monospace); color: var(--text-muted, #6b7785); display: flex; align-items: center; gap: 3px; }
    .tasks-card-id .material-symbols-outlined { font-size: 14px; }
    .tasks-card-id .status-pending { color: var(--text-muted, #6b7785); }
    .tasks-card-id .status-in_progress { color: var(--accent, #5d8da8); }
    .tasks-card-id .status-completed { color: var(--success, #27ae60); }
    .tasks-card-id .status-failed { color: var(--danger, #c0392b); }
    .tasks-card-id .status-cancelled { color: var(--text-muted, #6b7785); }
    .tasks-card-time { font-size: 10px; color: var(--text-dim, #4a5260); }

    /* Card title */
    .tasks-card-title { font-size: 13px; font-weight: 500; line-height: 1.3; margin-bottom: 4px; }
    .tasks-card-desc-preview { font-size: 11px; color: var(--text-muted, #6b7785); line-height: 1.3; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Card footer */
    .tasks-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
    .tasks-card-tags { display: flex; flex-wrap: wrap; gap: 3px; flex: 1; }
    .tasks-tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; line-height: 1.5; }
    .tasks-tag-project { background: rgba(93,141,168,0.15); color: var(--accent, #5d8da8); }
    .tasks-tag-priority { background: rgba(212,135,14,0.15); color: var(--warning, #d4870e); }
    .tasks-tag-priority-high { background: rgba(192,57,43,0.15); color: var(--danger, #c0392b); }
    .tasks-tag-blocked { background: rgba(192,57,43,0.15); color: var(--danger, #c0392b); }
    .tasks-tag-subtasks { background: rgba(93,141,168,0.15); color: var(--accent, #5d8da8); }
    .tasks-tag-tags { background: rgba(111,66,193,0.15); color: #8e9ad0; }

    /* Assignee avatar */
    .tasks-avatar { width: 22px; height: 22px; border-radius: 50%; font-size: 10px; font-weight: 600; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }

    /* Subtask progress bar */
    .tasks-progress { height: 3px; background: var(--border, #2d323b); border-radius: 2px; margin-top: 6px; overflow: hidden; }
    .tasks-progress-fill { height: 100%; border-radius: 2px; background: var(--accent, #5d8da8); transition: width 0.3s; }

    /* Side panel */
    .tasks-panel-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); z-index: 999; }
    .tasks-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 480px; max-width: 85vw; background: var(--surface, #21252b); border-left: 1px solid var(--border, #2d323b); box-shadow: var(--shadow-2, 0 4px 12px rgba(0,0,0,0.4)); z-index: 1000; display: flex; flex-direction: column; overflow: hidden; animation: tasks-slide-in 0.2s ease; }
    @keyframes tasks-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
    .tasks-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border, #2d323b); flex-shrink: 0; }
    .tasks-panel-header-left { display: flex; align-items: center; gap: 8px; }
    .tasks-panel-task-id { font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 13px; color: var(--text-muted, #6b7785); }
    .tasks-panel-stage { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .tasks-panel-close { background: none; border: 1px solid var(--border, #2d323b); border-radius: 6px; cursor: pointer; padding: 4px 6px; color: var(--text-muted, #6b7785); line-height: 1; transition: all 0.15s; display: flex; align-items: center; }
    .tasks-panel-close:hover { color: var(--text, #c8d1da); border-color: var(--accent, #5d8da8); }
    .tasks-panel-close .material-symbols-outlined { font-size: 18px; }
    .tasks-panel-body { flex: 1; overflow-y: auto; padding: 16px; }
    .tasks-panel-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; line-height: 1.3; }

    /* Panel sections */
    .tasks-panel-section { margin-bottom: 20px; }
    .tasks-panel-section-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted, #6b7785); margin-bottom: 10px; }
    .tasks-panel-section-title .material-symbols-outlined { font-size: 16px; }

    /* Panel detail grid */
    .tasks-panel-grid { display: grid; grid-template-columns: 100px 1fr; gap: 6px 12px; font-size: 13px; }
    .tasks-panel-label { color: var(--text-muted, #6b7785); font-weight: 500; }
    .tasks-panel-value { color: var(--text, #c8d1da); word-break: break-word; }

    /* Panel description */
    .tasks-panel-desc { font-size: 13px; line-height: 1.6; color: var(--text, #c8d1da); white-space: pre-wrap; word-break: break-word; padding: 10px 12px; background: var(--bg, #1a1d23); border-radius: 6px; border: 1px solid var(--border, #2d323b); max-height: 300px; overflow-y: auto; }

    /* Panel dependencies */
    .tasks-panel-dep { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--bg, #1a1d23); border-radius: 6px; border: 1px solid var(--border, #2d323b); margin-bottom: 4px; cursor: pointer; font-size: 13px; transition: border-color 0.15s; }
    .tasks-panel-dep:hover { border-color: var(--accent, #5d8da8); }
    .tasks-panel-dep-id { font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 12px; color: var(--accent, #5d8da8); }
    .tasks-panel-dep-stage { font-size: 10px; font-weight: 600; text-transform: uppercase; padding: 1px 6px; border-radius: 3px; margin-left: auto; }

    /* Panel tags */
    .tasks-panel-tags { display: flex; flex-wrap: wrap; gap: 4px; }
    .tasks-panel-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; background: rgba(111,66,193,0.15); color: #8e9ad0; }

    /* Board empty state */
    .tasks-board-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted, #6b7785); text-align: center; gap: 12px; padding: 40px; }
    .tasks-board-empty .material-symbols-outlined { font-size: 56px; opacity: 0.3; }
    .tasks-board-empty h3 { font-size: 16px; font-weight: 600; }
    .tasks-board-empty p { font-size: 13px; max-width: 360px; opacity: 0.7; }

    /* Resize handle */
    .tasks-panel-resize { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; cursor: col-resize; z-index: 10; }
    .tasks-panel-resize:hover { background: var(--accent, #5d8da8); opacity: 0.5; }
  `;
}

// --- Helpers ---

function _esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function _timeAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts.endsWith?.('Z') ? ts : ts + 'Z');
  const diff = Date.now() - d.getTime();
  if (diff < 0 || diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  const days = Math.floor(diff / 86400000);
  if (days < 30) return days + 'd ago';
  if (days < 365) return Math.floor(days / 30) + 'mo ago';
  return Math.floor(days / 365) + 'y ago';
}

function _formatDate(iso) {
  if (!iso) return '\u2014';
  try {
    const d = new Date(iso.endsWith?.('Z') ? iso : iso + 'Z');
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function _avatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function _avatarInitials(name) {
  if (!name) return '?';
  const parts = name
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .split(/[\s-]+/)
    .filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function _stageColor(stage) {
  const map = {
    backlog: 'var(--text-muted, #8b949e)',
    spec: '#58a6ff',
    plan: '#818cf8',
    implement: '#8b5cf6',
    test: 'var(--warning, #d4870e)',
    review: '#f59e0b',
    done: 'var(--success, #27ae60)',
    cancelled: 'var(--danger, #c0392b)',
  };
  return map[stage] || 'var(--text-muted, #8b949e)';
}

// --- Filtering ---

function _getFilteredTasks() {
  return _tasksList.filter((t) => {
    if (_filters.project && t.project !== _filters.project) return false;
    if (_filters.assignee && t.assigned_to !== _filters.assignee) return false;
    if (_filters.minPriority && t.priority < _filters.minPriority) return false;
    if (_filters.search) {
      const q = _filters.search.toLowerCase();
      const inTitle = (t.title || '').toLowerCase().includes(q);
      const inDesc = (t.description || '').toLowerCase().includes(q);
      const inId = `#${t.id}`.includes(q);
      if (!inTitle && !inDesc && !inId) return false;
    }
    return true;
  });
}

// --- Subtask progress (derived from parent_id) ---

function _getSubtaskProgress() {
  const progress = {};
  for (const t of _tasksList) {
    if (t.parent_id) {
      if (!progress[t.parent_id]) progress[t.parent_id] = { total: 0, done: 0 };
      progress[t.parent_id].total++;
      if (t.status === 'completed' || t.stage === 'done') progress[t.parent_id].done++;
    }
  }
  return progress;
}

// --- Dependency detection (from parent_id chain, blocked = has parent not done) ---

function _getBlockedIds() {
  const blocked = new Set();
  for (const t of _tasksList) {
    if (t.parent_id) {
      const parent = _tasksList.find((p) => p.id === t.parent_id);
      if (parent && parent.stage !== 'done' && parent.status !== 'completed') {
        // child doesn't auto-block on parent in real model, skip
      }
    }
  }
  return blocked;
}

// --- Card rendering ---

function _renderCard(task, subtaskProgress) {
  const statusIcon = STATUS_ICONS[task.status] || 'radio_button_unchecked';
  const timeAgo = _timeAgo(task.updated_at);
  const descPreview = task.description ? task.description.split('\n')[0].substring(0, 100) : '';
  const isActive = _tasksPanelId === task.id;

  const priorityClass = task.priority >= 5 ? ' priority-high' : task.priority >= 3 ? ' priority-medium' : '';
  const statusClass =
    task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
      ? ` status-${task.status}`
      : '';
  const activeClass = isActive ? ' active-card' : '';

  const tags = [];
  if (task.project) tags.push(`<span class="tasks-tag tasks-tag-project">${_esc(task.project)}</span>`);
  if (task.priority > 0) {
    const pClass = task.priority >= 5 ? 'tasks-tag-priority-high' : 'tasks-tag-priority';
    tags.push(`<span class="tasks-tag ${pClass}">P${task.priority}</span>`);
  }

  const progress = subtaskProgress[task.id];
  if (progress && progress.total > 0) {
    tags.push(`<span class="tasks-tag tasks-tag-subtasks">${progress.done}/${progress.total}</span>`);
  }

  let parsedTags = [];
  if (task.tags) {
    try {
      parsedTags = JSON.parse(task.tags);
    } catch {
      /* ignore */
    }
    if (Array.isArray(parsedTags) && parsedTags.length) {
      for (const tg of parsedTags.slice(0, 3)) {
        tags.push(`<span class="tasks-tag tasks-tag-tags">${_esc(tg)}</span>`);
      }
    }
  }

  const assigneeHtml = task.assigned_to
    ? `<div class="tasks-avatar" style="background:${_avatarColor(task.assigned_to)}" title="${_esc(task.assigned_to)}">${_esc(_avatarInitials(task.assigned_to))}</div>`
    : '';

  let progressBar = '';
  if (progress && progress.total > 0) {
    const pct = Math.round((progress.done / progress.total) * 100);
    progressBar = `<div class="tasks-progress"><div class="tasks-progress-fill" style="width:${pct}%"></div></div>`;
  }

  return `<div class="tasks-card${priorityClass}${statusClass}${activeClass}" data-task-id="${task.id}">
    <div class="tasks-card-header">
      <span class="tasks-card-id">#${task.id}<span class="material-symbols-outlined status-${task.status}">${statusIcon}</span></span>
      ${timeAgo ? `<span class="tasks-card-time">${_esc(timeAgo)}</span>` : ''}
    </div>
    <div class="tasks-card-title">${_esc(task.title)}</div>
    ${descPreview ? `<div class="tasks-card-desc-preview">${_esc(descPreview)}</div>` : ''}
    <div class="tasks-card-footer">
      <div class="tasks-card-tags">${tags.join('')}</div>
      ${assigneeHtml}
    </div>
    ${progressBar}
  </div>`;
}

// --- Filter dropdowns ---

function _updateFilterDropdowns() {
  if (!_tasksRoot) return;
  const projects = [...new Set(_tasksList.map((t) => t.project).filter(Boolean))].sort();
  const assignees = [...new Set(_tasksList.map((t) => t.assigned_to).filter(Boolean))].sort();

  const projSelect = _tasksRoot.querySelector('.tasks-filter-project');
  if (projSelect) {
    const cur = projSelect.value;
    projSelect.innerHTML =
      '<option value="">All projects</option>' +
      projects.map((p) => `<option value="${_esc(p)}">${_esc(p)}</option>`).join('');
    projSelect.value = cur;
  }

  const assignSelect = _tasksRoot.querySelector('.tasks-filter-assignee');
  if (assignSelect) {
    const cur = assignSelect.value;
    assignSelect.innerHTML =
      '<option value="">All assignees</option>' +
      assignees.map((a) => `<option value="${_esc(a)}">${_esc(a)}</option>`).join('');
    assignSelect.value = cur;
  }
}

// --- Board rendering ---

function _renderBoard() {
  if (!_tasksRoot) return;
  const board = _tasksRoot.querySelector('.tasks-board');
  if (!board) return;

  const filtered = _getFilteredTasks();
  const subtaskProgress = _getSubtaskProgress();

  // Stats
  const statsEl = _tasksRoot.querySelector('.tasks-stats');
  if (statsEl) {
    const total = _tasksList.length;
    const active = _tasksList.filter((t) => t.status === 'in_progress').length;
    const pending = _tasksList.filter((t) => t.status === 'pending').length;
    const done = _tasksList.filter((t) => t.status === 'completed').length;
    statsEl.innerHTML =
      `<span class="tasks-stat">Total <span class="tasks-stat-value">${total}</span></span>` +
      `<span class="tasks-stat">Active <span class="tasks-stat-value">${active}</span></span>` +
      `<span class="tasks-stat">Pending <span class="tasks-stat-value">${pending}</span></span>` +
      `<span class="tasks-stat">Done <span class="tasks-stat-value">${done}</span></span>`;
  }

  _updateFilterDropdowns();

  // Empty state
  if (_tasksList.length === 0) {
    board.innerHTML = `<div class="tasks-board-empty">
      <span class="material-symbols-outlined">view_kanban</span>
      <h3>No tasks yet</h3>
      <p>Create tasks via MCP tools (task_create) or the REST API to get started.</p>
    </div>`;
    return;
  }

  // Group by stage
  const byStage = {};
  for (const s of ALL_STAGES) byStage[s] = [];
  for (const t of filtered) {
    const stage = t.stage || 'backlog';
    if (byStage[stage]) byStage[stage].push(t);
    else byStage['backlog'].push(t);
  }
  for (const s of ALL_STAGES) {
    byStage[s].sort((a, b) => b.priority - a.priority);
  }

  // Determine which columns to show
  const columnsToShow = [...STAGES];
  if (byStage['cancelled']?.length > 0) columnsToShow.push('cancelled');

  board.innerHTML = columnsToShow
    .map((stage) => {
      const tasks = byStage[stage] || [];
      const isCollapsed = _tasksCollapsed.has(stage);
      const colClass = isCollapsed ? 'tasks-column collapsed' : 'tasks-column';
      const icon = STAGE_ICONS[stage] || 'label';
      const color = _stageColor(stage);

      let countClass = 'tasks-column-count';
      if (tasks.length >= 8) countClass += ' wip-danger';
      else if (tasks.length >= 5) countClass += ' wip-warning';

      const emptyMsg = STAGE_EMPTY[stage] || { icon: 'label', text: 'No tasks' };
      const visibleCount = _tasksColumnCounts.get(stage) || CARDS_PER_PAGE;
      const remaining = Math.max(0, tasks.length - visibleCount);

      let bodyContent;
      if (tasks.length === 0 && !isCollapsed) {
        bodyContent = `<div class="tasks-empty-col">
        <span class="material-symbols-outlined">${emptyMsg.icon}</span>
        <div class="tasks-empty-col-text">${_esc(emptyMsg.text)}</div>
      </div>`;
      } else {
        const visible = tasks.slice(0, visibleCount);
        bodyContent = visible.map((t) => _renderCard(t, subtaskProgress)).join('');
      }

      let showMoreHtml = '';
      if (remaining > 0 && !isCollapsed) {
        showMoreHtml = `<div class="tasks-column-footer">
        <button class="tasks-show-more" data-stage="${_esc(stage)}">
          <span class="material-symbols-outlined">expand_more</span>Show ${remaining} more
        </button>
      </div>`;
      }

      return `<div class="${colClass}" data-stage="${_esc(stage)}">
      <div class="tasks-column-header" data-stage="${_esc(stage)}" style="color:${color}">
        <div class="tasks-column-header-left">
          <span class="material-symbols-outlined">${icon}</span>
          ${_esc(stage)}
        </div>
        <span class="${countClass}">${tasks.length}</span>
      </div>
      <div class="tasks-column-body">${bodyContent}</div>
      ${showMoreHtml}
    </div>`;
    })
    .join('');

  // Bind card clicks
  board.querySelectorAll('.tasks-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.taskId, 10);
      _openPanel(id);
    });
  });

  // Bind column header clicks (collapse/expand)
  board.querySelectorAll('.tasks-column-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.tasks-card')) return;
      const stage = header.dataset.stage;
      if (_tasksCollapsed.has(stage)) _tasksCollapsed.delete(stage);
      else _tasksCollapsed.add(stage);
      _renderBoard();
    });
  });

  // Bind collapsed column clicks
  board.querySelectorAll('.tasks-column.collapsed').forEach((col) => {
    col.addEventListener('click', () => {
      const stage = col.dataset.stage;
      _tasksCollapsed.delete(stage);
      _renderBoard();
    });
  });

  // Bind show-more buttons
  board.querySelectorAll('.tasks-show-more').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const stage = btn.dataset.stage;
      const cur = _tasksColumnCounts.get(stage) || CARDS_PER_PAGE;
      _tasksColumnCounts.set(stage, cur + CARDS_PER_PAGE);
      _renderBoard();
    });
  });
}

// --- Side panel ---

function _openPanel(id) {
  const task = _tasksList.find((t) => t.id === id);
  if (!task) return;
  _tasksPanelId = id;
  _renderBoard();
  _renderPanel(task);
}

function _closePanel() {
  _tasksPanelId = null;
  if (_panelResizeCleanup) {
    _panelResizeCleanup();
    _panelResizeCleanup = null;
  }
  const existing = _tasksRoot?.querySelector('.tasks-panel-backdrop');
  if (existing) existing.remove();
  const panel = _tasksRoot?.querySelector('.tasks-panel');
  if (panel) panel.remove();
  _renderBoard();
}

function _renderPanel(task) {
  if (_panelResizeCleanup) {
    _panelResizeCleanup();
    _panelResizeCleanup = null;
  }
  _tasksRoot?.querySelector('.tasks-panel-backdrop')?.remove();
  _tasksRoot?.querySelector('.tasks-panel')?.remove();

  const stageColor = _stageColor(task.stage);

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'tasks-panel-backdrop';
  backdrop.addEventListener('click', _closePanel);

  // Panel
  const panel = document.createElement('div');
  panel.className = 'tasks-panel';

  // Header
  const headerHtml = `
    <div class="tasks-panel-header">
      <div class="tasks-panel-header-left">
        <span class="tasks-panel-task-id">#${task.id}</span>
        <span class="tasks-panel-stage" style="background:${stageColor}22;color:${stageColor}">${_esc(task.stage)}</span>
      </div>
      <button class="tasks-panel-close"><span class="material-symbols-outlined">close</span></button>
    </div>`;

  // Body
  let bodyHtml = `<div class="tasks-panel-title">${_esc(task.title)}</div>`;

  // Details grid
  bodyHtml += `<div class="tasks-panel-section">
    <div class="tasks-panel-section-title"><span class="material-symbols-outlined">info</span>Details</div>
    <div class="tasks-panel-grid">
      <span class="tasks-panel-label">Status</span><span class="tasks-panel-value">${_esc(task.status)}</span>
      <span class="tasks-panel-label">Priority</span><span class="tasks-panel-value">P${task.priority}</span>
      <span class="tasks-panel-label">Created by</span><span class="tasks-panel-value">${_esc(task.created_by || '\u2014')}</span>
      <span class="tasks-panel-label">Assigned to</span><span class="tasks-panel-value">${_esc(task.assigned_to || '\u2014')}</span>
      <span class="tasks-panel-label">Project</span><span class="tasks-panel-value">${_esc(task.project || '\u2014')}</span>
      <span class="tasks-panel-label">Created</span><span class="tasks-panel-value">${_formatDate(task.created_at)}</span>
      <span class="tasks-panel-label">Updated</span><span class="tasks-panel-value">${_timeAgo(task.updated_at) || _formatDate(task.updated_at)}</span>
    </div>
  </div>`;

  // Parent
  if (task.parent_id) {
    const parent = _tasksList.find((t) => t.id === task.parent_id);
    bodyHtml += `<div class="tasks-panel-section">
      <div class="tasks-panel-section-title"><span class="material-symbols-outlined">account_tree</span>Parent</div>
      <div class="tasks-panel-dep" data-nav-id="${task.parent_id}">
        <span class="tasks-panel-dep-id">#${task.parent_id}</span>
        <span>${_esc(parent ? parent.title : 'Task')}</span>
        ${parent ? `<span class="tasks-panel-dep-stage" style="background:${_stageColor(parent.stage)}22;color:${_stageColor(parent.stage)}">${_esc(parent.stage)}</span>` : ''}
      </div>
    </div>`;
  }

  // Tags
  if (task.tags) {
    let parsedTags = [];
    try {
      parsedTags = JSON.parse(task.tags);
    } catch {
      /* ignore */
    }
    if (Array.isArray(parsedTags) && parsedTags.length) {
      bodyHtml += `<div class="tasks-panel-section">
        <div class="tasks-panel-section-title"><span class="material-symbols-outlined">label</span>Tags</div>
        <div class="tasks-panel-tags">${parsedTags.map((t) => `<span class="tasks-panel-tag">${_esc(t)}</span>`).join('')}</div>
      </div>`;
    }
  }

  // Description
  if (task.description) {
    bodyHtml += `<div class="tasks-panel-section">
      <div class="tasks-panel-section-title"><span class="material-symbols-outlined">notes</span>Description</div>
      <div class="tasks-panel-desc">${_esc(task.description)}</div>
    </div>`;
  }

  // Result
  if (task.result) {
    bodyHtml += `<div class="tasks-panel-section">
      <div class="tasks-panel-section-title"><span class="material-symbols-outlined">output</span>Result</div>
      <div class="tasks-panel-desc">${_esc(task.result)}</div>
    </div>`;
  }

  // Subtasks
  const subtasks = _tasksList.filter((t) => t.parent_id === task.id);
  if (subtasks.length) {
    const doneCount = subtasks.filter((s) => s.status === 'completed' || s.stage === 'done').length;
    bodyHtml += `<div class="tasks-panel-section">
      <div class="tasks-panel-section-title"><span class="material-symbols-outlined">account_tree</span>Subtasks (${doneCount}/${subtasks.length})</div>`;
    if (subtasks.length > 0) {
      const pct = Math.round((doneCount / subtasks.length) * 100);
      bodyHtml += `<div class="tasks-progress" style="margin-bottom:10px;height:4px"><div class="tasks-progress-fill" style="width:${pct}%"></div></div>`;
    }
    for (const s of subtasks) {
      const sColor = _stageColor(s.stage);
      bodyHtml += `<div class="tasks-panel-dep" data-nav-id="${s.id}">
        <span class="tasks-panel-dep-id">#${s.id}</span>
        <span>${_esc(s.title)}</span>
        <span class="tasks-panel-dep-stage" style="background:${sColor}22;color:${sColor}">${_esc(s.stage)}</span>
      </div>`;
    }
    bodyHtml += '</div>';
  }

  panel.innerHTML = headerHtml + `<div class="tasks-panel-body">${bodyHtml}</div>`;

  // Resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'tasks-panel-resize';
  panel.appendChild(resizeHandle);

  _tasksRoot.appendChild(backdrop);
  _tasksRoot.appendChild(panel);

  // Event handlers
  panel.querySelector('.tasks-panel-close').addEventListener('click', _closePanel);

  // Navigate to subtask/parent
  panel.querySelectorAll('[data-nav-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const navId = parseInt(el.dataset.navId, 10);
      _openPanel(navId);
    });
  });

  // Panel resize
  let resizing = false,
    startX = 0,
    startW = 0;
  resizeHandle.addEventListener('mousedown', (e) => {
    resizing = true;
    startX = e.clientX;
    startW = panel.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  const onMouseMove = (e) => {
    if (!resizing) return;
    const dx = startX - e.clientX;
    const newW = Math.max(360, Math.min(startW + dx, window.innerWidth * 0.85));
    panel.style.width = newW + 'px';
  };
  const onMouseUp = () => {
    if (!resizing) return;
    resizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  _panelResizeCleanup = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
}

// --- Init / Destroy ---

export function initTasksView(container) {
  const style = document.createElement('style');
  style.id = 'tasks-view-styles';
  style.textContent = _tasksStyles();
  document.head.appendChild(style);

  _tasksRoot = document.createElement('div');
  _tasksRoot.className = 'tasks-view';

  // Filter bar
  const filterBar = document.createElement('div');
  filterBar.className = 'tasks-filter-bar';
  filterBar.innerHTML = `
    <span class="material-symbols-outlined">filter_list</span>
    <input type="text" class="tasks-filter-input" placeholder="Search tasks... (/ or Ctrl+K)" autocomplete="off" />
    <select class="tasks-filter-select tasks-filter-project"><option value="">All projects</option></select>
    <select class="tasks-filter-select tasks-filter-assignee"><option value="">All assignees</option></select>
    <select class="tasks-filter-select tasks-filter-priority">
      <option value="">Any priority</option>
      <option value="1">P1+</option>
      <option value="3">P3+</option>
      <option value="5">P5+</option>
      <option value="10">P10+</option>
    </select>
    <div class="tasks-stats"></div>
  `;

  // Filter event handlers
  const searchInput = filterBar.querySelector('.tasks-filter-input');
  searchInput.addEventListener('input', (e) => {
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => {
      _filters.search = e.target.value;
      _tasksColumnCounts.clear();
      _renderBoard();
    }, 200);
  });

  filterBar.querySelector('.tasks-filter-project').addEventListener('change', (e) => {
    _filters.project = e.target.value;
    _tasksColumnCounts.clear();
    _renderBoard();
  });

  filterBar.querySelector('.tasks-filter-assignee').addEventListener('change', (e) => {
    _filters.assignee = e.target.value;
    _tasksColumnCounts.clear();
    _renderBoard();
  });

  filterBar.querySelector('.tasks-filter-priority').addEventListener('change', (e) => {
    _filters.minPriority = parseInt(e.target.value) || 0;
    _tasksColumnCounts.clear();
    _renderBoard();
  });

  const board = document.createElement('div');
  board.className = 'tasks-board';

  _tasksRoot.appendChild(filterBar);
  _tasksRoot.appendChild(board);
  container.appendChild(_tasksRoot);

  // Keyboard shortcuts
  _keydownHandler = (e) => {
    if (e.key === 'Escape' && _tasksPanelId) {
      _closePanel();
      return;
    }
    const isInput =
      document.activeElement?.tagName === 'INPUT' ||
      document.activeElement?.tagName === 'TEXTAREA' ||
      document.activeElement?.getAttribute('contenteditable') === 'true';
    if ((e.key === '/' && !e.ctrlKey && !e.metaKey && !isInput) || ((e.ctrlKey || e.metaKey) && e.key === 'k')) {
      e.preventDefault();
      searchInput.focus();
    }
  };
  document.addEventListener('keydown', _keydownHandler);

  // Initial load
  agentDesk.tasks.getState().then((data) => {
    if (data && data.tasks) {
      _tasksList = data.tasks;
      _renderBoard();
    }
  });

  // Subscribe to updates
  _tasksCleanup = agentDesk.tasks.onUpdate((data) => {
    if (data && data.tasks) {
      _tasksList = data.tasks;
      _renderBoard();
      if (_tasksPanelId) {
        const updated = _tasksList.find((t) => t.id === _tasksPanelId);
        if (updated) _renderPanel(updated);
        else _closePanel();
      }
    }
  });
}

export function destroyTasksView() {
  if (_tasksCleanup) {
    _tasksCleanup();
    _tasksCleanup = null;
  }
  if (_panelResizeCleanup) {
    _panelResizeCleanup();
    _panelResizeCleanup = null;
  }
  if (_keydownHandler) {
    document.removeEventListener('keydown', _keydownHandler);
    _keydownHandler = null;
  }
  const style = document.getElementById('tasks-view-styles');
  if (style) style.remove();
  if (_tasksRoot) {
    _tasksRoot.remove();
    _tasksRoot = null;
  }
  _tasksList = [];
  _tasksPanelId = null;
  _tasksCollapsed.clear();
  _tasksColumnCounts.clear();
  _filters.search = '';
  _filters.project = '';
  _filters.assignee = '';
  _filters.minPriority = 0;
}
