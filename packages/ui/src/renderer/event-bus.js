// =============================================================================
// Agent Desk — Event Bus (Pub/Sub)
// =============================================================================
// Simple publish/subscribe event bus used by all modules. The event stream
// panel subscribes; terminals, agent parser, and pollers publish.
// =============================================================================

'use strict';

// eslint-disable-next-line no-unused-vars
const eventBus = (function () {
  /** @type {Map<string, Set<Function>>} */
  const _listeners = new Map();

  /** @type {Array<{type: string, data: object, timestamp: number, id: number}>} */
  const _history = [];

  let _idCounter = 0;
  const MAX_HISTORY = 2000;

  /**
   * Subscribe to an event type.
   * @param {string} type
   * @param {Function} handler
   * @returns {Function} unsubscribe function
   */
  function on(type, handler) {
    if (!_listeners.has(type)) _listeners.set(type, new Set());
    _listeners.get(type).add(handler);
    return () => off(type, handler);
  }

  /**
   * Unsubscribe from an event type.
   * @param {string} type
   * @param {Function} handler
   */
  function off(type, handler) {
    const set = _listeners.get(type);
    if (set) {
      set.delete(handler);
      if (set.size === 0) _listeners.delete(type);
    }
  }

  /**
   * Emit an event.
   * @param {string} type
   * @param {object} data
   */
  function emit(type, data) {
    const event = {
      type,
      data: data || {},
      timestamp: Date.now(),
      id: ++_idCounter,
    };

    _history.push(event);
    if (_history.length > MAX_HISTORY) {
      _history.splice(0, _history.length - MAX_HISTORY);
    }

    const set = _listeners.get(type);
    if (set) {
      for (const handler of set) {
        try {
          handler(event);
        } catch (err) {
          console.error(`[event-bus] Error in handler for "${type}":`, err);
        }
      }
    }

    // Wildcard listeners
    const wildcard = _listeners.get('*');
    if (wildcard) {
      for (const handler of wildcard) {
        try {
          handler(event);
        } catch (err) {
          console.error('[event-bus] Error in wildcard handler:', err);
        }
      }
    }
  }

  /**
   * Get event history, optionally filtered by type.
   * @param {string} [type]
   * @param {number} [since] timestamp
   * @returns {Array}
   */
  function history(type, since) {
    let result = _history;
    if (type) result = result.filter((e) => e.type === type);
    if (since) result = result.filter((e) => e.timestamp >= since);
    return result;
  }

  /**
   * Clear all history.
   */
  function clear() {
    _history.length = 0;
  }

  return { on, off, emit, history, clear };
})();
