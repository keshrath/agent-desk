// =============================================================================
// Agent Desk — Cross-Terminal Global Search (Ctrl+Shift+F)
// =============================================================================
// Searches across ALL terminal buffers simultaneously with case-sensitive,
// regex options, keyboard navigation, and chunked async searching.
// =============================================================================

'use strict';

import { state, registry } from './state.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RESULTS = 500;
const DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _overlay = null;
let _activeIndex = -1;
let _results = [];
let _debounceTimer = null;
let _searchAbort = null;
let _caseSensitive = false;
let _useRegex = false;

// ---------------------------------------------------------------------------
// DOM Construction
// ---------------------------------------------------------------------------

function _createOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'global-search-overlay';

  const modal = document.createElement('div');
  modal.className = 'global-search-modal';

  const header = document.createElement('div');
  header.className = 'global-search-header';

  const inputRow = document.createElement('div');
  inputRow.className = 'global-search-input-row';

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined global-search-icon';
  icon.textContent = 'search';

  const input = document.createElement('input');
  input.className = 'global-search-input';
  input.type = 'text';
  input.placeholder = 'Search all terminals\u2026';
  input.spellcheck = false;
  input.autocomplete = 'off';

  inputRow.appendChild(icon);
  inputRow.appendChild(input);

  const optionsRow = document.createElement('div');
  optionsRow.className = 'global-search-options';

  const caseBtn = _createToggleButton('match_case', 'Case Sensitive', _caseSensitive, (on) => {
    _caseSensitive = on;
    _triggerSearch(input);
  });

  const regexBtn = _createToggleButton('regular_expression', 'Regex', _useRegex, (on) => {
    _useRegex = on;
    _triggerSearch(input);
  });

  optionsRow.appendChild(caseBtn);
  optionsRow.appendChild(regexBtn);

  header.appendChild(inputRow);
  header.appendChild(optionsRow);

  const status = document.createElement('div');
  status.className = 'global-search-status';
  status.textContent = 'Type to search across all terminals';

  const results = document.createElement('div');
  results.className = 'global-search-results';

  modal.appendChild(header);
  modal.appendChild(status);
  modal.appendChild(results);
  overlay.appendChild(modal);

  input.addEventListener('input', () => {
    _triggerSearch(input);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hideGlobalSearch();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      _navigateResults(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _navigateResults(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      _activateResult();
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideGlobalSearch();
  });

  return overlay;
}

function _createToggleButton(iconName, label, initial, onChange) {
  const btn = document.createElement('button');
  btn.className = 'global-search-toggle' + (initial ? ' active' : '');
  btn.title = label;
  btn.type = 'button';

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined';
  icon.textContent = iconName;
  btn.appendChild(icon);

  const text = document.createElement('span');
  text.textContent = label;
  btn.appendChild(text);

  btn.addEventListener('click', () => {
    const isActive = btn.classList.toggle('active');
    onChange(isActive);
  });

  return btn;
}

// ---------------------------------------------------------------------------
// Search Logic (chunked async)
// ---------------------------------------------------------------------------

function _triggerSearch(inputEl) {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => _runSearch(inputEl.value), DEBOUNCE_MS);
}

