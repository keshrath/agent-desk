// =============================================================================
// Agent Desk — Agent Communication Graph (Canvas)
// =============================================================================

'use strict';

import { registry } from './state.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _panel = null;
let _canvas = null;
let _ctx = null;
let _animFrame = null;
let _fetchInterval = null;
let _agents = [];
let _edges = [];
let _hoveredNode = null;
let _resizeObserver = null;
let _pulsePhase = 0;

const NODE_RADIUS = 24;
const AGENT_COMM_URL = 'http://localhost:3421';

// ---------------------------------------------------------------------------
// Data Fetching
// ---------------------------------------------------------------------------

async function fetchGraphData() {
  try {
    const agentRes = await fetch(AGENT_COMM_URL + '/api/agents');
    if (agentRes.ok) {
      const data = await agentRes.json();
      _agents = Array.isArray(data) ? data : [];
    }
  } catch (_) {
    /* agent-comm may not be running */
  }

  if (_agents.length === 0) {
    _edges = [];
    return;
  }

  try {
    const msgRes = await fetch(AGENT_COMM_URL + '/api/channels/general/history?limit=100');
    if (msgRes.ok) {
      const messages = await msgRes.json();
      _edges = buildEdges(Array.isArray(messages) ? messages : []);
    }
  } catch (_) {
    _edges = [];
  }
}

