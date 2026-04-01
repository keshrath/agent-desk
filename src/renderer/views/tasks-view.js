// =============================================================================
// Agent Desk — Native Tasks View
// =============================================================================
// Kanban board with columns per pipeline stage (backlog -> done)
// Uses window.agentDesk.tasks.* IPC calls
// =============================================================================

'use strict';

let _tasksRoot = null;
let _tasksCleanup = null;
let _tasksList = [];
let _tasksFilter = '';
let _tasksExpandedId = null;

const STAGES = ['backlog', 'spec', 'plan', 'implement', 'test', 'review', 'done'];

const STAGE_COLORS = {
  backlog: '#8b949e',
  spec: '#d2a8ff',
  plan: '#79c0ff',
  implement: '#5d8da8',
  test: '#f0883e',
  review: '#d29922',
  done: '#3fb950',
};

const STATUS_COLORS = {
  pending: '#8b949e',
  in_progress: '#5d8da8',
  completed: '#3fb950',
  failed: '#f85149',
  cancelled: '#8b949e',
};

function _tasksStyles() {
  return `
    .tasks-view { display: flex; flex-direction: column; height: 100%; font-family: 'Inter', sans-serif; color: var(--text, #c8d1da); background: var(--bg, #1a1d23); }
    .tasks-toolbar { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--border, #2d323b); background: var(--bg-surface, #21252b); flex-shrink: 0; }
    .tasks-toolbar input { flex: 1; max-width: 320px; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border, #2d323b); background: var(--bg, #1a1d23); color: var(--text, #c8d1da); font-size: 13px; outline: none; }
    .tasks-toolbar input:focus { border-color: var(--accent, #5d8da8); }
    .tasks-toolbar-stats { font-size: 12px; color: var(--text-secondary, #8b949e); }
    .tasks-board { display: flex; gap: 10px; padding: 12px; flex: 1; overflow-x: auto; overflow-y: hidden; }
    .tasks-column { display: flex; flex-direction: column; min-width: 220px; max-width: 280px; flex: 1; background: var(--bg-surface, #21252b); border-radius: 8px; border: 1px solid var(--border, #2d323b); }
    .tasks-column-header { padding: 10px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border, #2d323b); display: flex; justify-content: space-between; align-items: center; }
    .tasks-column-count { background: var(--bg, #1a1d23); padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .tasks-column-cards { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
    .tasks-card { background: var(--bg, #1a1d23); border: 1px solid var(--border, #2d323b); border-radius: 6px; padding: 10px; cursor: pointer; transition: border-color 0.15s; }
    .tasks-card:hover { border-color: var(--accent, #5d8da8); }
    .tasks-card.expanded { border-color: var(--accent, #5d8da8); }
    .tasks-card-title { font-size: 13px; font-weight: 500; margin-bottom: 6px; line-height: 1.3; }
    .tasks-card-meta { display: flex; flex-wrap: wrap; gap: 4px; }
    .tasks-tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .tasks-tag-priority { background: rgba(240,136,62,0.2); color: #f0883e; }
    .tasks-tag-project { background: rgba(93,141,168,0.2); color: #5d8da8; }
    .tasks-tag-assignee { background: rgba(210,168,255,0.2); color: #d2a8ff; }
    .tasks-tag-status { padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .tasks-card-detail { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border, #2d323b); font-size: 12px; color: var(--text-secondary, #8b949e); }
    .tasks-card-desc { white-space: pre-wrap; word-break: break-word; max-height: 120px; overflow-y: auto; margin-bottom: 6px; }
    .tasks-card-info { display: flex; gap: 12px; font-size: 11px; }
    .tasks-card-info span { display: flex; align-items: center; gap: 3px; }
    .tasks-card-info .material-symbols-outlined { font-size: 14px; }
    .tasks-empty-col { display: flex; align-items: center; justify-content: center; padding: 24px; color: var(--text-secondary, #8b949e); font-size: 12px; opacity: 0.6; }
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

function _filterTasks(tasks) {
  if (!_tasksFilter) return tasks;
  const q = _tasksFilter.toLowerCase();
  return tasks.filter(
    (t) =>
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.project && t.project.toLowerCase().includes(q)) ||
      (t.assigned_to && t.assigned_to.toLowerCase().includes(q)),
  );
}

function _renderTaskCard(task) {
  const isExpanded = _tasksExpandedId === task.id;
  const statusColor = STATUS_COLORS[task.status] || '#8b949e';
  let html = `<div class="tasks-card${isExpanded ? ' expanded' : ''}" data-task-id="${_esc(task.id)}">`;
  html += `<div class="tasks-card-title">${_esc(task.title)}</div>`;
  html += '<div class="tasks-card-meta">';
  if (task.priority != null) html += `<span class="tasks-tag tasks-tag-priority">P${task.priority}</span>`;
  if (task.project) html += `<span class="tasks-tag tasks-tag-project">${_esc(task.project)}</span>`;
  if (task.assigned_to) html += `<span class="tasks-tag tasks-tag-assignee">${_esc(task.assigned_to)}</span>`;
  html += `<span class="tasks-tag tasks-tag-status" style="background:${statusColor}22;color:${statusColor}">${_esc(task.status)}</span>`;
  html += '</div>';

  if (isExpanded) {
    html += '<div class="tasks-card-detail">';
    if (task.description) html += `<div class="tasks-card-desc">${_esc(task.description)}</div>`;
    html += '<div class="tasks-card-info">';
    html += `<span><span class="material-symbols-outlined">schedule</span>${_timeAgo(task.created_at)}</span>`;
    if (task.created_by)
      html += `<span><span class="material-symbols-outlined">person</span>${_esc(task.created_by)}</span>`;
    html += '</div></div>';
  }
  html += '</div>';
  return html;
}

function _renderBoard() {
  const content = _tasksRoot?.querySelector('.tasks-board');
  if (!content) return;

  const filtered = _filterTasks(_tasksList);
  const byStage = {};
  STAGES.forEach((s) => (byStage[s] = []));
  filtered.forEach((t) => {
    const stage = t.stage || 'backlog';
    if (byStage[stage]) byStage[stage].push(t);
    else byStage['backlog'].push(t);
  });

  content.innerHTML = STAGES.map((stage) => {
    const tasks = byStage[stage];
    const color = STAGE_COLORS[stage];
    return `<div class="tasks-column">
      <div class="tasks-column-header" style="color:${color}">
        ${stage}<span class="tasks-column-count">${tasks.length}</span>
      </div>
      <div class="tasks-column-cards">
        ${tasks.length === 0 ? '<div class="tasks-empty-col">No tasks</div>' : tasks.map(_renderTaskCard).join('')}
      </div>
    </div>`;
  }).join('');

  // Stats
  const stats = _tasksRoot?.querySelector('.tasks-toolbar-stats');
  if (stats) stats.textContent = `${filtered.length} task${filtered.length !== 1 ? 's' : ''}`;

  // Card click handlers
  content.querySelectorAll('.tasks-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.taskId;
      _tasksExpandedId = _tasksExpandedId === id ? null : id;
      _renderBoard();
    });
  });
}

export function initTasksView(container) {
  const style = document.createElement('style');
  style.id = 'tasks-view-styles';
  style.textContent = _tasksStyles();
  document.head.appendChild(style);

  _tasksRoot = document.createElement('div');
  _tasksRoot.className = 'tasks-view';

  const toolbar = document.createElement('div');
  toolbar.className = 'tasks-toolbar';
  toolbar.innerHTML = `
    <input type="text" placeholder="Filter tasks..." />
    <span class="tasks-toolbar-stats"></span>
  `;
  const input = toolbar.querySelector('input');
  input.addEventListener('input', (e) => {
    _tasksFilter = e.target.value;
    _renderBoard();
  });

  const board = document.createElement('div');
  board.className = 'tasks-board';

  _tasksRoot.appendChild(toolbar);
  _tasksRoot.appendChild(board);
  container.appendChild(_tasksRoot);

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
    }
  });
}

export function destroyTasksView() {
  if (_tasksCleanup) {
    _tasksCleanup();
    _tasksCleanup = null;
  }
  const style = document.getElementById('tasks-view-styles');
  if (style) style.remove();
  if (_tasksRoot) {
    _tasksRoot.remove();
    _tasksRoot = null;
  }
}
