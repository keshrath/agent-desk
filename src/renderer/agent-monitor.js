// =============================================================================
// Agent Desk — Agent Monitor View
// =============================================================================
// Card-based dashboard showing all detected agents at a glance with live
// status, task assignments, and deep linking to terminals.
// =============================================================================

'use strict';

import { state, registry } from './state.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL = 2000;
const TASKS_POLL_INTERVAL = 10000;

// ---------------------------------------------------------------------------
// Cached API data
// ---------------------------------------------------------------------------

let _cachedTasks = [];
let _cachedCommAgents = [];
let _tasksLastFetch = 0;
let _commLastFetch = 0;
let _refreshTimer = null;

// ---------------------------------------------------------------------------
// API Fetching
// ---------------------------------------------------------------------------

async function _fetchTasks() {
  const now = Date.now();
  if (now - _tasksLastFetch < TASKS_POLL_INTERVAL && _cachedTasks.length > 0) {
    return _cachedTasks;
  }
  try {
    const res = await fetch('http://localhost:3422/api/tasks', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      _cachedTasks = Array.isArray(data) ? data : data.tasks || [];
      _tasksLastFetch = now;
    }
  } catch (_e) {
    /* service unavailable or timed out */
  }
  return _cachedTasks;
}

async function _fetchCommAgents() {
  const now = Date.now();
  if (now - _commLastFetch < TASKS_POLL_INTERVAL && _cachedCommAgents.length > 0) {
    return _cachedCommAgents;
  }
  try {
    const res = await fetch('http://localhost:3421/api/agents', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      _cachedCommAgents = Array.isArray(data) ? data : [];
      _commLastFetch = now;
    }
  } catch (_e) {
    /* service unavailable or timed out */
  }
  return _cachedCommAgents;
}

// ---------------------------------------------------------------------------
// Task matching (exported for terminals.js task badge)
// ---------------------------------------------------------------------------

export function getCachedTasks() {
  return _cachedTasks;
}

export async function pollTasks() {
  return _fetchTasks();
}

/**
 * Find a task assigned to a given agent name.
 * @param {string} agentName
 * @returns {object|null}
 */
export function findTaskForAgent(agentName) {
  if (!agentName) return null;
  const lower = agentName.toLowerCase();
  return (
    _cachedTasks.find((t) => {
      const assignee = (t.assigned_to || '').toLowerCase();
      return assignee === lower && t.stage !== 'done' && t.stage !== 'cancelled';
    }) || null
  );
}

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

function _deriveAgentStatus(ts, agentInfo) {
  if (ts.status === 'exited') {
    return ts._exitCode === 0 ? 'exited-ok' : 'exited-fail';
  }
  if (ts.status === 'waiting') return 'waiting';
  if (agentInfo && agentInfo.errors.length > 0) {
    const lastError = agentInfo.errors[agentInfo.errors.length - 1];
    if (Date.now() - lastError.time < 30000) return 'errored';
  }
  if (ts.status === 'running') return 'working';
  return 'idle';
}

function _statusLabel(status) {
  const labels = {
    idle: 'Idle',
    working: 'Working',
    waiting: 'Input needed',
    errored: 'Error',
    'exited-ok': 'Finished',
    'exited-fail': 'Failed',
  };
  return labels[status] || status;
}

function _statusColor(status) {
  const colors = {
    idle: 'var(--text-muted)',
    working: 'var(--accent)',
    waiting: 'var(--status-waiting)',
    errored: 'var(--status-exited)',
    'exited-ok': 'var(--status-running)',
    'exited-fail': 'var(--status-exited)',
  };
  return colors[status] || 'var(--text-muted)';
}

// ---------------------------------------------------------------------------
// Uptime formatting
// ---------------------------------------------------------------------------

