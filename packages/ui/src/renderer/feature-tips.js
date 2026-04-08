// =============================================================================
// Agent Desk — Feature Tips & Keyboard Shortcut Hints
// =============================================================================
// Contextual tips shown once per feature. Rotating shortcut hints in status bar.
// =============================================================================

'use strict';

import { state, registry } from './state.js';

// ---------------------------------------------------------------------------
// Tip Definitions
// ---------------------------------------------------------------------------

const TIP_DEFS = {
  'terminal-created': {
    text: 'Right-click tabs for more options: split, rename, chain',
    anchorSelector: '#tab-list .tab:last-child',
    fallbackPosition: { top: 60, left: 200 },
  },
  'settings-opened': {
    text: 'Configure profiles to quickly launch different shells',
    anchorSelector: '.nav-btn[data-view="settings"]',
    fallbackPosition: { bottom: 80, left: 48 },
  },
  'terminal-5th': {
    text: 'Try Ctrl+Shift+B to batch-launch agents with templates',
    anchorSelector: '#btn-new-tab',
    fallbackPosition: { top: 60, right: 60 },
  },
  'agent-detected': {
    text: 'Click here to see all agents at a glance (Ctrl+5)',
    anchorSelector: '.nav-btn[data-view="monitor"]',
    fallbackPosition: { top: 200, left: 48 },
  },
  'monitor-opened': {
    text: 'Click any agent card to focus its terminal',
    anchorSelector: '#view-monitor',
    fallbackPosition: { top: 120, left: 200 },
  },
};

const SHORTCUT_HINTS = [
  'Tip: Ctrl+Shift+F to search all terminals',
  'Tip: Ctrl+5 for Agent Monitor',
  'Tip: Ctrl+Shift+B to batch launch agents',
  'Tip: F1 to open keyboard shortcuts',
  'Tip: Ctrl+Shift+T to open a new terminal',
  'Tip: Ctrl+P for quick switcher',
  'Tip: Ctrl+Shift+P for command palette',
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _shownTips = new Set();
let _terminalCount = 0;
let _activeTip = null;
let _tipTimeout = null;
let _hintInterval = null;
let _hintIndex = 0;
let _firstLaunchDate = 0;
let _unsubscribers = [];

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

async function readConfig() {
  try {
    return (await agentDesk.config.read()) || {};
  } catch {
    return {};
  }
}

async function mergeConfig(patch) {
  try {
    const cfg = await readConfig();
    Object.assign(cfg, patch);
    await agentDesk.config.write(cfg);
  } catch {
    /* best-effort */
  }
}

async function markTipShown(tipId) {
  _shownTips.add(tipId);
  await mergeConfig({ shownTips: Array.from(_shownTips) });
}

// ---------------------------------------------------------------------------
// Tip Display
// ---------------------------------------------------------------------------

function showTip(tipId) {
  if (_shownTips.has(tipId) || _activeTip) return;
  const def = TIP_DEFS[tipId];
  if (!def) return;

  const tip = document.createElement('div');
  tip.className = 'feature-tip-card';

  const content = document.createElement('span');
  content.className = 'feature-tip-text';
  content.textContent = def.text;
  tip.appendChild(content);

  const close = document.createElement('button');
  close.className = 'feature-tip-close';
  close.innerHTML = '<span class="material-symbols-outlined">close</span>';
  close.addEventListener('click', () => dismissTip());
  tip.appendChild(close);

  const anchor = document.querySelector(def.anchorSelector);
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    tip.style.top = rect.bottom + 8 + 'px';
    tip.style.left = Math.max(8, rect.left) + 'px';
  } else {
    const pos = def.fallbackPosition;
    if (pos.top !== undefined) tip.style.top = pos.top + 'px';
    if (pos.bottom !== undefined) tip.style.bottom = pos.bottom + 'px';
    if (pos.left !== undefined) tip.style.left = pos.left + 'px';
    if (pos.right !== undefined) tip.style.right = pos.right + 'px';
  }

  document.body.appendChild(tip);
  requestAnimationFrame(() => tip.classList.add('visible'));

  _activeTip = tip;
  _tipTimeout = setTimeout(() => dismissTip(), 8000);

  markTipShown(tipId);
}

function dismissTip() {
  if (_tipTimeout) {
    clearTimeout(_tipTimeout);
    _tipTimeout = null;
  }
  if (_activeTip) {
    _activeTip.classList.remove('visible');
    const el = _activeTip;
    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 200);
    _activeTip = null;
  }
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------

function setupTipListeners() {
  const unsub1 = eventBus.on('terminal:created', () => {
    _terminalCount++;
    if (_terminalCount === 1) {
      setTimeout(() => showTip('terminal-created'), 1500);
    } else if (_terminalCount === 5) {
      setTimeout(() => showTip('terminal-5th'), 1000);
    }
  });
  _unsubscribers.push(unsub1);

  const unsub2 = eventBus.on('agent:detected', () => {
    setTimeout(() => showTip('agent-detected'), 2000);
  });
  _unsubscribers.push(unsub2);

  const origSwitchView = registry.switchView;
  if (origSwitchView) {
    registry.switchView = function (viewName) {
      origSwitchView.call(this, viewName);
      if (viewName === 'settings') {
        setTimeout(() => showTip('settings-opened'), 800);
      } else if (viewName === 'monitor') {
        setTimeout(() => showTip('monitor-opened'), 800);
      }
    };
  }
}

// ---------------------------------------------------------------------------
// Status Bar Shortcut Hints
// ---------------------------------------------------------------------------

function startShortcutHints() {
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  if (_firstLaunchDate && Date.now() - _firstLaunchDate > oneWeek) return;

  const center = document.querySelector('#status-bar .status-center');
  if (!center) return;

  const hintEl = document.createElement('span');
  hintEl.className = 'feature-tip-hint';
  center.appendChild(hintEl);

  function rotateHint() {
    hintEl.classList.remove('visible');
    setTimeout(() => {
      hintEl.textContent = SHORTCUT_HINTS[_hintIndex % SHORTCUT_HINTS.length];
      _hintIndex++;
      hintEl.classList.add('visible');
    }, 300);
  }

  rotateHint();
  _hintInterval = setInterval(rotateHint, 60000);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initFeatureTips() {
  const cfg = await readConfig();

  _firstLaunchDate = cfg.firstLaunchDate || 0;
  _shownTips = new Set(cfg.shownTips || []);
  _terminalCount = state.terminals ? state.terminals.size : 0;

  setupTipListeners();
  startShortcutHints();
}

export function destroyFeatureTips() {
  dismissTip();
  if (_hintInterval) {
    clearInterval(_hintInterval);
    _hintInterval = null;
  }
  for (const unsub of _unsubscribers) {
    unsub();
  }
  _unsubscribers = [];
}

registry.initFeatureTips = initFeatureTips;
registry.destroyFeatureTips = destroyFeatureTips;
