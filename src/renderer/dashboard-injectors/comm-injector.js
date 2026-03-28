/**
 * Comm Dashboard Injector
 *
 * Injected into the agent-comm webview after dom-ready.
 * Adds interactive agent-desk integration buttons:
 * - "Open Terminal" next to agent entries
 * - "Paste to Terminal" on message elements
 * - Click agent names to focus their terminal
 *
 * Resilient: all DOM queries wrapped in try-catch, throttled re-injection,
 * MutationObserver with debounce for SPA navigation.
 */

/* global agentDeskBridge */

'use strict';

(function () {
  if (window.__agentDeskCommInjected) return;
  window.__agentDeskCommInjected = true;

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
      '.agent-card .ad-btn-row,[data-agent-id] .ad-btn-row{display:flex;gap:4px;margin-top:6px}',
      '.ad-msg-actions{display:inline-flex;gap:4px;margin-left:6px;vertical-align:middle}',
    ].join('\n');
    document.head.appendChild(style);
  } catch (err) {
    console.warn('[agent-desk comm injector] style injection failed:', err);
  }

  // ---------------------------------------------------------------------------
  // Helper: create a small action button
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
        console.warn('[agent-desk comm injector] button action failed:', err);
      }
    });
    return btn;
  }

  // ---------------------------------------------------------------------------
  // Enhance agent cards
  // ---------------------------------------------------------------------------

  function enhanceAgentCards() {
    var cards = document.querySelectorAll('.agent-card[data-agent-id], [data-agent-id]');
    cards.forEach(function (card) {
      try {
        if (card.dataset.adEnhanced) return;
        card.dataset.adEnhanced = '1';

        var titleEl = card.querySelector('.card-title') || card.querySelector('[class*="title"]');
        if (titleEl) {
          var agentName = (titleEl.textContent || '').replace(/^[^a-zA-Z]+/, '').trim();
          if (agentName) {
            titleEl.style.cursor = 'pointer';
            titleEl.title = 'Focus terminal for ' + agentName;
            titleEl.addEventListener('click', function (e) {
              e.stopPropagation();
              if (typeof agentDeskBridge !== 'undefined') {
                agentDeskBridge.focusTerminal(agentName);
              }
            });
          }
        }

        var existingRow = card.querySelector('.ad-btn-row');
        if (existingRow) return;

        var row = document.createElement('div');
        row.className = 'ad-btn-row';

        var name = titleEl ? (titleEl.textContent || '').replace(/^[^a-zA-Z]+/, '').trim() : '';

        row.appendChild(
          makeBtn('terminal', 'Open Terminal', function () {
            if (typeof agentDeskBridge !== 'undefined') {
              agentDeskBridge.focusTerminal(name);
            }
          }),
        );

        card.appendChild(row);
      } catch (err) {
        console.warn('[agent-desk comm injector] enhanceAgentCards error:', err);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Enhance messages
  // ---------------------------------------------------------------------------

  function enhanceMessages() {
    var messages = document.querySelectorAll('.message[data-id], [data-message-id]');
    messages.forEach(function (msg) {
      try {
        if (msg.dataset.adEnhanced) return;
        msg.dataset.adEnhanced = '1';

        var contentEl =
          msg.querySelector('.msg-body') || msg.querySelector('.msg-content') || msg.querySelector('[class*="body"]');
        if (!contentEl) return;

        var actionsRow = msg.querySelector('.ad-msg-actions');
        if (actionsRow) return;

        var actions = document.createElement('span');
        actions.className = 'ad-msg-actions';

        actions.appendChild(
          makeBtn('content_paste_go', 'Paste', function () {
            var text = (contentEl.textContent || '').trim();
            if (text && typeof agentDeskBridge !== 'undefined') {
              agentDeskBridge.pasteToTerminal(text);
            }
          }),
        );

        var header =
          msg.querySelector('.msg-header') || msg.querySelector('.msg-meta') || msg.querySelector('[class*="header"]');
        if (header) {
          header.appendChild(actions);
        } else {
          contentEl.after(actions);
        }
      } catch (err) {
        console.warn('[agent-desk comm injector] enhanceMessages error:', err);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Run & observe
  // ---------------------------------------------------------------------------

  function enhance() {
    var now = Date.now();
    if (now - _lastInjectTime < MIN_INJECT_INTERVAL) return;
    _lastInjectTime = now;

    try {
      enhanceAgentCards();
      enhanceMessages();
    } catch (err) {
      console.warn('[agent-desk comm injector]', err);
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
    console.warn('[agent-desk comm injector] observer setup failed:', err);
  }
})();
