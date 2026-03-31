// =============================================================================
// Agent Desk — Agent Templates / Recipes
// =============================================================================
// CRUD for reusable agent launch templates, settings section rendering,
// and command palette integration.
// =============================================================================

'use strict';

import { registry } from './state.js';

const TEMPLATES_STORAGE_KEY = 'agent-desk-templates';

// ---------------------------------------------------------------------------
// Default templates
// ---------------------------------------------------------------------------

const DEFAULT_TEMPLATES = [
  {
    id: 'quick-review',
    name: 'Quick Review',
    icon: 'rate_review',
    description: '3 agents for architecture, security, and code quality review',
    builtin: true,
    agents: [
      { name: 'arch-review', profile: 'claude', command: 'claude', initialInput: '' },
      { name: 'security-review', profile: 'claude', command: 'claude', initialInput: '' },
      { name: 'quality-review', profile: 'claude', command: 'claude', initialInput: '' },
    ],
  },
  {
    id: 'parallel-tasks',
    name: 'Parallel Tasks',
    icon: 'dynamic_feed',
    description: '5 agents with generic names for parallel work',
    builtin: true,
    agents: [
      { name: 'task-1', profile: 'claude', command: 'claude', initialInput: '' },
      { name: 'task-2', profile: 'claude', command: 'claude', initialInput: '' },
      { name: 'task-3', profile: 'claude', command: 'claude', initialInput: '' },
      { name: 'task-4', profile: 'claude', command: 'claude', initialInput: '' },
      { name: 'task-5', profile: 'claude', command: 'claude', initialInput: '' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Template persistence
// ---------------------------------------------------------------------------

function loadTemplates() {
  let configTemplates = null;
  try {
    if (typeof agentDesk !== 'undefined' && agentDesk.config) {
      const cached = window.__agentDeskConfigCache;
      if (cached && Array.isArray(cached.templates) && cached.templates.length > 0) {
        configTemplates = cached.templates;
      }
    }
  } catch {
    /* empty */
  }

  if (configTemplates) {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(configTemplates));
    return configTemplates;
  }

  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* empty */
  }

  return DEFAULT_TEMPLATES.map((t) => ({ ...t, agents: t.agents.map((a) => ({ ...a })) }));
}

function saveTemplates(templates) {
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  _syncTemplatesToConfig(templates);
  window.dispatchEvent(new CustomEvent('templates-changed', { detail: templates }));
}

async function _syncTemplatesToConfig(templates) {
  try {
    if (typeof agentDesk !== 'undefined' && agentDesk.config) {
      const config = await agentDesk.config.read();
      if (config) {
        config.templates = templates;
        await agentDesk.config.write(config);
      }
    }
  } catch {
    /* empty */
  }
}

// ---------------------------------------------------------------------------
// Template CRUD
// ---------------------------------------------------------------------------

function createTemplate(data) {
  const templates = loadTemplates();
  const template = {
    id: 'tpl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    name: data.name || 'New Template',
    icon: data.icon || 'smart_toy',
    description: data.description || '',
    builtin: false,
    agents: data.agents || [],
    staggerDelay: data.staggerDelay != null ? data.staggerDelay : 1000,
  };
  templates.push(template);
  saveTemplates(templates);
  return template;
}

function updateTemplate(id, data) {
  const templates = loadTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  templates[idx] = { ...templates[idx], ...data, id };
  saveTemplates(templates);
  return templates[idx];
}

function deleteTemplate(id) {
  const templates = loadTemplates().filter((t) => t.id !== id);
  saveTemplates(templates);
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export function getTemplateCommands() {
  const templates = loadTemplates();
  return templates.map((tpl) => ({
    id: 'template-' + tpl.id,
    label: `Launch Template: ${tpl.name}`,
    icon: tpl.icon || 'smart_toy',
    action: () => registry.launchTemplate(tpl),
  }));
}

// ---------------------------------------------------------------------------
// Save-from-batch dialog
// ---------------------------------------------------------------------------

export function showTemplateSaveDialog(batchConfig) {
  if (document.querySelector('.template-save-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'template-save-overlay';

  const modal = document.createElement('div');
  modal.className = 'template-save-modal';

  const header = document.createElement('h3');
  header.className = 'template-save-header';
  header.textContent = 'Save as Template';
  modal.appendChild(header);

  const nameRow = _makeField('Template Name');
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'template-field-input';
  nameInput.value = '';
  nameInput.placeholder = 'My Agents';
  nameRow.appendChild(nameInput);
  modal.appendChild(nameRow);

  const descRow = _makeField('Description');
  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.className = 'template-field-input';
  descInput.value = '';
  descInput.placeholder = 'Optional description';
  descRow.appendChild(descInput);
  modal.appendChild(descRow);

  const actions = document.createElement('div');
  actions.className = 'template-save-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'batch-launcher-btn batch-launcher-btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => _closeOverlay());

  const saveBtn = document.createElement('button');
  saveBtn.className = 'batch-launcher-btn batch-launcher-btn-primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const agents = [];
    const count = batchConfig.count || 3;
    const pattern = batchConfig.namingPattern || 'agent-{n}';
    for (let i = 0; i < count; i++) {
      agents.push({
        name: pattern.replace(/\{n\}/g, String(i + 1)),
        profile: batchConfig.profileId || 'default-shell',
        command: batchConfig.initialCommand ? '' : '',
        initialInput: batchConfig.initialCommand || '',
        cwd: batchConfig.cwd || '',
      });
    }
    createTemplate({
      name: nameInput.value || 'Untitled Template',
      description: descInput.value || '',
      agents,
      staggerDelay: batchConfig.staggerDelay,
    });
    registry.showToast('Template saved');
    _closeOverlay();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  modal.appendChild(actions);
  overlay.appendChild(modal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) _closeOverlay();
  });

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      _closeOverlay();
    }
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    nameInput.focus();
  });

  function _closeOverlay() {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 150);
  }
}

