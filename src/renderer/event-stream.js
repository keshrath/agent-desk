// =============================================================================
// Agent Desk — Event Stream Panel (enriched)
// =============================================================================
// Collapsible panel showing up to 1000 events with filtering, search,
// paginated display (50 at a time), localStorage persistence, and export.
// Subscribes to the event bus.
// =============================================================================

'use strict';

// eslint-disable-next-line no-unused-vars
const eventStream = (function () {
  const MAX_EVENTS = 1000;
  const PAGE_SIZE = 50;
  const RELATIVE_TIME_UPDATE = 15000;
  const STORAGE_KEY = 'agent-desk-event-stream';

  const EVENT_TYPES = {
    'terminal:created': { icon: 'add_circle', color: 'var(--accent)', label: 'Terminal', severity: 'info' },
    'terminal:exited': { icon: 'cancel', color: 'var(--status-exited)', label: 'Terminal', severity: 'warning' },
    'terminal:status': { icon: 'swap_horiz', color: 'var(--status-running)', label: 'Terminal', severity: 'info' },
    'agent:tool-call': { icon: 'build', color: 'var(--accent)', label: 'Tool', severity: 'info' },
    'agent:file-modified': { icon: 'description', color: '#4caf50', label: 'File', severity: 'success' },
    'agent:test-result': { icon: 'science', color: '#ff9800', label: 'Test', severity: 'warning' },
    'agent:detected': { icon: 'smart_toy', color: 'var(--accent)', label: 'Agent', severity: 'info' },
    'agent:named': { icon: 'badge', color: 'var(--accent)', label: 'Agent', severity: 'info' },
    'agent:status': { icon: 'pending', color: 'var(--text-muted)', label: 'Agent', severity: 'info' },
    error: { icon: 'error', color: 'var(--danger)', label: 'Error', severity: 'error' },
    'chain:triggered': { icon: 'link', color: 'var(--accent)', label: 'Chain', severity: 'info' },
  };

  const SEVERITY_COLORS = {
    info: 'var(--text-dim)',
    warning: '#ff9800',
    error: 'var(--danger)',
    success: '#4caf50',
  };

  const FILTER_GROUPS = [
    { key: 'tools', icon: 'build', label: 'Tools', types: ['agent:tool-call', 'agent:file-modified'] },
    { key: 'errors', icon: 'error', label: 'Errors', types: ['error'] },
    {
      key: 'status',
      icon: 'swap_horiz',
      label: 'Status',
      types: ['terminal:status', 'agent:status', 'agent:detected', 'agent:named'],
    },
    {
      key: 'lifecycle',
      icon: 'terminal',
      label: 'Lifecycle',
      types: ['terminal:created', 'terminal:exited', 'chain:triggered', 'agent:test-result'],
    },
  ];

  let _panelEl = null;
  let _listEl = null;
  let _filterBarEl = null;
  let _isVisible = false;
  let _eventCount = 0;
  let _timeUpdateTimer = null;
  let _events = [];
  let _idCounter = 0;
  let _displayedCount = 0;
  let _loadMoreBtn = null;

  let _filterTerminalId = null;
  let _filterSearch = '';
  let _activeFilters = new Set(['tools', 'errors', 'status', 'lifecycle']);

  // -------------------------------------------------------------------------
  // Persistence: save/restore from localStorage
  // -------------------------------------------------------------------------

  function _persistEvents() {
    try {
      const serialized = _events.map((ev) => ({
        id: ev.id,
        timestamp: ev.timestamp,
        type: ev.type,
        terminalId: ev.terminalId,
        terminalName: ev.terminalName,
        agentName: ev.agentName,
        content: ev.content,
        details: ev.details,
        severity: ev.severity,
        _busData: ev._busEvent ? ev._busEvent.data : {},
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch {
      /* storage full or unavailable */
    }
  }

  function _restoreEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      _events = parsed.map((ev) => ({
        id: ev.id,
        timestamp: ev.timestamp,
        type: ev.type,
        terminalId: ev.terminalId,
        terminalName: ev.terminalName || '',
        agentName: ev.agentName || '',
        content: ev.content || '',
        details: ev.details || '',
        severity: ev.severity || 'info',
        _busEvent: { type: ev.type, data: ev._busData || {}, timestamp: ev.timestamp },
      }));

      if (_events.length > MAX_EVENTS) {
        _events = _events.slice(_events.length - MAX_EVENTS);
      }

      _idCounter = _events.length > 0 ? Math.max(..._events.map((e) => e.id)) : 0;
      _eventCount = _events.length;
      _updateCount();
    } catch {
      /* corrupt data, ignore */
    }
  }

  function _enrichEvent(busEvent) {
    const config = EVENT_TYPES[busEvent.type] || {
      icon: 'info',
      color: 'var(--text-muted)',
      label: 'Other',
      severity: 'info',
    };
    const d = busEvent.data || {};

    let terminalName = d.title || '';
    let agentName = '';
    if (d.terminalId && typeof agentParser !== 'undefined') {
      const info = agentParser.getInfo(d.terminalId);
      if (info && info.agentName) agentName = info.agentName;
    }

    return {
      id: ++_idCounter,
      timestamp: busEvent.timestamp,
      type: busEvent.type,
      terminalId: d.terminalId || null,
      terminalName,
      agentName,
      content: _formatDescription(busEvent),
      details: _formatDetails(busEvent),
      severity: config.severity || 'info',
      _busEvent: busEvent,
    };
  }

  function _formatDescription(event) {
    const d = event.data;
    switch (event.type) {
      case 'terminal:created':
        return 'Terminal created: ' + (d.title || d.terminalId || 'unknown');
      case 'terminal:exited':
        return (
          'Terminal exited' +
          (d.exitCode !== undefined ? ' (code ' + d.exitCode + ')' : '') +
          ': ' +
          (d.title || d.terminalId || 'unknown')
        );
      case 'terminal:status':
        return (d.title || d.terminalId || 'Terminal') + ': ' + (d.prevStatus || '?') + ' \u2192 ' + (d.status || '?');
      case 'agent:tool-call':
        return (
          (d.tool || 'Tool') + (d.arg ? '(' + _truncate(d.arg, 60) + ')' : '') + ' [#' + (d.toolCount || '?') + ']'
        );
      case 'agent:file-modified':
        return (d.tool || 'Modified') + ': ' + _truncate(d.file || 'unknown', 80);
      case 'agent:test-result':
        return 'Test ' + d.result + ': ' + (d.detail || '');
      case 'agent:detected':
        return 'Agent detected in terminal';
      case 'agent:named':
        return 'Agent registered: ' + (d.agentName || 'unknown');
      case 'agent:status':
        return 'Agent ' + (d.status || 'unknown');
      case 'error':
        return (d.source || 'Error') + ': ' + _truncate(d.message || '', 100);
      case 'chain:triggered':
        return 'Chain triggered: ' + (d.sourceTitle || '?') + ' \u2192 ' + (d.targetTitle || '?');
      default:
        return JSON.stringify(d).slice(0, 100);
    }
  }

  function _formatDetails(event) {
    const d = event.data;
    switch (event.type) {
      case 'agent:tool-call':
        return [
          d.tool ? 'Tool: ' + d.tool : '',
          d.arg ? 'Argument: ' + d.arg : '',
          d.file ? 'File: ' + d.file : '',
          d.toolCount ? 'Call #' + d.toolCount : '',
          d.duration ? 'Duration: ' + d.duration + 'ms' : '',
        ]
          .filter(Boolean)
          .join('\n');
      case 'error':
        return d.message || d.stack || JSON.stringify(d, null, 2);
      case 'terminal:status':
        return (
          'Status: ' +
          (d.prevStatus || '?') +
          ' \u2192 ' +
          (d.status || '?') +
          '\nTerminal: ' +
          (d.title || d.terminalId || '?')
        );
      case 'agent:file-modified':
        return [d.tool ? 'Tool: ' + d.tool : '', d.file ? 'File: ' + d.file : ''].filter(Boolean).join('\n');
      case 'terminal:exited':
        return (
          'Exit code: ' +
          (d.exitCode !== undefined ? d.exitCode : 'unknown') +
          '\nTerminal: ' +
          (d.title || d.terminalId || '?')
        );
      default:
        return JSON.stringify(d, null, 2);
    }
  }

  function _truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '\u2026' : str;
  }

  function _relativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 5000) return 'now';
    if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return new Date(timestamp).toLocaleTimeString();
  }

  function _getFilterTypes() {
    const types = new Set();
    for (const group of FILTER_GROUPS) {
      if (_activeFilters.has(group.key)) {
        for (const t of group.types) types.add(t);
      }
    }
    return types;
  }

  function _matchesFilters(enrichedEvent) {
    const allowedTypes = _getFilterTypes();
    if (!allowedTypes.has(enrichedEvent.type)) return false;

    if (_filterTerminalId && enrichedEvent.terminalId !== _filterTerminalId) return false;

    if (_filterSearch) {
      const q = _filterSearch.toLowerCase();
      const searchable = (
        enrichedEvent.content +
        ' ' +
        enrichedEvent.agentName +
        ' ' +
        enrichedEvent.terminalName
      ).toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    return true;
  }

  function _getFilteredEvents() {
    return _events.filter(_matchesFilters);
  }

  function _rebuildList() {
    if (!_listEl) return;
    _listEl.innerHTML = '';
    _displayedCount = 0;

    const visible = _getFilteredEvents();
    // Show newest first, paginated
    const toShow = visible.slice(Math.max(0, visible.length - PAGE_SIZE));
    for (let i = toShow.length - 1; i >= 0; i--) {
      _addEventEl(toShow[i]);
    }
    _displayedCount = toShow.length;

    _updateLoadMoreBtn(visible.length);
  }

  function _loadMore() {
    if (!_listEl) return;
    const visible = _getFilteredEvents();
    const alreadyShown = _displayedCount;
    const remaining = visible.length - alreadyShown;
    if (remaining <= 0) return;

    const nextBatch = visible.slice(
      Math.max(0, visible.length - alreadyShown - PAGE_SIZE),
      visible.length - alreadyShown,
    );
    // Append older events at the bottom (since list is newest-first)
    for (let i = 0; i < nextBatch.length; i++) {
      _addEventEl(nextBatch[i]);
    }
    _displayedCount += nextBatch.length;

    _updateLoadMoreBtn(visible.length);
  }

  function _updateLoadMoreBtn(totalVisible) {
    if (!_loadMoreBtn) return;
    const remaining = totalVisible - _displayedCount;
    if (remaining > 0) {
      _loadMoreBtn.style.display = 'flex';
      _loadMoreBtn.textContent = `Load more (${remaining} remaining)`;
    } else {
      _loadMoreBtn.style.display = 'none';
    }
  }

  function _addEventEl(enrichedEvent) {
    if (!_listEl) return;

    const config = EVENT_TYPES[enrichedEvent.type] || { icon: 'info', color: 'var(--text-muted)', label: 'Other' };
    const severityColor = SEVERITY_COLORS[enrichedEvent.severity] || SEVERITY_COLORS.info;

    const el = document.createElement('div');
    el.className = 'es-event es-severity-' + enrichedEvent.severity;
    el.style.borderLeftColor = severityColor;
    el.dataset.eventId = String(enrichedEvent.id);

    const iconEl = document.createElement('span');
    iconEl.className = 'material-symbols-outlined es-event-icon';
    iconEl.textContent = config.icon;
    iconEl.style.color = config.color;

    const content = document.createElement('div');
    content.className = 'es-event-content';

    const desc = document.createElement('span');
    desc.className = 'es-event-desc';
    desc.textContent = enrichedEvent.content;
    desc.title = enrichedEvent.content;

    const time = document.createElement('span');
    time.className = 'es-event-time';
    time.textContent = _relativeTime(enrichedEvent.timestamp);
    time.dataset.ts = String(enrichedEvent.timestamp);

    content.appendChild(desc);
    content.appendChild(time);

    el.appendChild(iconEl);
    el.appendChild(content);

    el.addEventListener('click', (e) => {
      if (e.target.closest('.es-event-detail')) return;
      _toggleDetail(el, enrichedEvent);
    });

    _listEl.appendChild(el);
  }

  function _toggleDetail(el, enrichedEvent) {
    const existing = el.querySelector('.es-event-detail');
    if (existing) {
      existing.remove();
      el.classList.remove('expanded');
      return;
    }

    el.classList.add('expanded');
    const detail = document.createElement('div');
    detail.className = 'es-event-detail';

    const pre = document.createElement('pre');
    pre.className = 'es-event-detail-text';
    pre.textContent = enrichedEvent.details || 'No additional details';
    detail.appendChild(pre);

    if (enrichedEvent.terminalId) {
      const jumpBtn = document.createElement('button');
      jumpBtn.className = 'es-detail-btn';
      jumpBtn.textContent = 'Go to terminal';
      jumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof switchToTerminal === 'function') {
          switchToTerminal(enrichedEvent.terminalId);
        }
      });
      detail.appendChild(jumpBtn);
    }

    el.appendChild(detail);
  }

  function _addEventToDOM(busEvent) {
    if (!EVENT_TYPES[busEvent.type]) return;

    const enriched = _enrichEvent(busEvent);
    _events.push(enriched);

    while (_events.length > MAX_EVENTS) {
      _events.shift();
    }

    _eventCount = _events.length;
    _updateCount();

    if (!_matchesFilters(enriched)) return;

    if (_listEl) {
      _addEventEl(enriched);
      const lastChild = _listEl.lastChild;
      if (lastChild && _listEl.firstChild) {
        // Insert before loadMore button if it exists, otherwise at the top
        const firstEvent = _listEl.querySelector('.es-event');
        if (firstEvent) {
          _listEl.insertBefore(lastChild, firstEvent);
        }
      }
      _displayedCount++;

      // Keep rendered list reasonable — trim old rendered items beyond PAGE_SIZE * 4
      const maxRendered = PAGE_SIZE * 4;
      const eventEls = _listEl.querySelectorAll('.es-event');
      while (eventEls.length > maxRendered) {
        const last = _listEl.querySelector('.es-event:last-of-type');
        if (last) {
          last.remove();
          _displayedCount--;
        } else {
          break;
        }
      }

      _updateLoadMoreBtn(_getFilteredEvents().length);
    }
  }

  function _updateCount() {
    const countEl = document.getElementById('es-count');
    if (countEl) countEl.textContent = String(_eventCount);
  }

  function _updateRelativeTimes() {
    if (!_listEl) return;
    const timeEls = _listEl.querySelectorAll('.es-event-time');
    for (const el of timeEls) {
      const ts = parseInt(el.dataset.ts);
      if (ts) el.textContent = _relativeTime(ts);
    }
  }

  function _buildFilterBar() {
    const bar = document.createElement('div');
    bar.className = 'es-filter-bar';

    const termSelect = document.createElement('select');
    termSelect.className = 'es-time-select';
    termSelect.title = 'Filter by terminal';
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All terminals';
    termSelect.appendChild(allOpt);
    termSelect.addEventListener('change', () => {
      _filterTerminalId = termSelect.value || null;
      _rebuildList();
    });
    bar.appendChild(termSelect);

    const chips = document.createElement('div');
    chips.className = 'es-chips';
    for (const group of FILTER_GROUPS) {
      const chip = document.createElement('button');
      chip.className = 'es-chip' + (_activeFilters.has(group.key) ? ' active' : '');
      chip.dataset.filterKey = group.key;
      chip.title = group.label;

      const chipIcon = document.createElement('span');
      chipIcon.className = 'material-symbols-outlined';
      chipIcon.textContent = group.icon;
      chip.appendChild(chipIcon);

      const chipLabel = document.createElement('span');
      chipLabel.textContent = group.label;
      chip.appendChild(chipLabel);

      chip.addEventListener('click', () => {
        if (_activeFilters.has(group.key)) {
          _activeFilters.delete(group.key);
          chip.classList.remove('active');
        } else {
          _activeFilters.add(group.key);
          chip.classList.add('active');
        }
        _rebuildList();
      });

      chips.appendChild(chip);
    }
    bar.appendChild(chips);

    const search = document.createElement('input');
    search.className = 'es-search';
    search.type = 'text';
    search.placeholder = 'Search events\u2026';
    let searchDebounce = null;
    search.addEventListener('input', () => {
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        _filterSearch = search.value.trim();
        _rebuildList();
      }, 200);
    });
    bar.appendChild(search);

    return bar;
  }

  function _updateTerminalSelect() {
    if (!_filterBarEl) return;
    const select = _filterBarEl.querySelector('.es-time-select');
    if (!select) return;

    const currentVal = select.value;
    while (select.options.length > 1) select.remove(1);

    agentDesk.terminal.list().then((terminals) => {
      for (const t of terminals) {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.title || t.id.slice(0, 8);
        select.appendChild(opt);
      }
      select.value = currentVal;
    });
  }

  function createPanel() {
    if (_panelEl) return _panelEl;

    _panelEl = document.createElement('div');
    _panelEl.id = 'event-stream-panel';
    _panelEl.className = 'event-stream-panel';

    const header = document.createElement('div');
    header.className = 'es-header';

    const titleSection = document.createElement('div');
    titleSection.className = 'es-title-section';

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined es-title-icon';
    icon.textContent = 'timeline';

    const title = document.createElement('span');
    title.className = 'es-title';
    title.textContent = 'Events';

    const countBadge = document.createElement('span');
    countBadge.className = 'es-count';
    countBadge.id = 'es-count';
    countBadge.textContent = '0';

    titleSection.appendChild(icon);
    titleSection.appendChild(title);
    titleSection.appendChild(countBadge);

    const controls = document.createElement('div');
    controls.className = 'es-controls';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'es-btn';
    exportBtn.title = 'Export all events as JSON';
    exportBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>';
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _exportEvents();
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'es-btn';
    clearBtn.title = 'Clear events';
    clearBtn.innerHTML = '<span class="material-symbols-outlined">delete_sweep</span>';
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearEvents();
    });

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'es-btn';
    collapseBtn.title = 'Collapse panel';
    collapseBtn.innerHTML = '<span class="material-symbols-outlined">expand_more</span>';
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });

    controls.appendChild(exportBtn);
    controls.appendChild(clearBtn);
    controls.appendChild(collapseBtn);

    header.appendChild(titleSection);
    header.appendChild(controls);

    _filterBarEl = _buildFilterBar();

    _listEl = document.createElement('div');
    _listEl.className = 'es-list';
    _listEl.id = 'es-list';

    // Load more button
    _loadMoreBtn = document.createElement('button');
    _loadMoreBtn.className = 'es-load-more';
    _loadMoreBtn.textContent = 'Load more';
    _loadMoreBtn.style.display = 'none';
    _loadMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _loadMore();
    });

    _panelEl.appendChild(header);
    _panelEl.appendChild(_filterBarEl);
    _panelEl.appendChild(_listEl);
    _panelEl.appendChild(_loadMoreBtn);

    return _panelEl;
  }

  function _exportEvents() {
    // Export ALL events (up to 1000), not just visible/rendered ones
    const exportData = _events.map((ev) => ({
      id: ev.id,
      timestamp: ev.timestamp,
      type: ev.type,
      terminalId: ev.terminalId,
      terminalName: ev.terminalName,
      agentName: ev.agentName,
      content: ev.content,
      details: ev.details,
      severity: ev.severity,
    }));
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    if (typeof showToast === 'function') {
      showToast('Exported ' + exportData.length + ' events to clipboard');
    }
  }

  function _subscribe() {
    eventBus.on('*', (event) => {
      _addEventToDOM(event);
    });

    eventBus.on('terminal:created', () => {
      setTimeout(_updateTerminalSelect, 100);
    });
    eventBus.on('terminal:exited', () => {
      setTimeout(_updateTerminalSelect, 100);
    });
  }

  function _setupPersistence() {
    // Save events on blur and before unload
    window.addEventListener('blur', _persistEvents);
    window.addEventListener('beforeunload', _persistEvents);
  }

  function init() {
    createPanel();
    _restoreEvents();
    _subscribe();
    _setupPersistence();
    _timeUpdateTimer = setInterval(_updateRelativeTimes, RELATIVE_TIME_UPDATE);
    // Rebuild list to show restored events
    if (_events.length > 0) {
      _rebuildList();
    }
  }

  function toggle() {
    _isVisible = !_isVisible;
    if (_panelEl) {
      _panelEl.classList.toggle('visible', _isVisible);
    }
    if (_isVisible) _updateTerminalSelect();
  }

  function show() {
    _isVisible = true;
    if (_panelEl) _panelEl.classList.add('visible');
    _updateTerminalSelect();
  }

  function hide() {
    _isVisible = false;
    if (_panelEl) _panelEl.classList.remove('visible');
  }

  function isVisible() {
    return _isVisible;
  }

  function clearEvents() {
    if (_listEl) _listEl.innerHTML = '';
    _events = [];
    _eventCount = 0;
    _idCounter = 0;
    _displayedCount = 0;
    _updateCount();
    _updateLoadMoreBtn(0);
    eventBus.clear();
    _persistEvents();
  }

  function getPanel() {
    return _panelEl || createPanel();
  }

  function destroy() {
    _persistEvents();
    if (_timeUpdateTimer) {
      clearInterval(_timeUpdateTimer);
      _timeUpdateTimer = null;
    }
    window.removeEventListener('blur', _persistEvents);
    window.removeEventListener('beforeunload', _persistEvents);
    if (_panelEl && _panelEl.parentNode) {
      _panelEl.remove();
    }
    _panelEl = null;
    _listEl = null;
    _filterBarEl = null;
    _loadMoreBtn = null;
    _events = [];
    _eventCount = 0;
  }

  return {
    init,
    toggle,
    show,
    hide,
    isVisible,
    clearEvents,
    getPanel,
    destroy,
    createPanel,
  };
})();
