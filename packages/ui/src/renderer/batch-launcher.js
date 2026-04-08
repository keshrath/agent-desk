// =============================================================================
// Agent Desk — Batch Agent Launcher
// =============================================================================
// Modal dialog for launching multiple agent terminals at once with configurable
// naming patterns, stagger delays, CPU-aware throttling, max concurrency,
// and template variable prompting.
// =============================================================================

'use strict';

import { state, registry } from './state.js';

// ---------------------------------------------------------------------------
// Show batch launcher dialog
// ---------------------------------------------------------------------------

export function showBatchLauncher(prefill = {}) {
  if (document.querySelector('.batch-launcher-overlay')) return;

  const profiles = typeof getProfiles === 'function' ? getProfiles() : [];
  const defaultProfileId = typeof getSetting === 'function' ? getSetting('defaultProfile') : 'default-shell';

  const overlay = document.createElement('div');
  overlay.className = 'batch-launcher-overlay';

  const modal = document.createElement('div');
  modal.className = 'batch-launcher-modal';

  const header = document.createElement('div');
  header.className = 'batch-launcher-header';
  const headerIcon = document.createElement('span');
  headerIcon.className = 'material-symbols-outlined';
  headerIcon.textContent = 'rocket_launch';
  const headerTitle = document.createElement('h2');
  headerTitle.textContent = 'Launch Agent Batch';
  header.appendChild(headerIcon);
  header.appendChild(headerTitle);
  modal.appendChild(header);

  const form = document.createElement('div');
  form.className = 'batch-launcher-form';

  const countRow = _createFormRow('Agent Count', 'groups');
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.className = 'batch-launcher-input';
  countInput.min = 1;
  countInput.max = 20;
  countInput.value = prefill.count || 3;
  countRow.appendChild(countInput);
  form.appendChild(countRow);

  const profileRow = _createFormRow('Profile', 'account_circle');
  const profileSelect = document.createElement('select');
  profileSelect.className = 'batch-launcher-select';
  for (const p of profiles) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === (prefill.profileId || defaultProfileId)) opt.selected = true;
    profileSelect.appendChild(opt);
  }
  profileRow.appendChild(profileSelect);
  form.appendChild(profileRow);

  const nameRow = _createFormRow('Naming Pattern', 'label');
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'batch-launcher-input';
  nameInput.value = prefill.namingPattern || 'agent-{n}';
  nameInput.placeholder = 'agent-{n}';
  nameRow.appendChild(nameInput);
  form.appendChild(nameRow);

  const cwdRow = _createFormRow('Working Directory', 'folder');
  const cwdWrap = document.createElement('div');
  cwdWrap.className = 'batch-launcher-cwd-wrap';
  const cwdInput = document.createElement('input');
  cwdInput.type = 'text';
  cwdInput.className = 'batch-launcher-input';
  cwdInput.value = prefill.cwd || '';
  cwdInput.placeholder = '(use profile default)';
  const cwdBrowse = document.createElement('button');
  cwdBrowse.className = 'batch-launcher-browse';
  cwdBrowse.innerHTML = '<span class="material-symbols-outlined">folder_open</span>';
  cwdBrowse.addEventListener('click', async () => {
    if (typeof agentDesk !== 'undefined' && agentDesk.dialog && agentDesk.dialog.openDirectory) {
      const dir = await agentDesk.dialog.openDirectory({ defaultPath: cwdInput.value || undefined });
      if (dir) cwdInput.value = dir;
    }
  });
  cwdWrap.appendChild(cwdInput);
  cwdWrap.appendChild(cwdBrowse);
  cwdRow.appendChild(cwdWrap);
  form.appendChild(cwdRow);

  const cmdRow = _createFormRow('Initial Command', 'terminal');
  const cmdInput = document.createElement('input');
  cmdInput.type = 'text';
  cmdInput.className = 'batch-launcher-input';
  cmdInput.value = prefill.initialCommand || '';
  cmdInput.placeholder = '(optional)';
  cmdRow.appendChild(cmdInput);
  form.appendChild(cmdRow);

  const delayRow = _createFormRow('Stagger Delay (ms)', 'timer');
  const delayInput = document.createElement('input');
  delayInput.type = 'number';
  delayInput.className = 'batch-launcher-input';
  delayInput.min = 0;
  delayInput.max = 10000;
  delayInput.step = 100;
  delayInput.value = prefill.staggerDelay != null ? prefill.staggerDelay : 1000;
  delayRow.appendChild(delayInput);
  form.appendChild(delayRow);

  const maxConcRow = _createFormRow('Max Concurrent', 'tune');
  const maxConcInput = document.createElement('input');
  maxConcInput.type = 'number';
  maxConcInput.className = 'batch-launcher-input';
  maxConcInput.min = 0;
  maxConcInput.max = 20;
  maxConcInput.value = prefill.maxConcurrent || 0;
  maxConcInput.placeholder = '0 = unlimited';
  maxConcInput.title = '0 = unlimited';
  maxConcRow.appendChild(maxConcInput);
  form.appendChild(maxConcRow);

  modal.appendChild(form);

  const progressWrap = document.createElement('div');
  progressWrap.className = 'batch-launcher-progress';
  progressWrap.style.display = 'none';
  const progressBar = document.createElement('div');
  progressBar.className = 'batch-launcher-progress-bar';
  const progressFill = document.createElement('div');
  progressFill.className = 'batch-launcher-progress-fill';
  progressBar.appendChild(progressFill);
  const progressLabel = document.createElement('span');
  progressLabel.className = 'batch-launcher-progress-label';
  progressLabel.textContent = '0 / 0';
  progressWrap.appendChild(progressBar);
  progressWrap.appendChild(progressLabel);
  modal.appendChild(progressWrap);

  const actions = document.createElement('div');
  actions.className = 'batch-launcher-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'batch-launcher-btn batch-launcher-btn-secondary';
  saveBtn.innerHTML = '<span class="material-symbols-outlined">bookmark_add</span> Save as Template';
  saveBtn.addEventListener('click', () => {
    const config = _gatherConfig();
    if (typeof registry.showTemplateSaveDialog === 'function') {
      registry.showTemplateSaveDialog(config);
    }
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'batch-launcher-btn batch-launcher-btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => hideBatchLauncher());

  const launchBtn = document.createElement('button');
  launchBtn.className = 'batch-launcher-btn batch-launcher-btn-primary';
  launchBtn.innerHTML = '<span class="material-symbols-outlined">rocket_launch</span> Launch';
  launchBtn.addEventListener('click', () => {
    const config = _gatherConfig();
    _executeBatchLaunch(config, progressWrap, progressFill, progressLabel, launchBtn);
  });

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  actions.appendChild(launchBtn);
  modal.appendChild(actions);

  overlay.appendChild(modal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideBatchLauncher();
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    countInput.focus();
  });

  function _gatherConfig() {
    const count = Math.max(1, Math.min(20, parseInt(countInput.value, 10) || 3));
    const profileId = profileSelect.value;
    const profile = profiles.find((p) => p.id === profileId) || profiles[0];
    return {
      count,
      profileId: profile ? profile.id : 'default-shell',
      profileName: profile ? profile.name : 'Terminal',
      namingPattern: nameInput.value || 'agent-{n}',
      cwd: cwdInput.value || '',
      initialCommand: cmdInput.value || '',
      staggerDelay: Math.max(0, parseInt(delayInput.value, 10) || 1000),
      maxConcurrent: Math.max(0, parseInt(maxConcInput.value, 10) || 0),
    };
  }

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hideBatchLauncher();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      const active = document.activeElement;
      if (active && active.tagName !== 'TEXTAREA') {
        e.preventDefault();
        launchBtn.click();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Hide batch launcher
// ---------------------------------------------------------------------------

export function hideBatchLauncher() {
  const overlay = document.querySelector('.batch-launcher-overlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
  setTimeout(() => overlay.remove(), 150);
}

// ---------------------------------------------------------------------------
// CPU monitoring helpers
// ---------------------------------------------------------------------------

async function _getCpuUsage() {
  try {
    if (typeof window.agentDesk !== 'undefined' && window.agentDesk.system && window.agentDesk.system.getStats) {
      const stats = await window.agentDesk.system.getStats();
      if (stats && typeof stats.cpuPercent === 'number') return stats.cpuPercent;
      if (stats && typeof stats.cpu === 'number') return stats.cpu;
    }
  } catch {
    /* stats unavailable */
  }
  return -1;
}

async function _waitForCpuBelow(threshold, label) {
  let cpu = await _getCpuUsage();
  if (cpu < 0) return;
  while (cpu > threshold) {
    if (label) label.textContent = label.textContent.replace(/ \| CPU: \d+%/, '') + ` | CPU: ${Math.round(cpu)}%`;
    await _delay(1000);
    cpu = await _getCpuUsage();
    if (cpu < 0) return;
  }
}

// ---------------------------------------------------------------------------
// Execute batch launch
// ---------------------------------------------------------------------------

async function _executeBatchLaunch(config, progressWrap, progressFill, progressLabel, launchBtn) {
  const { count, profileId, namingPattern, cwd, initialCommand, staggerDelay, maxConcurrent } = config;

  const form = document.querySelector('.batch-launcher-form');
  if (form) form.classList.add('batch-launcher-disabled');
  launchBtn.disabled = true;
  progressWrap.style.display = 'flex';

  const profiles = typeof getProfiles === 'function' ? getProfiles() : [];
  const profile = profiles.find((p) => p.id === profileId) || profiles[0];

  if (state.activeView !== 'terminals') {
    registry.switchView('terminals');
  }

  let running = 0;
  let launched = 0;

  for (let i = 0; i < count; i++) {
    const name = namingPattern.replace(/\{n\}/g, String(i + 1));

    const cpu = await _getCpuUsage();
    const cpuSuffix = cpu >= 0 ? ` | CPU: ${Math.round(cpu)}%` : '';
    progressLabel.textContent = `${i + 1} / ${count}${cpuSuffix}`;
    progressFill.style.width = `${((i + 1) / count) * 100}%`;

    if (cpu > 80) {
      progressLabel.textContent = `${i + 1} / ${count} | CPU: ${Math.round(cpu)}% — paused`;
      await _waitForCpuBelow(60, progressLabel);
    }

    if (maxConcurrent > 0 && running >= maxConcurrent) {
      progressLabel.textContent = `${i + 1} / ${count} — waiting for slot${cpuSuffix}`;
      while (running >= maxConcurrent) {
        await _delay(500);
      }
    }

    try {
      const opts = {};
      if (profile) {
        if (profile.command) opts.command = profile.command;
        if (profile.args && profile.args.length > 0) opts.args = profile.args;
        if (profile.icon) opts.icon = profile.icon;
        if (profile.env && Object.keys(profile.env).length > 0) opts.env = profile.env;
      }
      opts.title = name;
      opts.profileName = profile ? profile.name : '';
      if (cwd) opts.cwd = cwd;
      else if (profile && profile.cwd) opts.cwd = profile.cwd;

      if (i > 0) opts.noActivate = true;

      running++;
      const termId = await registry.createTerminal(opts);

      if (initialCommand && termId) {
        const resolvedId = typeof termId === 'object' ? termId.id || termId : termId;
        await _delay(300);
        if (typeof agentDesk !== 'undefined') {
          agentDesk.terminal.write(resolvedId, initialCommand + '\r');
        }
      }

      launched++;

      if (maxConcurrent > 0 && termId) {
        const resolvedId = typeof termId === 'object' ? termId.id || termId : termId;
        _trackTerminalExit(resolvedId, () => {
          running = Math.max(0, running - 1);
        });
      }
    } catch (err) {
      console.error(`Batch launch error for agent ${i + 1}:`, err);
      running = Math.max(0, running - 1);
    }

    if (i < count - 1 && staggerDelay > 0) {
      await _delay(staggerDelay);
    }
  }

  const finalCpu = await _getCpuUsage();
  const finalSuffix = finalCpu >= 0 ? ` | CPU: ${Math.round(finalCpu)}%` : '';
  progressLabel.textContent = `${count} / ${count} — Done${finalSuffix}`;
  progressFill.style.width = '100%';
  registry.showToast(`Launched ${launched} agents`);

  await _delay(600);
  hideBatchLauncher();
}

// ---------------------------------------------------------------------------
// Track terminal exit for max-concurrent slot release
// ---------------------------------------------------------------------------

function _trackTerminalExit(terminalId, onExit) {
  const checkInterval = setInterval(async () => {
    try {
      const terminals = await agentDesk.terminal.list();
      const t = terminals.find((tt) => tt.id === terminalId);
      if (!t || t.status === 'exited') {
        clearInterval(checkInterval);
        onExit();
      }
    } catch {
      clearInterval(checkInterval);
      onExit();
    }
  }, 3000);
}

// ---------------------------------------------------------------------------
// Template variable extraction and prompting
// ---------------------------------------------------------------------------

export function extractTemplateVariables(template) {
  const vars = new Set();
  if (!template || !template.agents) return [];
  for (const agent of template.agents) {
    if (agent.initialInput) {
      const matches = agent.initialInput.matchAll(/\{\{(\w+)\}\}/g);
      for (const m of matches) {
        vars.add(m[1]);
      }
    }
  }
  return [...vars];
}

function _showVariablePrompt(variables) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'template-var-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'template-var-dialog';

    const header = document.createElement('h3');
    header.className = 'template-var-header';
    header.textContent = 'Template Variables';
    dialog.appendChild(header);

    const desc = document.createElement('p');
    desc.className = 'template-var-desc';
    desc.textContent = 'Enter values for the template variables:';
    dialog.appendChild(desc);

    const inputs = {};
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'template-var-fields';

    for (const varName of variables) {
      const row = document.createElement('div');
      row.className = 'template-var-row';

      const label = document.createElement('label');
      label.className = 'template-var-label';
      label.textContent = varName;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'template-var-input';
      input.placeholder = `Enter ${varName}`;
      inputs[varName] = input;

      row.appendChild(label);
      row.appendChild(input);
      fieldContainer.appendChild(row);
    }
    dialog.appendChild(fieldContainer);

    const actions = document.createElement('div');
    actions.className = 'template-var-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'batch-launcher-btn batch-launcher-btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      _close(null);
    });

    const okBtn = document.createElement('button');
    okBtn.className = 'batch-launcher-btn batch-launcher-btn-primary';
    okBtn.textContent = 'Launch';
    okBtn.addEventListener('click', () => {
      const values = {};
      for (const [k, inp] of Object.entries(inputs)) {
        values[k] = inp.value;
      }
      _close(values);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);

    function _close(result) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 150);
      resolve(result);
    }

    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        _close(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        okBtn.click();
      }
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      const firstInput = fieldContainer.querySelector('input');
      if (firstInput) firstInput.focus();
    });
  });
}

