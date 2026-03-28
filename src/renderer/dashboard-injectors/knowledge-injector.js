/**
 * Knowledge Dashboard Injector
 *
 * Injected into the agent-knowledge webview after dom-ready.
 * Adds "Paste to Terminal" buttons on knowledge cards and search results.
 *
 * Resilient: all DOM queries wrapped in try-catch, throttled re-injection,
 * MutationObserver with debounce for SPA navigation.
 */

/* global agentDeskBridge */

'use strict';

(function () {
  if (window.__agentDeskKnowledgeInjected) return;
  window.__agentDeskKnowledgeInjected = true;

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
      '.ad-knowledge-actions{display:flex;gap:4px;margin-top:6px}',
    ].join('\n');
    document.head.appendChild(style);
  } catch (err) {
    console.warn('[agent-desk knowledge injector] style injection failed:', err);
  }

  // ---------------------------------------------------------------------------
  // Helper
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
        console.warn('[agent-desk knowledge injector] button action failed:', err);
      }
    });
    return btn;
  }

  // ---------------------------------------------------------------------------
  // Enhance knowledge cards and search results
  // ---------------------------------------------------------------------------

  function enhanceCards() {
    var cards = document.querySelectorAll('.knowledge-card[data-path], [data-path][class*="card"]');
    cards.forEach(function (card) {
      try {
        if (card.dataset.adEnhanced) return;
        card.dataset.adEnhanced = '1';

        var actions = document.createElement('div');
        actions.className = 'ad-knowledge-actions';

        actions.appendChild(
          makeBtn('content_paste_go', 'Paste to Terminal', function () {
            var title = card.querySelector('.card-title') || card.querySelector('[class*="title"]');
            var text = title ? (title.textContent || '').trim() : '';
            var path = card.dataset.path || '';
            var payload = text || path;
            if (payload && typeof agentDeskBridge !== 'undefined') {
              agentDeskBridge.pasteToTerminal(payload);
            }
          }),
        );

        card.appendChild(actions);
      } catch (err) {
        console.warn('[agent-desk knowledge injector] enhanceCards error:', err);
      }
    });
  }

  function enhanceSearchResults() {
    var results = document.querySelectorAll(
      '#search-results .result-item, #search-results .search-result-item, [class*="search-result"]',
    );
    results.forEach(function (item) {
      try {
        if (item.dataset.adEnhanced) return;
        item.dataset.adEnhanced = '1';

        var actions = document.createElement('div');
        actions.className = 'ad-knowledge-actions';

        actions.appendChild(
          makeBtn('content_paste_go', 'Paste to Terminal', function () {
            var text = (item.textContent || '').trim();
            if (text && typeof agentDeskBridge !== 'undefined') {
              agentDeskBridge.pasteToTerminal(text);
            }
          }),
        );

        item.appendChild(actions);
      } catch (err) {
        console.warn('[agent-desk knowledge injector] enhanceSearchResults error:', err);
      }
    });
  }

  function enhanceEntryDetail() {
    try {
      var detail = document.querySelector('.entry-detail, .entry-content, #entry-content, [class*="entry-detail"]');
      if (!detail || detail.dataset.adEnhanced) return;
      detail.dataset.adEnhanced = '1';

      var actions = document.createElement('div');
      actions.className = 'ad-knowledge-actions';
      actions.style.marginBottom = '8px';

      actions.appendChild(
        makeBtn('content_paste_go', 'Paste to Terminal', function () {
          var text = (detail.textContent || '').trim();
          if (text && typeof agentDeskBridge !== 'undefined') {
            agentDeskBridge.pasteToTerminal(text);
          }
        }),
      );

      if (detail.parentNode) {
        detail.parentNode.insertBefore(actions, detail);
      }
    } catch (err) {
      console.warn('[agent-desk knowledge injector] enhanceEntryDetail error:', err);
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
      enhanceCards();
      enhanceSearchResults();
      enhanceEntryDetail();
    } catch (err) {
      console.warn('[agent-desk knowledge injector]', err);
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
    console.warn('[agent-desk knowledge injector] observer setup failed:', err);
  }
})();
