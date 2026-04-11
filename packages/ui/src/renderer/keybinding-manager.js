// =============================================================================
// Keybinding Manager — Customizable keyboard shortcuts for Agent Desk
// =============================================================================
// Manages default and user-customized keybindings with support for:
// - Key combos (Ctrl+Shift+T, Alt+N, F5)
// - Persistence via IPC to ~/.agent-desk/keybindings.json
// =============================================================================

'use strict';

// eslint-disable-next-line no-unused-vars
const KeybindingManager = (function () {
  // ---------------------------------------------------------------------------
  // Default Keybindings
  // ---------------------------------------------------------------------------

  const DEFAULT_BINDINGS = [
    // Terminals
    {
      id: 'terminal.new',
      label: 'New Terminal',
      category: 'Terminals',
      defaultKeys: 'Ctrl+Shift+T',
      keys: null,
      action: 'newTerminal',
    },
    {
      id: 'terminal.newAgent',
      label: 'New Agent Session',
      category: 'Terminals',
      defaultKeys: 'Ctrl+Shift+C',
      keys: null,
      action: 'newAgent',
    },
    {
      id: 'terminal.close',
      label: 'Close Terminal',
      category: 'Terminals',
      defaultKeys: 'Ctrl+W',
      keys: null,
      action: 'closeTerminal',
    },
    {
      id: 'terminal.next',
      label: 'Next Terminal',
      category: 'Terminals',
      defaultKeys: 'Ctrl+Tab',
      keys: null,
      action: 'nextTerminal',
    },
    {
      id: 'terminal.prev',
      label: 'Previous Terminal',
      category: 'Terminals',
      defaultKeys: 'Ctrl+Shift+Tab',
      keys: null,
      action: 'prevTerminal',
    },
    {
      id: 'terminal.splitRight',
      label: 'Split Right',
      category: 'Terminals',
      defaultKeys: 'Ctrl+Shift+D',
      keys: null,
      action: 'splitRight',
    },
    {
      id: 'terminal.splitRightAlt',
      label: 'Split Right (Alt)',
      category: 'Terminals',
      defaultKeys: 'Ctrl+\\',
      keys: null,
      action: 'splitRight',
    },
    {
      id: 'terminal.splitDown',
      label: 'Split Down',
      category: 'Terminals',
      defaultKeys: 'Ctrl+Shift+E',
      keys: null,
      action: 'splitDown',
    },
    {
      id: 'terminal.maximize',
      label: 'Toggle Maximize',
      category: 'Terminals',
      defaultKeys: 'Ctrl+Shift+M',
      keys: null,
      action: 'toggleMaximize',
    },
    {
      id: 'terminal.saveOutput',
      label: 'Save Output',
      category: 'Terminals',
      defaultKeys: 'Ctrl+Shift+S',
      keys: null,
      action: 'saveOutput',
    },
    {
      id: 'terminal.search',
      label: 'Terminal Search',
      category: 'Terminals',
      defaultKeys: 'Ctrl+F',
      keys: null,
      action: 'terminalSearch',
    },
    {
      id: 'terminal.globalSearch',
      label: 'Search All Terminals',
      category: 'Terminals',
      defaultKeys: 'Ctrl+Shift+F',
      keys: null,
      action: 'globalSearch',
    },
    {
      id: 'terminal.selectLastOutput',
      label: 'Select Last Command Output',
      category: 'Terminals',
      defaultKeys: '',
      keys: null,
      action: 'selectLastOutput',
    },
    {
      id: 'terminal.copyLastOutput',
      label: 'Copy Last Command Output',
      category: 'Terminals',
      defaultKeys: '',
      keys: null,
      action: 'copyLastOutput',
    },

    // Navigation
    {
      id: 'focus.left',
      label: 'Focus Left',
      category: 'Navigation',
      defaultKeys: 'Alt+ArrowLeft',
      keys: null,
      action: 'focusLeft',
    },
    {
      id: 'focus.right',
      label: 'Focus Right',
      category: 'Navigation',
      defaultKeys: 'Alt+ArrowRight',
      keys: null,
      action: 'focusRight',
    },
    {
      id: 'focus.up',
      label: 'Focus Up',
      category: 'Navigation',
      defaultKeys: 'Alt+ArrowUp',
      keys: null,
      action: 'focusUp',
    },
    {
      id: 'focus.down',
      label: 'Focus Down',
      category: 'Navigation',
      defaultKeys: 'Alt+ArrowDown',
      keys: null,
      action: 'focusDown',
    },

    // Views
    {
      id: 'view.terminals',
      label: 'View: Terminals',
      category: 'Views',
      defaultKeys: 'Ctrl+1',
      keys: null,
      action: 'viewTerminals',
    },
    {
      id: 'view.comm',
      label: 'View: Agent Comm',
      category: 'Views',
      defaultKeys: 'Ctrl+2',
      keys: null,
      action: 'viewComm',
    },
    {
      id: 'view.tasks',
      label: 'View: Tasks',
      category: 'Views',
      defaultKeys: 'Ctrl+3',
      keys: null,
      action: 'viewTasks',
    },
    {
      id: 'view.knowledge',
      label: 'View: Agent Knowledge',
      category: 'Views',
      defaultKeys: 'Ctrl+4',
      keys: null,
      action: 'viewKnowledge',
    },
    {
      id: 'view.discover',
      label: 'View: Discover',
      category: 'Views',
      defaultKeys: 'Ctrl+5',
      keys: null,
      action: 'viewDiscover',
    },
    {
      id: 'view.events',
      label: 'View: Events',
      category: 'Views',
      defaultKeys: 'Ctrl+6',
      keys: null,
      action: 'viewEvents',
    },
    {
      id: 'view.settings',
      label: 'View: Settings',
      category: 'Views',
      defaultKeys: 'Ctrl+7',
      keys: null,
      action: 'viewSettings',
    },

    // General
    {
      id: 'general.commandPalette',
      label: 'Command Palette',
      category: 'General',
      defaultKeys: 'Ctrl+Shift+P',
      keys: null,
      action: 'commandPalette',
    },
    {
      id: 'general.quickSwitcher',
      label: 'Quick Switcher',
      category: 'General',
      defaultKeys: 'Ctrl+P',
      keys: null,
      action: 'quickSwitcher',
    },
    {
      id: 'general.shortcuts',
      label: 'Show Shortcuts',
      category: 'General',
      defaultKeys: 'F1',
      keys: null,
      action: 'showShortcuts',
    },
    {
      id: 'general.eventStream',
      label: 'Toggle Event Stream',
      category: 'General',
      defaultKeys: 'Ctrl+E',
      keys: null,
      action: 'eventStream',
    },
    {
      id: 'workspace.save',
      label: 'Save Workspace',
      category: 'Workspace',
      defaultKeys: 'Ctrl+Shift+W',
      keys: null,
      action: 'saveWorkspace',
    },
    {
      id: 'workspace.load',
      label: 'Load Workspace',
      category: 'Workspace',
      defaultKeys: 'Ctrl+Alt+W',
      keys: null,
      action: 'loadWorkspace',
    },
    {
      id: 'general.batchLaunch',
      label: 'Batch Launch Agents',
      category: 'General',
      defaultKeys: 'Ctrl+Shift+B',
      keys: null,
      action: 'batchLaunch',
    },
  ];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let _bindings = [];
  let _actions = {};
  let _statusCallback = null;

  // ---------------------------------------------------------------------------
  // Key Parsing & Normalization
  // ---------------------------------------------------------------------------

  function parseKeyCombo(str) {
    if (!str || !str.trim()) return null;
    str = str.trim();

    const parts = str.split('+');
    const combo = { ctrl: false, shift: false, alt: false, meta: false, key: '' };

    for (const part of parts) {
      const lower = part.toLowerCase().trim();
      if (lower === 'ctrl' || lower === 'control') {
        combo.ctrl = true;
      } else if (lower === 'shift') {
        combo.shift = true;
      } else if (lower === 'alt') {
        combo.alt = true;
      } else if (lower === 'meta' || lower === 'cmd' || lower === 'command') {
        combo.meta = true;
      } else {
        combo.key = part.trim();
      }
    }

    return combo.key ? combo : null;
  }

  function eventToCombo(e) {
    let key = e.key;

    if (key === ' ') key = 'Space';
    if (key.length === 1) key = key.toUpperCase();

    const keyMap = {
      ARROWLEFT: 'ArrowLeft',
      ARROWRIGHT: 'ArrowRight',
      ARROWUP: 'ArrowUp',
      ARROWDOWN: 'ArrowDown',
      ESCAPE: 'Escape',
      ENTER: 'Enter',
      TAB: 'Tab',
      BACKSPACE: 'Backspace',
      DELETE: 'Delete',
      HOME: 'Home',
      END: 'End',
      PAGEUP: 'PageUp',
      PAGEDOWN: 'PageDown',
      INSERT: 'Insert',
    };

    const upper = key.toUpperCase();
    if (keyMap[upper]) key = keyMap[upper];

    if (/^F\d+$/i.test(key)) key = key.toUpperCase();

    return {
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
      meta: false,
      key: key,
    };
  }

  function combosMatch(a, b) {
    if (!a || !b) return false;
    return a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt && a.key.toLowerCase() === b.key.toLowerCase();
  }

  function comboToString(combo) {
    if (!combo) return '';
    const parts = [];
    if (combo.ctrl) parts.push('Ctrl');
    if (combo.shift) parts.push('Shift');
    if (combo.alt) parts.push('Alt');
    if (combo.meta) parts.push('Meta');
    parts.push(combo.key);
    return parts.join('+');
  }

  // ---------------------------------------------------------------------------
  // Binding Management
  // ---------------------------------------------------------------------------

  function getEffectiveKeys(binding) {
    if (binding.keys === null || binding.keys === undefined) {
      return binding.defaultKeys;
    }
    return binding.keys;
  }

  async function loadBindings() {
    _bindings = DEFAULT_BINDINGS.map((b) => ({ ...b }));

    try {
      if (typeof agentDesk !== 'undefined' && agentDesk.keybindings) {
        const userOverrides = await agentDesk.keybindings.read();
        if (userOverrides && typeof userOverrides === 'object') {
          for (const binding of _bindings) {
            if (binding.id in userOverrides) {
              binding.keys = userOverrides[binding.id];
            }
          }
        }
      }
    } catch (_err) {
      // No user overrides file, use defaults
    }
  }

  async function saveBindings() {
    const overrides = {};
    for (const binding of _bindings) {
      if (binding.keys !== null && binding.keys !== undefined) {
        overrides[binding.id] = binding.keys;
      }
    }
    try {
      if (typeof agentDesk !== 'undefined' && agentDesk.keybindings) {
        await agentDesk.keybindings.write(overrides);
      }
    } catch (_err) {
      // Save failed
    }
  }

  function registerAction(actionName, handler) {
    _actions[actionName] = handler;
  }

  function setStatusCallback(cb) {
    _statusCallback = cb;
  }

  function getBindings() {
    return _bindings.map((b) => ({
      ...b,
      effectiveKeys: getEffectiveKeys(b),
    }));
  }

  function setBindingKeys(id, keys) {
    const binding = _bindings.find((b) => b.id === id);
    if (binding) {
      binding.keys = keys;
      saveBindings();
    }
  }

  function resetBinding(id) {
    const binding = _bindings.find((b) => b.id === id);
    if (binding) {
      binding.keys = null;
      saveBindings();
    }
  }

  function resetAll() {
    for (const binding of _bindings) {
      binding.keys = null;
    }
    saveBindings();
  }

  // ---------------------------------------------------------------------------
  // Event Handling
  // ---------------------------------------------------------------------------

  function handleKeyEvent(e) {
    const eventCombo = eventToCombo(e);

    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      return false;
    }

    for (const binding of _bindings) {
      const keys = getEffectiveKeys(binding);
      if (!keys) continue;

      const combo = parseKeyCombo(keys);
      if (combo && combosMatch(combo, eventCombo)) {
        e.preventDefault();
        const handler = _actions[binding.action];
        if (handler) handler();
        return true;
      }
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Capture Mode (for settings UI)
  // ---------------------------------------------------------------------------

  function startCapture(callback) {
    function onKeyDown(e) {
      e.preventDefault();
      e.stopPropagation();

      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      if (e.key === 'Escape') {
        cleanup();
        callback(null);
        return;
      }

      const combo = eventToCombo(e);
      cleanup();
      callback(comboToString(combo));
    }

    function cleanup() {
      document.removeEventListener('keydown', onKeyDown, true);
    }

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cleanup();
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    loadBindings,
    saveBindings,
    registerAction,
    setStatusCallback,
    handleKeyEvent,
    getBindings,
    setBindingKeys,
    resetBinding,
    resetAll,
    getEffectiveKeys,
    startCapture,
    parseKeyCombo,
    comboToString,
    DEFAULT_BINDINGS,
  };
})();
