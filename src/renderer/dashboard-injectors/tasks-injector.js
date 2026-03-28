/**
 * Tasks Dashboard Injector
 *
 * Injected into the agent-tasks webview after dom-ready.
 * Adds interactive agent-desk integration buttons:
 * - "Go to Agent" on tasks with an assigned agent
 * - Visual indicators for agents whose terminals are in waiting/error state
 *
 * Resilient: all DOM queries wrapped in try-catch, throttled re-injection,
 * MutationObserver with debounce for SPA navigation.
 */

/* global agentDeskBridge */

'use strict';

(function () {
  if (window.__agentDeskTasksInjected) return;
  window.__agentDeskTasksInjected = true;

  var MIN_INJECT_INTERVAL = 1000;
  var _lastInjectTime = 0;

  // ---------------------------------------------------------------------------
  // Style injection
  // ---------------------------------------------------------------------------

  try {
    var style = document.createElement('style');
    style.textContent = [
      '.ad-btn{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;',
      'border:1px solid var(--border,#e0e0e0);border-radius:6px;background:var(--surface,#fff);',
      'color:var(--text,#333);font-size:11px;cursor:pointer;opacity:0.7;transition:opacity .15s,background .15s}',
      '.ad-btn:hover{opacity:1;background:var(--surface-hover,#f5f5f5)}',
      '.ad-btn .material-symbols-outlined{font-size:14px}',
      '.ad-task-actions{display:flex;gap:4px;margin-top:6px}',
      '.ad-status-waiting{box-shadow:inset 0 0 0 2px #ff9800 !important}',
      '.ad-status-error{box-shadow:inset 0 0 0 2px #d45050 !important}',
    ].join('\n');
    document.head.appendChild(style);
  } catch (err) {
    console.warn('[agent-desk tasks injector] style injection failed:', err);
  }

  // ---------------------------------------------------------------------------
  // Terminal state cache
  // ---------------------------------------------------------------------------

  var terminalStates = {};

  try {
    if (typeof agentDeskBridge !== 'undefined' && agentDeskBridge.onTerminalUpdate) {
      agentDeskBridge.onTerminalUpdate(function (terminals) {
        terminalStates = {};
        (terminals || []).forEach(function (t) {
          if (t.agentName) terminalStates[t.agentName] = t;
        });
        highlightTaskStatuses();
      });

      agentDeskBridge.getTerminals().then(function (terminals) {
        (terminals || []).forEach(function (t) {
          if (t.agentName) terminalStates[t.agentName] = t;
        });
        highlightTaskStatuses();
      });
    }
  } catch (err) {
    console.warn('[agent-desk tasks injector] terminal state setup failed:', err);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function makeBtn(icon, label, onClick) {
    var btn = document.createElement('button');
    btn.className = 'ad-btn';
    btn.setAttribute('data-ad-injected', '1');
    btn.title = label;
    btn.innerHTML = '<span class="material-symbols-outlined">' + icon + '</span>' + label;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      try {
        onClick();
      } catch (err) {
        console.warn('[agent-desk tasks injector] button action failed:', err);
      }
    });
    return btn;
  }

  function getAssigneeFromCard(card) {
    try {
      var avatar =
        card.querySelector('.task-card-assignee') ||
        card.querySelector('[class*="assignee"]') ||
        card.querySelector('[data-assignee]');
      if (avatar) {
        return avatar.dataset.assignee || (avatar.textContent || '').trim();
      }
    } catch (err) {
      console.warn('[agent-desk tasks injector] getAssigneeFromCard error:', err);
    }
    return '';
  }

  // ---------------------------------------------------------------------------
  // Enhance task cards
  // ---------------------------------------------------------------------------

  function enhanceTaskCards() {
    var cards = document.querySelectorAll('.task-card[data-task-id], [data-task-id]');
    cards.forEach(function (card) {
      try {
        if (card.dataset.adEnhanced) return;
        card.dataset.adEnhanced = '1';

        var assignee = getAssigneeFromCard(card);
        if (!assignee) return;

        var actions = document.createElement('div');
        actions.className = 'ad-task-actions';

        actions.appendChild(
          makeBtn('terminal', 'Go to Agent', function () {
            if (typeof agentDeskBridge !== 'undefined') {
              agentDeskBridge.focusTerminal(assignee);
            }
          }),
        );

        actions.appendChild(
          makeBtn('visibility', 'View Output', function () {
            if (typeof agentDeskBridge !== 'undefined') {
              agentDeskBridge.focusTerminal(assignee);
            }
          }),
        );

        card.appendChild(actions);
      } catch (err) {
        console.warn('[agent-desk tasks injector] enhanceTaskCards error:', err);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Highlight tasks whose agents have waiting/error terminals
  // ---------------------------------------------------------------------------

  function highlightTaskStatuses() {
    try {
      var cards = document.querySelectorAll('.task-card[data-task-id], [data-task-id]');
      cards.forEach(function (card) {
        card.classList.remove('ad-status-waiting', 'ad-status-error');

        var assignee = getAssigneeFromCard(card);
        if (!assignee) return;

        var termInfo = terminalStates[assignee];
        if (!termInfo) return;

        if (termInfo.status === 'waiting') {
          card.classList.add('ad-status-waiting');
        } else if (termInfo.status === 'exited') {
          card.classList.add('ad-status-error');
        }
      });
    } catch (err) {
      console.warn('[agent-desk tasks injector] highlightTaskStatuses error:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Run & observe
  // ---------------------------------------------------------------------------

  function enhance() {
    var now = Date.now();
    if (now - _lastInjectTime < MIN_INJECT_INTERVAL) return;
    _lastInjectTime = now;

    try {
      enhanceTaskCards();
      highlightTaskStatuses();
    } catch (err) {
      console.warn('[agent-desk tasks injector]', err);
    }
  }

  enhance();

  var debounceTimer = null;
  var observer = new MutationObserver(function () {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(enhance, 200);
  });

  try {
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (err) {
    console.warn('[agent-desk tasks injector] observer setup failed:', err);
  }
})();