function _runSearch(query) {
  if (_searchAbort) _searchAbort.cancelled = true;
  const abort = { cancelled: false };
  _searchAbort = abort;

  _results = [];
  _activeIndex = -1;

  const statusEl = _overlay && _overlay.querySelector('.global-search-status');
  const resultsEl = _overlay && _overlay.querySelector('.global-search-results');
  if (!resultsEl || !statusEl) return;

  resultsEl.innerHTML = '';

  if (!query || query.length < 2) {
    statusEl.textContent = 'Type at least 2 characters';
    statusEl.classList.remove('global-search-status-searching');
    return;
  }

  let pattern;
  if (_useRegex) {
    try {
      pattern = new RegExp(query, _caseSensitive ? 'g' : 'gi');
    } catch {
      statusEl.textContent = 'Invalid regular expression';
      statusEl.classList.remove('global-search-status-searching');
      return;
    }
  }

  statusEl.textContent = 'Searching\u2026';
  statusEl.classList.add('global-search-status-searching');

  const terminalEntries = [];
  for (const [id, ts] of state.terminals) {
    const buffer = ts.term && ts.term.buffer && ts.term.buffer.active;
    if (!buffer) continue;
    const lines = [];
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    const agentInfo = typeof agentParser !== 'undefined' ? agentParser.getInfo(id) : null;
    const agentName = agentInfo && agentInfo.agentName ? agentInfo.agentName : null;
    terminalEntries.push({ id, title: ts.title || 'Terminal', agentName, lines });
  }

  let tIdx = 0;
  let lIdx = 0;
  const allResults = [];
  let matchedTerminals = new Set();

  function processChunk() {
    if (abort.cancelled) return;

    const deadline = performance.now() + 8;
    while (tIdx < terminalEntries.length && allResults.length < MAX_RESULTS) {
      const entry = terminalEntries[tIdx];
      while (lIdx < entry.lines.length && allResults.length < MAX_RESULTS) {
        const line = entry.lines[lIdx];
        const matchInfo = _matchLine(line, query, pattern);
        if (matchInfo) {
          matchedTerminals.add(entry.id);
          allResults.push({
            terminalId: entry.id,
            terminalName: entry.title,
            agentName: entry.agentName,
            lineNumber: lIdx + 1,
            lineContent: line,
            matchStart: matchInfo.start,
            matchEnd: matchInfo.end,
          });
        }
        lIdx++;

        if (performance.now() > deadline) {
          setTimeout(processChunk, 0);
          return;
        }
      }
      lIdx = 0;
      tIdx++;
    }

    if (abort.cancelled) return;
    _searchAbort = null;
    _results = allResults;
    _renderResults(resultsEl, statusEl, query, pattern, matchedTerminals.size);
  }

  setTimeout(processChunk, 0);
}