function _formatUptime(ms) {
  if (ms < 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ' + (s % 60) + 's';
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm';
}

// ---------------------------------------------------------------------------
// View Rendering
// ---------------------------------------------------------------------------

let _container = null;

function _getContainer() {
  if (!_container) {
    _container = document.getElementById('view-monitor');
  }
  return _container;
}

function _friendlyTitle(title) {
  if (!title) return '';
  const basename = title.replace(/\\/g, '/').split('/').pop() || title;
  return basename.replace(/\.exe$/i, '');
}

function _buildAgentCards() {
  const agents = [];

  for (const [id, ts] of state.terminals) {
    const agentInfo = typeof agentParser !== 'undefined' ? agentParser.getInfo(id) : null;
    const isAgent = agentInfo ? agentInfo.isAgent : false;
    const isAgentProfile =
      ts._profileName === 'Claude' ||
      ts._profileName === 'OpenCode' ||
      (ts._command && /claude|opencode/i.test(ts._command));
    if (!isAgent && !isAgentProfile) continue;
    const agentName = agentInfo?.agentName || ts._profileName || _friendlyTitle(ts.title) || 'Terminal';
    const status = _deriveAgentStatus(ts, agentInfo);
    const toolCount = agentInfo ? agentInfo.toolCount : 0;
    const lastTool = agentInfo?.lastTool || null;
    const lastToolFile = agentInfo?.lastToolFile || null;
    const createdAt = ts.lastOutputTime ? ts.lastOutputTime : Date.now();
    const uptime = Date.now() - (agentInfo?.detectedAt || createdAt);

    let activity = '';
    if (lastTool) {
      activity = lastTool + (lastToolFile ? '(' + lastToolFile.split('/').pop() + ')' : '');
    }

    const task = findTaskForAgent(agentName);

    agents.push({
      terminalId: id,
      name: agentName,
      isAgent,
      status,
      activity,
      toolCount,
      task,
      uptime,
    });
  }

  return agents;
}

function _renderStatusSummary(agents) {
  const counts = { working: 0, idle: 0, waiting: 0, errored: 0, 'exited-ok': 0, 'exited-fail': 0 };
  for (const a of agents) {
    counts[a.status] = (counts[a.status] || 0) + 1;
  }
  const parts = [];
  if (counts.working > 0) parts.push(counts.working + ' working');
  if (counts.idle > 0) parts.push(counts.idle + ' idle');
  if (counts.waiting > 0) parts.push(counts.waiting + ' waiting');
  if (counts.errored > 0) parts.push(counts.errored + ' errored');
  if (counts['exited-ok'] > 0) parts.push(counts['exited-ok'] + ' finished');
  if (counts['exited-fail'] > 0) parts.push(counts['exited-fail'] + ' failed');
  return parts.join(', ') || 'No agents';
}

function render() {
  const container = _getContainer();
  if (!container) return;

  const agents = _buildAgentCards();

  // Top bar
  let topBar = container.querySelector('.agent-monitor-topbar');
  if (!topBar) {
    topBar = document.createElement('div');
    topBar.className = 'agent-monitor-topbar';
    container.appendChild(topBar);
  }

  const summary = _renderStatusSummary(agents);
  topBar.innerHTML =
    '<div class="agent-monitor-stats">' +
    '<span class="agent-monitor-count">' +
    agents.length +
    ' agent' +
    (agents.length !== 1 ? 's' : '') +
    '</span>' +
    '<span class="agent-monitor-summary">' +
    summary +
    '</span>' +
    '</div>' +
    '<button class="agent-monitor-launch-btn" title="Launch new Claude agent">' +
    '<span class="material-symbols-outlined">add</span> Launch Agent' +
    '</button>';

  const launchBtn = topBar.querySelector('.agent-monitor-launch-btn');
  if (launchBtn) {
    launchBtn.onclick = () => {
      registry.switchView('terminals');
      const profiles = typeof getProfiles === 'function' ? getProfiles() : [];
      const claudeProfile = profiles.find((p) => p.id === 'claude') || {
        command: 'claude',
        icon: 'smart_toy',
        name: 'Claude',
      };
      registry.createTerminalFromProfile(claudeProfile);
    };
  }

  // Card grid
  let grid = container.querySelector('.agent-monitor-grid');
  if (!grid) {
    grid = document.createElement('div');
    grid.className = 'agent-monitor-grid';
    container.appendChild(grid);
  }

  if (agents.length === 0) {
    grid.innerHTML =
      '<div class="agent-monitor-empty">' +
      '<span class="material-symbols-outlined agent-monitor-empty-icon">hub</span>' +
      '<p>No agents detected.</p>' +
      '<p class="agent-monitor-empty-hint">Launch Claude Code terminals to see agents here.</p>' +
      '</div>';
    return;
  }

  // Reconcile cards by terminal ID
  const existingCards = new Map();
  for (const card of grid.querySelectorAll('.agent-monitor-card')) {
    existingCards.set(card.dataset.terminalId, card);
  }

  const seenIds = new Set();

  for (const agent of agents) {
    seenIds.add(agent.terminalId);
    let card = existingCards.get(agent.terminalId);
    if (!card) {
      card = document.createElement('div');
      card.className = 'agent-monitor-card';
      card.dataset.terminalId = agent.terminalId;
      grid.appendChild(card);
    }
    _updateCard(card, agent);
  }

  for (const [id, card] of existingCards) {
    if (!seenIds.has(id)) card.remove();
  }
}

function _updateCard(card, agent) {
  const statusColor = _statusColor(agent.status);

  card.innerHTML =
    '<div class="agent-monitor-card-header">' +
    '<span class="agent-monitor-dot" style="background:' +
    statusColor +
    '"></span>' +
    '<span class="agent-monitor-name">' +
    _escapeHtml(agent.name) +
    '</span>' +
    (agent.isAgent ? '<span class="agent-monitor-badge-agent">AI</span>' : '') +
    '</div>' +
    '<div class="agent-monitor-card-status">' +
    _statusLabel(agent.status) +
    '</div>' +
    (agent.task
      ? '<div class="agent-monitor-card-task" data-task-id="' +
        agent.task.id +
        '">' +
        '<span class="material-symbols-outlined">task_alt</span> ' +
        '<span class="agent-monitor-task-id">[T' +
        agent.task.id +
        ']</span> ' +
        _escapeHtml((agent.task.title || '').slice(0, 40)) +
        '</div>'
      : '') +
    (agent.activity ? '<div class="agent-monitor-card-activity">' + _escapeHtml(agent.activity) + '</div>' : '') +
    '<div class="agent-monitor-card-meta">' +
    '<span title="Tool calls"><span class="material-symbols-outlined">build</span> ' +
    agent.toolCount +
    '</span>' +
    '<span title="Uptime"><span class="material-symbols-outlined">schedule</span> ' +
    _formatUptime(agent.uptime) +
    '</span>' +
    '</div>';

  // Click card -> focus terminal
  card.onclick = (e) => {
    // If clicking on task badge, go to tasks view instead
    const taskEl = e.target.closest('.agent-monitor-card-task');
    if (taskEl) {
      registry.switchView('tasks');
      return;
    }
    registry.switchView('terminals');
    registry._activateTerminalById(agent.terminalId);
  };
}

function _escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function init() {
  // Initial fetch
  _fetchTasks();
  _fetchCommAgents();
}

export function startRefresh() {
  stopRefresh();
  render();
  _refreshTimer = setInterval(render, REFRESH_INTERVAL);
}

export function stopRefresh() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
}

export function destroy() {
  stopRefresh();
  _container = null;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

registry.initAgentMonitor = init;
registry.renderAgentMonitor = render;
registry.startMonitorRefresh = startRefresh;
registry.stopMonitorRefresh = stopRefresh;
registry.destroyAgentMonitor = destroy;
registry.pollTasksForBadges = pollTasks;
registry.findTaskForAgent = findTaskForAgent;
registry.getCachedTasks = getCachedTasks;