function _applyVariables(text, values) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    return values[name] !== undefined ? values[name] : match;
  });
}

// ---------------------------------------------------------------------------
// Launch a template (called from templates.js or commands)
// ---------------------------------------------------------------------------

export async function launchTemplate(template) {
  if (!template || !template.agents || template.agents.length === 0) return;

  const variables = extractTemplateVariables(template);
  let varValues = {};

  if (variables.length > 0) {
    const result = await _showVariablePrompt(variables);
    if (result === null) return;
    varValues = result;
  }

  if (state.activeView !== 'terminals') {
    registry.switchView('terminals');
  }

  const profiles = typeof getProfiles === 'function' ? getProfiles() : [];
  const stagger = template.staggerDelay != null ? template.staggerDelay : 1000;

  for (let i = 0; i < template.agents.length; i++) {
    const agentCfg = template.agents[i];
    const profile = profiles.find((p) => p.id === agentCfg.profile) || profiles[0];

    try {
      const opts = {};
      if (profile) {
        if (profile.command) opts.command = profile.command;
        if (profile.args && profile.args.length > 0) opts.args = profile.args;
        if (profile.icon) opts.icon = profile.icon;
        if (profile.env && Object.keys(profile.env).length > 0) opts.env = profile.env;
      }
      if (agentCfg.command) opts.command = agentCfg.command;
      if (agentCfg.name) opts.title = agentCfg.name;
      opts.profileName = profile ? profile.name : '';
      if (agentCfg.cwd) opts.cwd = agentCfg.cwd;
      else if (profile && profile.cwd) opts.cwd = profile.cwd;

      if (i > 0) opts.noActivate = true;

      const termId = await registry.createTerminal(opts);

      if (agentCfg.initialInput && termId) {
        const resolvedId = typeof termId === 'object' ? termId.id || termId : termId;
        const resolvedInput =
          variables.length > 0 ? _applyVariables(agentCfg.initialInput, varValues) : agentCfg.initialInput;
        await _delay(300);
        if (typeof agentDesk !== 'undefined') {
          agentDesk.terminal.write(resolvedId, resolvedInput + '\r');
        }
      }
    } catch (err) {
      console.error(`Template launch error for "${agentCfg.name}":`, err);
    }

    if (i < template.agents.length - 1 && stagger > 0) {
      await _delay(stagger);
    }
  }

  registry.showToast(`Launched template "${template.name}" (${template.agents.length} agents)`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _createFormRow(label, icon) {
  const row = document.createElement('div');
  row.className = 'batch-launcher-row';
  const labelWrap = document.createElement('div');
  labelWrap.className = 'batch-launcher-label';
  const labelIcon = document.createElement('span');
  labelIcon.className = 'material-symbols-outlined';
  labelIcon.textContent = icon;
  const labelText = document.createElement('span');
  labelText.textContent = label;
  labelWrap.appendChild(labelIcon);
  labelWrap.appendChild(labelText);
  row.appendChild(labelWrap);
  return row;
}

function _delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

registry.showBatchLauncher = showBatchLauncher;
registry.hideBatchLauncher = hideBatchLauncher;
registry.launchTemplate = launchTemplate;
registry.extractTemplateVariables = extractTemplateVariables;