function buildEdges(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || _agents.length === 0) {
    return [];
  }

  const counts = new Map();
  const agentIds = new Set(_agents.map((a) => a.id));

  for (const msg of messages) {
    if (!msg || !msg.from_agent || !agentIds.has(msg.from_agent)) continue;

    if (msg.to_agent && agentIds.has(msg.to_agent)) {
      const key = [msg.from_agent, msg.to_agent].sort().join('|');
      counts.set(key, (counts.get(key) || 0) + 1);
    } else if (msg.channel_id) {
      for (const other of _agents) {
        if (other.id !== msg.from_agent) {
          const key = [msg.from_agent, other.id].sort().join('|');
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
    }
  }

  const edges = [];
  for (const [key, count] of counts) {
    const [a, b] = key.split('|');
    edges.push({ from: a, to: b, count });
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function getNodePositions(width, height) {
  const positions = new Map();
  const n = _agents.length;
  if (n === 0) return positions;

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - NODE_RADIUS - 30;

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    positions.set(_agents[i].id, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      agent: _agents[i],
    });
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function getStatusColor(status) {
  switch (status) {
    case 'online':
      return '#5d8da8';
    case 'idle':
      return '#6b7280';
    case 'offline':
      return '#4b5563';
    default:
      return '#5d8da8';
  }
}

function draw() {
  if (!_ctx || !_canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const w = _canvas.width / dpr;
  const h = _canvas.height / dpr;
  _ctx.clearRect(0, 0, w, h);

  if (_agents.length === 0) {
    _ctx.fillStyle = '#6b7280';
    _ctx.font = '13px Inter, sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('No agents connected', w / 2, h / 2);
    return;
  }

  const positions = getNodePositions(w, h);
  _pulsePhase = (_pulsePhase + 0.03) % (2 * Math.PI);

  for (const edge of _edges) {
    const pA = positions.get(edge.from);
    const pB = positions.get(edge.to);
    if (!pA || !pB) continue;

    const thickness = Math.min(1 + edge.count * 0.5, 6);
    _ctx.beginPath();
    _ctx.moveTo(pA.x, pA.y);
    _ctx.lineTo(pB.x, pB.y);
    _ctx.strokeStyle = 'rgba(93, 141, 168, 0.3)';
    _ctx.lineWidth = thickness;
    _ctx.stroke();
  }

  for (const [, pos] of positions) {
    const agent = pos.agent;
    const isActive = agent.status === 'online';
    const isHovered = _hoveredNode && _hoveredNode.id === agent.id;
    const color = getStatusColor(agent.status);

    if (isActive) {
      const pulseR = NODE_RADIUS + 4 + Math.sin(_pulsePhase) * 3;
      _ctx.beginPath();
      _ctx.arc(pos.x, pos.y, pulseR, 0, 2 * Math.PI);
      _ctx.fillStyle = hexToRgba(color, 0.15);
      _ctx.fill();
    }

    _ctx.beginPath();
    _ctx.arc(pos.x, pos.y, isHovered ? NODE_RADIUS + 3 : NODE_RADIUS, 0, 2 * Math.PI);
    _ctx.fillStyle = color;
    _ctx.fill();

    if (isHovered) {
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 2;
      _ctx.stroke();
    }

    const initial = (agent.name || '?')[0].toUpperCase();
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 14px Inter, sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(initial, pos.x, pos.y);

    _ctx.fillStyle = '#c8d1da';
    _ctx.font = '11px Inter, sans-serif';
    _ctx.textBaseline = 'top';
    _ctx.fillText(agent.name || 'unknown', pos.x, pos.y + NODE_RADIUS + 6);
  }

  if (_hoveredNode) {
    const pos = positions.get(_hoveredNode.id);
    if (pos) {
      const text = _hoveredNode.name + ' (' + _hoveredNode.status + ')';
      const statusText = _hoveredNode.status_text || '';
      const tw = _ctx.measureText(text).width;
      const tipW = Math.max(tw, _ctx.measureText(statusText).width) + 16;
      const tipH = statusText ? 38 : 24;
      let tipX = pos.x - tipW / 2;
      let tipY = pos.y - NODE_RADIUS - tipH - 12;

      tipX = Math.max(4, Math.min(w - tipW - 4, tipX));
      tipY = Math.max(4, tipY);

      _ctx.fillStyle = 'rgba(33, 37, 43, 0.95)';
      _ctx.beginPath();
      _ctx.roundRect(tipX, tipY, tipW, tipH, 6);
      _ctx.fill();
      _ctx.strokeStyle = 'rgba(93, 141, 168, 0.5)';
      _ctx.lineWidth = 1;
      _ctx.stroke();

      _ctx.fillStyle = '#e8ecf0';
      _ctx.font = '12px Inter, sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(text, tipX + tipW / 2, tipY + 12);
      if (statusText) {
        _ctx.fillStyle = '#9ca3af';
        _ctx.font = '10px Inter, sans-serif';
        _ctx.fillText(statusText, tipX + tipW / 2, tipY + 28);
      }
    }
  }

  _animFrame = requestAnimationFrame(draw);
}

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

function handleMouseMove(e) {
  if (!_canvas) return;
  const rect = _canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const dpr = window.devicePixelRatio || 1;

  const positions = getNodePositions(_canvas.width / dpr, _canvas.height / dpr);
  let found = null;
  for (const [, pos] of positions) {
    const dx = mx - pos.x;
    const dy = my - pos.y;
    if (dx * dx + dy * dy <= (NODE_RADIUS + 4) * (NODE_RADIUS + 4)) {
      found = pos.agent;
      break;
    }
  }

  _hoveredNode = found;
  _canvas.style.cursor = found ? 'pointer' : 'default';
}

function handleClick(_e) {
  if (!_hoveredNode || !_canvas) return;

  const agentName = _hoveredNode.name;
  if (!agentName) return;

  if (typeof agentParser !== 'undefined') {
    const terminals = agentParser.getAgentTerminals();
    const match = terminals.find(
      (t) => t.agentName === agentName || (t.terminalId && t.terminalId.includes(agentName)),
    );
    if (match && registry._activateTerminalById) {
      registry._activateTerminalById(match.terminalId);
      if (registry.switchView) registry.switchView('terminals');
    }
  }
}

// ---------------------------------------------------------------------------
// Panel Lifecycle
// ---------------------------------------------------------------------------

function resizeCanvas() {
  if (!_canvas || !_panel) return;
  const rect = _panel.getBoundingClientRect();
  const w = Math.max(300, rect.width);
  const h = Math.max(300, rect.height);
  _canvas.width = w * window.devicePixelRatio;
  _canvas.height = h * window.devicePixelRatio;
  _canvas.style.width = w + 'px';
  _canvas.style.height = h + 'px';
  _ctx = _canvas.getContext('2d');
  _ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

export function showCommGraph() {
  if (_panel) {
    _panel.classList.toggle('comm-graph-hidden');
    if (_panel.classList.contains('comm-graph-hidden')) {
      stopAnimation();
    } else {
      startAnimation();
    }
    return;
  }

  _panel = document.createElement('div');
  _panel.className = 'comm-graph-panel';

  const header = document.createElement('div');
  header.className = 'comm-graph-header';

  const title = document.createElement('span');
  title.className = 'comm-graph-title';
  title.textContent = 'Agent Communication';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'comm-graph-close';
  closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
  closeBtn.addEventListener('click', () => {
    _panel.classList.add('comm-graph-hidden');
    stopAnimation();
  });

  header.appendChild(title);
  header.appendChild(closeBtn);

  _canvas = document.createElement('canvas');
  _canvas.className = 'comm-graph-canvas';
  _canvas.addEventListener('mousemove', handleMouseMove);
  _canvas.addEventListener('click', handleClick);

  _panel.appendChild(header);
  _panel.appendChild(_canvas);
  document.body.appendChild(_panel);

  _resizeObserver = new ResizeObserver(resizeCanvas);
  _resizeObserver.observe(_panel);
  window.addEventListener('resize', resizeCanvas);

  resizeCanvas();
  startAnimation();
}

function startAnimation() {
  fetchGraphData();
  _fetchInterval = setInterval(fetchGraphData, 10000);
  _animFrame = requestAnimationFrame(draw);
}

function stopAnimation() {
  if (_animFrame) {
    cancelAnimationFrame(_animFrame);
    _animFrame = null;
  }
  if (_fetchInterval) {
    clearInterval(_fetchInterval);
    _fetchInterval = null;
  }
}

export function destroyCommGraph() {
  stopAnimation();
  if (_resizeObserver) {
    _resizeObserver.disconnect();
    _resizeObserver = null;
  }
  window.removeEventListener('resize', resizeCanvas);
  if (_panel && _panel.parentNode) {
    _panel.remove();
  }
  _panel = null;
  _canvas = null;
  _ctx = null;
  _agents = [];
  _edges = [];
}

registry.showCommGraph = showCommGraph;
registry.destroyCommGraph = destroyCommGraph;
