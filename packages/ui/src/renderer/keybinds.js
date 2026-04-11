// =============================================================================
// Agent Desk — Keyboard Shortcut Registration
// =============================================================================

'use strict';

import { state, registry } from './state.js';

function _registerKeybindingActions() {
  const km = KeybindingManager;
  km.registerAction('newTerminal', () => {
    const profiles = typeof getProfiles === 'function' ? getProfiles() : [];
    const defaultId = typeof getSetting === 'function' ? getSetting('defaultProfile') : 'default-shell';
    const profile = profiles.find((p) => p.id === defaultId) || profiles[0];
    if (profile) {
      registry.createTerminalFromProfile(profile);
    } else {
      registry.createTerminal();
    }
  });
  km.registerAction('newAgent', () => {
    const profiles = typeof getProfiles === 'function' ? getProfiles() : [];
    const shellIds = new Set(['default-shell']);
    const agentProfile = profiles.find((p) => !shellIds.has(p.id) && p.command && p.command !== '');
    if (agentProfile) {
      registry.createTerminalFromProfile(agentProfile);
    } else {
      registry.createTerminal();
    }
  });
  km.registerAction('closeTerminal', () => {
    if (state.activeTerminalId && state.activeView === 'terminals')
      registry.confirmCloseTerminal(state.activeTerminalId);
  });
  km.registerAction('nextTerminal', () => registry._cycleNextTerminal());
  km.registerAction('prevTerminal', () => registry._cyclePrevTerminal());
  km.registerAction('splitRight', () => registry.splitTerminalRight());
  km.registerAction('splitDown', () => registry.splitTerminalDown());
  km.registerAction('toggleMaximize', () => registry.toggleMaximize());
  km.registerAction('saveOutput', () => {
    if (state.activeTerminalId) registry.saveTerminalOutput(state.activeTerminalId);
  });
  km.registerAction('terminalSearch', () => {
    if (state.activeView === 'terminals' && state.activeTerminalId) registry.openSearchBar();
  });
  km.registerAction('globalSearch', () => registry.showGlobalSearch());
  km.registerAction('selectLastOutput', () => registry._selectLastCommandOutput());
  km.registerAction('copyLastOutput', () => registry._copyLastCommandOutput());
  km.registerAction('focusLeft', () => registry._focusDirection('left'));
  km.registerAction('focusRight', () => registry._focusDirection('right'));
  km.registerAction('focusUp', () => registry._focusDirection('up'));
  km.registerAction('focusDown', () => registry._focusDirection('down'));
  km.registerAction('viewTerminals', () => registry.switchView('terminals'));
  km.registerAction('viewComm', () => registry.switchView('comm'));
  km.registerAction('viewTasks', () => registry.switchView('tasks'));
  km.registerAction('viewKnowledge', () => registry.switchView('knowledge'));
  km.registerAction('viewDiscover', () => registry.switchView('discover'));
  km.registerAction('viewEvents', () => registry.switchView('events'));
  km.registerAction('viewSettings', () => registry.switchView('settings'));
  km.registerAction('commandPalette', () => registry.showCommandPalette());
  km.registerAction('quickSwitcher', () => registry.showQuickSwitcher());
  km.registerAction('showShortcuts', () => registry.showShortcutsOverlay());
  km.registerAction('eventStream', () => registry.switchView('events'));
  km.registerAction('saveWorkspace', () => registry.showWorkspaceSaveDialog());
  km.registerAction('loadWorkspace', () => registry.showWorkspaceLoadPicker());
  km.registerAction('batchLaunch', () => registry.showBatchLauncher());
  km.setStatusCallback((msg) => {
    const center = document.querySelector('#status-bar .status-center');
    if (center) center.textContent = msg || '';
  });
}

export async function setupKeyboardShortcuts() {
  if (typeof KeybindingManager !== 'undefined') {
    _registerKeybindingActions();
    await KeybindingManager.loadBindings();
  }
  document.addEventListener('keydown', (e) => {
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    if (e.key === 'Escape') {
      if (registry.isSearchBarOpen()) {
        registry.closeSearchBar();
        return;
      }
      registry.hideGlobalSearch();
      registry.hideCommandPalette();
      registry.hideQuickSwitcher();
      registry.hideShortcutsOverlay();
      if (typeof registry.hideBatchLauncher === 'function') registry.hideBatchLauncher();
      return;
    }

    if (typeof KeybindingManager !== 'undefined') {
      KeybindingManager.handleKeyEvent(e);
    }
  });
}

registry.setupKeyboardShortcuts = setupKeyboardShortcuts;