function _matchLine(line, query, regexPattern) {
  if (regexPattern) {
    regexPattern.lastIndex = 0;
    const m = regexPattern.exec(line);
    if (m) return { start: m.index, end: m.index + m[0].length };
    return null;
  }
  const haystack = _caseSensitive ? line : line.toLowerCase();
  const needle = _caseSensitive ? query : query.toLowerCase();
  const idx = haystack.indexOf(needle);
  if (idx >= 0) return { start: idx, end: idx + query.length };
  return null;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function _renderResults(container, statusEl, query, pattern, terminalCount) {
  container.innerHTML = '';
  statusEl.classList.remove('global-search-status-searching');

  if (_results.length === 0) {
    statusEl.textContent = 'No matches found';
    return;
  }

  const suffix = _results.length >= MAX_RESULTS ? '+' : '';
  statusEl.textContent = `${_results.length}${suffix} matches in ${terminalCount} terminal${terminalCount !== 1 ? 's' : ''}`;

  let currentTermId = null;
  let itemIndex = 0;

  for (const r of _results) {
    if (r.terminalId !== currentTermId) {
      currentTermId = r.terminalId;
      const header = document.createElement('div');
      header.className = 'global-search-group-header';
      const nameText = r.agentName ? `${r.terminalName} \u2014 ${r.agentName}` : r.terminalName;
      header.textContent = nameText;
      header.addEventListener('click', () => {
        hideGlobalSearch();
        registry.switchToTerminal(r.terminalId);
      });
      container.appendChild(header);
    }

    const item = document.createElement('div');
    item.className = 'global-search-item';
    item.dataset.index = itemIndex;

    const lineLabel = document.createElement('span');
    lineLabel.className = 'global-search-line';
    lineLabel.textContent = `L${r.lineNumber}`;

    const textSpan = document.createElement('span');
    textSpan.className = 'global-search-text';
    _highlightMatch(textSpan, r.lineContent, r.matchStart, r.matchEnd);

    item.appendChild(lineLabel);
    item.appendChild(textSpan);

    const idx = itemIndex;
    item.addEventListener('click', () => {
      _activeIndex = idx;
      _updateActiveHighlight(container);
      _activateResult();
    });

    container.appendChild(item);
    itemIndex++;
  }
}

function _highlightMatch(container, text, start, end) {
  const maxLen = 200;
  let displayText = text;
  let displayStart = start;
  let displayEnd = end;

  if (text.length > maxLen) {
    const contextBefore = 40;
    const trimStart = Math.max(0, start - contextBefore);
    displayText =
      (trimStart > 0 ? '\u2026' : '') +
      text.slice(trimStart, trimStart + maxLen) +
      (trimStart + maxLen < text.length ? '\u2026' : '');
    displayStart = start - trimStart + (trimStart > 0 ? 1 : 0);
    displayEnd = displayStart + (end - start);
  }

  if (displayStart >= 0 && displayEnd <= displayText.length) {
    container.appendChild(document.createTextNode(displayText.slice(0, displayStart)));
    const mark = document.createElement('mark');
    mark.textContent = displayText.slice(displayStart, displayEnd);
    container.appendChild(mark);
    container.appendChild(document.createTextNode(displayText.slice(displayEnd)));
  } else {
    container.textContent = displayText;
  }
}

// ---------------------------------------------------------------------------
// Keyboard Navigation
// ---------------------------------------------------------------------------

function _navigateResults(delta) {
  if (_results.length === 0) return;
  const container = _overlay && _overlay.querySelector('.global-search-results');
  if (!container) return;

  _activeIndex += delta;
  if (_activeIndex < 0) _activeIndex = _results.length - 1;
  if (_activeIndex >= _results.length) _activeIndex = 0;

  _updateActiveHighlight(container);
}

function _updateActiveHighlight(container) {
  const items = container.querySelectorAll('.global-search-item');
  items.forEach((el) => el.classList.remove('active'));

  const active = container.querySelector(`.global-search-item[data-index="${_activeIndex}"]`);
  if (active) {
    active.classList.add('active');
    active.scrollIntoView({ block: 'nearest' });
  }
}

function _activateResult() {
  if (_activeIndex < 0 || _activeIndex >= _results.length) return;
  const r = _results[_activeIndex];

  hideGlobalSearch();

  registry.switchToTerminal(r.terminalId);

  const ts = state.terminals.get(r.terminalId);
  if (ts && ts.searchAddon) {
    const matchText = r.lineContent.slice(r.matchStart, r.matchEnd);
    if (matchText) {
      const searchOpts = {
        regex: _useRegex,
        caseSensitive: _caseSensitive,
        wholeWord: false,
        decorations: {
          matchOverviewRuler: '#5d8da8',
          activeMatchColorOverviewRuler: '#ff9800',
        },
      };
      ts.searchAddon.findNext(matchText, searchOpts);
    }
  }

  if (ts && ts.term) {
    const buffer = ts.term.buffer.active;
    const viewportRows = ts.term.rows;
    const targetRow = Math.max(0, r.lineNumber - 1 - Math.floor(viewportRows / 2));
    const maxScroll = Math.max(0, buffer.length - viewportRows);
    ts.term.scrollToLine(Math.min(targetRow, maxScroll));
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function showGlobalSearch() {
  if (_overlay) return;

  _overlay = _createOverlay();
  _results = [];
  _activeIndex = -1;

  document.body.appendChild(_overlay);
  requestAnimationFrame(() => {
    _overlay.classList.add('visible');
    const input = _overlay.querySelector('.global-search-input');
    if (input) input.focus();
  });
}

export function hideGlobalSearch() {
  if (!_overlay) return;
  if (_searchAbort) _searchAbort.cancelled = true;
  if (_debounceTimer) clearTimeout(_debounceTimer);

  _overlay.classList.remove('visible');
  const overlay = _overlay;
  _overlay = null;
  _results = [];
  _activeIndex = -1;
  setTimeout(() => overlay.remove(), 150);
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

registry.showGlobalSearch = showGlobalSearch;
registry.hideGlobalSearch = hideGlobalSearch;
