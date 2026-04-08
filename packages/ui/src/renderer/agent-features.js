// =============================================================================
// Agent Desk — Agent Features (chains, agent registry, enriched status)
// =============================================================================

'use strict';

import { state, registry } from './state.js';

// Terminal Chains — sequenced terminal execution

export function addTerminalChain(sourceId, targetId, trigger, command) {
  if (sourceId === targetId) return;
  state.terminalChains.push({ sourceId, targetId, trigger, command });
  updateChainIndicators();
}

export function removeTerminalChain(sourceId, targetId) {
  state.terminalChains = state.terminalChains.filter((c) => !(c.sourceId === sourceId && c.targetId === targetId));
  updateChainIndicators();
}

export function cleanupTerminalChains(id) {
  state.terminalChains = state.terminalChains.filter((c) => c.sourceId !== id && c.targetId !== id);
  updateChainIndicators();
}

export function getChainsForTerminal(id) {
  return state.terminalChains.filter((c) => c.sourceId === id);
}

export function checkChainTrigger(sourceId, trigger) {
  const chains = state.terminalChains.filter((c) => c.sourceId === sourceId && c.trigger === trigger);
  for (const chain of chains) {
    const targetTs = state.terminals.get(chain.targetId);
    if (targetTs && targetTs.status !== 'exited') {
      agentDesk.terminal.write(chain.targetId, chain.command + '\r');
      const sourceTs = state.terminals.get(sourceId);
      eventBus.emit('chain:triggered', {
        sourceId,
        targetId: chain.targetId,
        sourceTitle: sourceTs ? sourceTs.title : sourceId,
        targetTitle: targetTs.title,
        trigger,
        command: chain.command,
      });
    }
  }
}

export function updateChainIndicators() {
  for (const [id, ts] of state.terminals) {
    if (!ts._tabEl) continue;
    let badge = ts._tabEl.querySelector('.chain-badge');
    const chains = getChainsForTerminal(id);
    if (chains.length > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'chain-badge';
        ts._tabEl.appendChild(badge);
      }
      badge.textContent = '\u26D3' + chains.length;
    } else if (badge) {
      badge.remove();
    }
  }
}

export function showChainPicker(sourceId) {
  const items = [];
  const existing = getChainsForTerminal(sourceId);
  for (const [id, ts] of state.terminals) {
    if (id === sourceId) continue;
    const chained = existing.find((c) => c.targetId === id);
    items.push({
      label: (chained ? '\u2713 ' : '') + (ts.title || 'Terminal'),
      icon: chained ? 'link_off' : 'link',
      action: () => {
        if (chained) {
          removeTerminalChain(sourceId, id);
          registry.showToast('Unchained from ' + ts.title);
        } else {
          showChainConfigDialog(sourceId, id);
        }
      },
    });
  }
  if (items.length === 0) {
    items.push({ label: 'No other terminals', icon: 'info', action: () => {} });
  }
  const srcTs = state.terminals.get(sourceId);
  const rect = srcTs && srcTs._tabEl ? srcTs._tabEl.getBoundingClientRect() : { left: 100, bottom: 100 };
  registry.showContextMenu(rect.left, rect.bottom, items);
}

export function showChainConfigDialog(sourceId, targetId) {
  const sourceTs = state.terminals.get(sourceId);
  const targetTs = state.terminals.get(targetId);
  if (!sourceTs || !targetTs) return;

  const existing = document.querySelector('.confirm-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  const modal = document.createElement('div');
  modal.className = 'confirm-modal';
  modal.style.maxWidth = '450px';

  const h = document.createElement('h3');
  h.textContent = 'Chain: ' + sourceTs.title + ' \u2192 ' + targetTs.title;
  modal.appendChild(h);

  const triggerLabel = document.createElement('label');
  triggerLabel.textContent = 'Trigger:';
  triggerLabel.style.cssText =
    'display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;margin-top:12px;';
  modal.appendChild(triggerLabel);

  const triggerSelect = document.createElement('select');
  triggerSelect.style.cssText =
    'width:100%;padding:8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);font-family:var(--font);font-size:13px;';
  const chainTriggers = [
    { value: 'exit-0', label: 'Exit with code 0 (success)' },
    { value: 'exit-any', label: 'Exit with any code' },
    { value: 'idle', label: 'Becomes idle' },
  ];
  for (const t of chainTriggers) {
    const opt = document.createElement('option');
    opt.value = t.value;
    opt.textContent = t.label;
    triggerSelect.appendChild(opt);
  }
  modal.appendChild(triggerSelect);

  const cmdLabel = document.createElement('label');
  cmdLabel.textContent = 'Command to run:';
  cmdLabel.style.cssText = 'display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;margin-top:12px;';
  modal.appendChild(cmdLabel);

  const cmdInput = document.createElement('input');
  cmdInput.type = 'text';
  cmdInput.placeholder = 'e.g. npm test';
  cmdInput.style.cssText =
    'width:100%;padding:8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);font-family:var(--font-mono);font-size:13px;box-sizing:border-box;';
  modal.appendChild(cmdInput);

  const btnRow = document.createElement('div');
  btnRow.className = 'confirm-buttons';
  btnRow.style.marginTop = '16px';

  const keyHandler = (e) => {
    if (e.key === 'Escape') cleanup();
  };

  function cleanup() {
    document.removeEventListener('keydown', keyHandler);
    overlay.remove();
  }

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'confirm-btn confirm-btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', cleanup);

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'confirm-btn';
  confirmBtn.style.cssText = 'background:var(--accent);color:#fff;border-color:var(--accent);';
  confirmBtn.textContent = 'Create Chain';
  confirmBtn.addEventListener('click', () => {
    const cmd = cmdInput.value.trim();
    if (!cmd) {
      cmdInput.style.borderColor = 'var(--danger)';
      return;
    }
    addTerminalChain(sourceId, targetId, triggerSelect.value, cmd);
    cleanup();
    registry.showToast('Chained to ' + targetTs.title);
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    cmdInput.focus();
  });

  document.addEventListener('keydown', keyHandler);
}

// Agent Registry
export function getAgentTerminals() {
  return agentParser.getAgentTerminals().map((a) => {
    const ts = state.terminals.get(a.terminalId);
    return {
      ...a,
      title: ts ? ts.title : null,
      terminalStatus: ts ? ts.status : null,
    };
  });
}

registry.addTerminalChain = addTerminalChain;
registry.removeTerminalChain = removeTerminalChain;
registry.cleanupTerminalChains = cleanupTerminalChains;
registry.getChainsForTerminal = getChainsForTerminal;
registry.checkChainTrigger = checkChainTrigger;
registry.showChainPicker = showChainPicker;
registry.getAgentTerminals = getAgentTerminals;