// ---------------------------------------------------------------------------
// Settings section: Templates
// ---------------------------------------------------------------------------

export function renderTemplatesSection(sec) {
  const templates = loadTemplates();

  const list = document.createElement('div');
  list.className = 'template-list';

  function refresh() {
    sec.querySelectorAll('.template-list, .template-form, .template-btn-add').forEach((el) => el.remove());
    renderTemplatesSection(sec);
  }

  for (const tpl of templates) {
    const row = document.createElement('div');
    row.className = 'template-row';

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined template-icon';
    icon.textContent = tpl.icon || 'smart_toy';
    row.appendChild(icon);

    const info = document.createElement('div');
    info.className = 'template-info';
    const nameEl = document.createElement('span');
    nameEl.className = 'template-name';
    nameEl.textContent = tpl.name;
    info.appendChild(nameEl);
    const descEl = document.createElement('span');
    descEl.className = 'template-desc';
    descEl.textContent = tpl.description || `${tpl.agents.length} agent(s)`;
    info.appendChild(descEl);
    row.appendChild(info);

    const badge = document.createElement('span');
    badge.className = 'template-badge';
    badge.textContent = `${tpl.agents.length}`;
    row.appendChild(badge);

    const actions = document.createElement('div');
    actions.className = 'template-actions';

    const launchBtn = document.createElement('button');
    launchBtn.className = 'profile-action-btn profile-launch-btn';
    launchBtn.title = 'Launch template';
    launchBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
    launchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      registry.launchTemplate(tpl);
    });
    actions.appendChild(launchBtn);

    const editBtn = document.createElement('button');
    editBtn.className = 'profile-action-btn';
    editBtn.title = 'Edit';
    editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      list.style.display = 'none';
      _renderTemplateForm(
        sec,
        tpl,
        (updated) => {
          updateTemplate(tpl.id, updated);
          refresh();
        },
        refresh,
      );
    });
    actions.appendChild(editBtn);

    if (!tpl.builtin) {
      const delBtn = document.createElement('button');
      delBtn.className = 'profile-action-btn danger';
      delBtn.title = 'Delete';
      delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTemplate(tpl.id);
        refresh();
      });
      actions.appendChild(delBtn);
    }

    row.appendChild(actions);
    row.addEventListener('click', () => registry.launchTemplate(tpl));
    row.style.cursor = 'pointer';
    list.appendChild(row);
  }

  sec.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.className = 'template-btn-add';
  addBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">add</span> Create Template';
  addBtn.addEventListener('click', () => {
    list.style.display = 'none';
    addBtn.style.display = 'none';
    _renderTemplateForm(
      sec,
      null,
      (data) => {
        createTemplate(data);
        refresh();
      },
      refresh,
    );
  });
  sec.appendChild(addBtn);
}

// ---------------------------------------------------------------------------
// Template edit form
// ---------------------------------------------------------------------------

const TEMPLATE_ICON_OPTIONS = [
  'smart_toy',
  'rate_review',
  'dynamic_feed',
  'groups',
  'terminal',
  'code',
  'bug_report',
  'build',
  'science',
  'psychology',
  'hub',
  'cloud',
  'security',
  'speed',
  'rocket_launch',
];

