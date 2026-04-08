// =============================================================================
// Agent Desk — Per-Terminal Search (Ctrl+F)
// =============================================================================

'use strict';

import { state, registry } from './state.js';
import './global-search.js';

// Per-terminal search bar (Ctrl+F)

/** @type {HTMLElement|null} */
let _searchBarEl = null;
/** @type {string|null} */
let _searchBarTermId = null;
let _searchMatchIndex = 0;
let _searchMatchTotal = 0;

function _createSearchBar() {
  const bar = document.createElement('div');
  bar.className = 'terminal-search-bar';
  bar.id = 'terminal-search-bar';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search\u2026';
  input.id = 'terminal-search-input';

  const count = document.createElement('span');
  count.className = 'search-count';
  count.id = 'terminal-search-count';
  count.textContent = '';

  const prevBtn = document.createElement('button');
  prevBtn.title = 'Previous (Shift+Enter)';
  prevBtn.innerHTML = '<span class="material-symbols-outlined">arrow_upward</span>';

  const nextBtn = document.createElement('button');
  nextBtn.title = 'Next (Enter)';
  nextBtn.innerHTML = '<span class="material-symbols-outlined">arrow_downward</span>';

  const closeBtn = document.createElement('button');
  closeBtn.title = 'Close (Escape)';
  closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';

  prevBtn.addEventListener('click', () => _searchFindPrevious());
  nextBtn.addEventListener('click', () => _searchFindNext());
  closeBtn.addEventListener('click', () => closeSearchBar());

  input.addEventListener('input', () => {
    _searchMatchIndex = 0;
    _searchMatchTotal = 0;
    _updateSearchCount();
    const term = input.value;
    if (term) {
      _searchFindNext();
    } else {
      _clearSearchDecorations();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      _searchFindNext();
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      _searchFindPrevious();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchBar();
    }
  });

  bar.appendChild(input);
  bar.appendChild(count);
  bar.appendChild(prevBtn);
  bar.appendChild(nextBtn);
  bar.appendChild(closeBtn);

  return bar;
}

export function openSearchBar() {
  if (!state.activeTerminalId || state.activeView !== 'terminals') return;
  const ts = state.terminals.get(state.activeTerminalId);
  if (!ts || !ts.searchAddon) return;

  // If already open for this terminal, just focus the input
  if (_searchBarEl && _searchBarTermId === state.activeTerminalId) {
    const input = _searchBarEl.querySelector('#terminal-search-input');
    if (input) {
      input.select();
      input.focus();
    }
    return;
  }

  // Close any existing search bar
  closeSearchBar();

  _searchBarEl = _createSearchBar();
  _searchBarTermId = state.activeTerminalId;

  // Attach to the terminal's container (positioned absolutely within)
  const container = ts.container;
  if (container) {
    container.style.position = 'relative';
    container.appendChild(_searchBarEl);
  }

  const input = _searchBarEl.querySelector('#terminal-search-input');
  if (input) {
    input.focus();
  }
}

export function closeSearchBar() {
  if (_searchBarEl) {
    _clearSearchDecorations();
    _searchBarEl.remove();
    _searchBarEl = null;
    _searchMatchIndex = 0;
    _searchMatchTotal = 0;

    // Refocus the terminal
    if (_searchBarTermId) {
      const ts = state.terminals.get(_searchBarTermId);
      if (ts && ts.term) ts.term.focus();
    }
    _searchBarTermId = null;
  }
}

export function isSearchBarOpen() {
  return !!_searchBarEl;
}

const SEARCH_OPTIONS = {
  regex: false,
  caseSensitive: false,
  wholeWord: false,
  decorations: { matchOverviewRuler: '#5d8da8', activeMatchColorOverviewRuler: '#ff9800' },
};

function _doSearch(direction) {
  if (!_searchBarTermId) return;
  const ts = state.terminals.get(_searchBarTermId);
  if (!ts || !ts.searchAddon) return;
  const input = _searchBarEl && _searchBarEl.querySelector('#terminal-search-input');
  if (!input || !input.value) return;

  const result =
    direction === 'next'
      ? ts.searchAddon.findNext(input.value, SEARCH_OPTIONS)
      : ts.searchAddon.findPrevious(input.value, SEARCH_OPTIONS);
  if (result) {
    _searchMatchTotal = result.resultCount !== undefined ? result.resultCount : _searchMatchTotal;
    _searchMatchIndex = result.resultIndex !== undefined ? result.resultIndex + 1 : _searchMatchIndex;
  }
  _updateSearchCount();
}

function _searchFindNext() {
  _doSearch('next');
}

function _searchFindPrevious() {
  _doSearch('previous');
}

function _updateSearchCount() {
  const countEl = _searchBarEl && _searchBarEl.querySelector('#terminal-search-count');
  if (!countEl) return;
  if (_searchMatchTotal > 0) {
    countEl.textContent = `${_searchMatchIndex} of ${_searchMatchTotal}`;
  } else {
    const input = _searchBarEl && _searchBarEl.querySelector('#terminal-search-input');
    countEl.textContent = input && input.value ? 'No results' : '';
  }
}

function _clearSearchDecorations() {
  if (!_searchBarTermId) return;
  const ts = state.terminals.get(_searchBarTermId);
  if (ts && ts.searchAddon) {
    ts.searchAddon.clearDecorations();
  }
}

registry.openSearchBar = openSearchBar;
registry.closeSearchBar = closeSearchBar;
registry.isSearchBarOpen = isSearchBarOpen;