function _renderTemplateForm(sec, existing, onSave, onCancel) {
  const form = document.createElement('div');
  form.className = 'template-form';

  const nameRow = _makeField('Name');
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'template-field-input';
  nameInput.value = existing ? existing.name : '';
  nameInput.placeholder = 'Template name';
  nameRow.appendChild(nameInput);
  form.appendChild(nameRow);

  const iconRow = _makeField('Icon');
  const iconSelect = document.createElement('select');
  iconSelect.className = 'template-field-select';
  for (const ic of TEMPLATE_ICON_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = ic;
    opt.textContent = ic;
    if (existing && existing.icon === ic) opt.selected = true;
    iconSelect.appendChild(opt);
  }
  iconRow.appendChild(iconSelect);
  form.appendChild(iconRow);

  const descRow = _makeField('Description');
  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.className = 'template-field-input';
  descInput.value = existing ? existing.description : '';
  descInput.placeholder = 'Optional description';
  descRow.appendChild(descInput);
  form.appendChild(descRow);

  const agentsHeader = document.createElement('div');
  agentsHeader.className = 'template-agents-header';
  agentsHeader.innerHTML =
    '<span class="material-symbols-outlined" style="font-size:16px;color:var(--accent)">groups</span> Agents';
  form.appendChild(agentsHeader);

  const agentsList = document.createElement('div');
  agentsList.className = 'template-agents-list';

  const agents = existing ? existing.agents.map((a) => ({ ...a })) : [];
  const profiles = typeof getProfiles === 'function' ? getProfiles() : [];

  function renderAgents() {
    agentsList.innerHTML = '';
    agents.forEach((agent, idx) => {
      const agentRow = document.createElement('div');
      agentRow.className = 'template-agent-row';

      const nameIn = document.createElement('input');
      nameIn.type = 'text';
      nameIn.className = 'template-agent-input';
      nameIn.value = agent.name || '';
      nameIn.placeholder = 'Agent name';
      nameIn.addEventListener('input', () => {
        agents[idx].name = nameIn.value;
      });

      const profileSel = document.createElement('select');
      profileSel.className = 'template-agent-select';
      for (const p of profiles) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (agent.profile === p.id) opt.selected = true;
        profileSel.appendChild(opt);
      }
      profileSel.addEventListener('change', () => {
        agents[idx].profile = profileSel.value;
      });

      const inputIn = document.createElement('input');
      inputIn.type = 'text';
      inputIn.className = 'template-agent-input';
      inputIn.value = agent.initialInput || '';
      inputIn.placeholder = 'Initial input — use {{var}} for variables';
      inputIn.addEventListener('input', () => {
        agents[idx].initialInput = inputIn.value;
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'template-agent-remove';
      removeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
      removeBtn.addEventListener('click', () => {
        agents.splice(idx, 1);
        renderAgents();
      });

      agentRow.appendChild(nameIn);
      agentRow.appendChild(profileSel);
      agentRow.appendChild(inputIn);
      agentRow.appendChild(removeBtn);
      agentsList.appendChild(agentRow);
    });
  }

  renderAgents();
  form.appendChild(agentsList);

  const addAgentBtn = document.createElement('button');
  addAgentBtn.className = 'template-btn-add-agent';
  addAgentBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">add</span> Add Agent';
  addAgentBtn.addEventListener('click', () => {
    agents.push({ name: `agent-${agents.length + 1}`, profile: 'claude', command: 'claude', initialInput: '' });
    renderAgents();
  });
  form.appendChild(addAgentBtn);

  const formActions = document.createElement('div');
  formActions.className = 'template-form-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'batch-launcher-btn batch-launcher-btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    form.remove();
    onCancel();
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'batch-launcher-btn batch-launcher-btn-primary';
  saveBtn.textContent = existing ? 'Update' : 'Create';
  saveBtn.addEventListener('click', () => {
    onSave({
      name: nameInput.value || 'Untitled',
      icon: iconSelect.value,
      description: descInput.value,
      agents: agents,
    });
    form.remove();
  });

  formActions.appendChild(cancelBtn);
  formActions.appendChild(saveBtn);
  form.appendChild(formActions);

  sec.appendChild(form);
  nameInput.focus();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _makeField(label) {
  const row = document.createElement('div');
  row.className = 'template-field-row';
  const lbl = document.createElement('label');
  lbl.className = 'template-field-label';
  lbl.textContent = label;
  row.appendChild(lbl);
  return row;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

registry.showTemplateSaveDialog = showTemplateSaveDialog;
registry.getTemplateCommands = getTemplateCommands;
registry.renderTemplatesSection = renderTemplatesSection;
window.renderTemplatesSection = renderTemplatesSection;

// ---------------------------------------------------------------------------
// Init: cache config for template loading
// ---------------------------------------------------------------------------

(async function _initTemplateConfig() {
  try {
    if (typeof agentDesk !== 'undefined' && agentDesk.config) {
      const config = await agentDesk.config.read();
      window.__agentDeskConfigCache = config;
    }
  } catch {
    /* empty */
  }
})();
