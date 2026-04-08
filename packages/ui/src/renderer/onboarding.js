// =============================================================================
// Agent Desk — First-Run Onboarding
// =============================================================================
// Welcome overlay shown on first launch. Steps through welcome, key features,
// and quick start. Persists `onboardingComplete` in config.
// =============================================================================

'use strict';

import { registry } from './state.js';

// ---------------------------------------------------------------------------
// Feature data for the carousel
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: 'terminal',
    title: 'Terminals',
    description: 'Create and manage multiple terminal sessions with splits and tabs',
  },
  {
    icon: 'hub',
    title: 'Agent Monitor',
    description: 'See all your agents at a glance — status, tasks, activity',
    shortcut: 'Ctrl+5',
  },
  {
    icon: 'rocket_launch',
    title: 'Batch Launch',
    description: 'Launch multiple agents at once with templates',
    shortcut: 'Ctrl+Shift+B',
  },
  {
    icon: 'dashboard',
    title: 'Dashboards',
    description: 'Agent communication, tasks, and knowledge integrated',
  },
  {
    icon: 'search',
    title: 'Search',
    description: 'Search across all terminals simultaneously',
    shortcut: 'Ctrl+Shift+F',
  },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _currentStep = 0; // 0=welcome, 1=features, 2=mcp-config, 3=quickstart
let _featureIndex = 0;
let _overlay = null;

// ---------------------------------------------------------------------------
// Config helpers (read/write onboarding fields on config root)
// ---------------------------------------------------------------------------

async function readConfig() {
  try {
    return (await agentDesk.config.read()) || {};
  } catch {
    return {};
  }
}

async function mergeConfig(patch) {
  try {
    const cfg = await readConfig();
    Object.assign(cfg, patch);
    await agentDesk.config.write(cfg);
  } catch {
    /* best-effort */
  }
}

// ---------------------------------------------------------------------------
// DOM Builders
// ---------------------------------------------------------------------------

function buildOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';

  const card = document.createElement('div');
  card.className = 'onboarding-card';

  // Step container
  const stepContainer = document.createElement('div');
  stepContainer.className = 'onboarding-step-container';
  card.appendChild(stepContainer);

  // Dot indicators
  const dots = document.createElement('div');
  dots.className = 'onboarding-dots';
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement('span');
    dot.className = 'onboarding-dot' + (i === 0 ? ' active' : '');
    dot.dataset.step = String(i);
    dots.appendChild(dot);
  }
  card.appendChild(dots);

  overlay.appendChild(card);
  return overlay;
}

function renderStep(container, step) {
  container.innerHTML = '';
  if (step === 0) renderWelcome(container);
  else if (step === 1) renderFeatures(container);
  else if (step === 2) renderMcpConfig(container);
  else renderQuickStart(container);

  const dots = container.parentElement.querySelectorAll('.onboarding-dot');
  dots.forEach((d, i) => d.classList.toggle('active', i === step));
}

function renderWelcome(container) {
  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined onboarding-hero-icon';
  icon.textContent = 'terminal';
  container.appendChild(icon);

  const h1 = document.createElement('h1');
  h1.className = 'onboarding-title';
  h1.textContent = 'Welcome to Agent Desk';
  container.appendChild(h1);

  const sub = document.createElement('p');
  sub.className = 'onboarding-subtitle';
  sub.textContent = 'Your control center for AI coding agents';
  container.appendChild(sub);

  const desc = document.createElement('p');
  desc.className = 'onboarding-desc';
  desc.textContent = 'Manage terminals, monitor agents, and coordinate workflows — all from a single desktop app.';
  container.appendChild(desc);

  const btn = document.createElement('button');
  btn.className = 'onboarding-btn onboarding-btn-primary';
  btn.textContent = 'Get Started';
  btn.addEventListener('click', () => goToStep(1));
  container.appendChild(btn);
}

function renderFeatures(container) {
  const f = FEATURES[_featureIndex];

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined onboarding-feature-icon';
  icon.textContent = f.icon;
  container.appendChild(icon);

  const title = document.createElement('h2');
  title.className = 'onboarding-feature-title';
  title.textContent = f.title;
  container.appendChild(title);

  const desc = document.createElement('p');
  desc.className = 'onboarding-feature-desc';
  desc.textContent = f.description;
  container.appendChild(desc);

  if (f.shortcut) {
    const kbd = document.createElement('span');
    kbd.className = 'onboarding-kbd';
    kbd.textContent = f.shortcut;
    container.appendChild(kbd);
  }

  // Feature dots (mini)
  const featureDots = document.createElement('div');
  featureDots.className = 'onboarding-feature-dots';
  for (let i = 0; i < FEATURES.length; i++) {
    const dot = document.createElement('span');
    dot.className = 'onboarding-feature-dot' + (i === _featureIndex ? ' active' : '');
    featureDots.appendChild(dot);
  }
  container.appendChild(featureDots);

  // Nav row
  const nav = document.createElement('div');
  nav.className = 'onboarding-nav-row';

  if (_featureIndex > 0) {
    const prev = document.createElement('button');
    prev.className = 'onboarding-btn onboarding-btn-secondary';
    prev.textContent = 'Back';
    prev.addEventListener('click', () => {
      _featureIndex--;
      renderStep(container.parentElement.querySelector('.onboarding-step-container'), 1);
    });
    nav.appendChild(prev);
  } else {
    nav.appendChild(document.createElement('span')); // spacer
  }

  if (_featureIndex < FEATURES.length - 1) {
    const next = document.createElement('button');
    next.className = 'onboarding-btn onboarding-btn-primary';
    next.textContent = 'Next';
    next.addEventListener('click', () => {
      _featureIndex++;
      renderStep(container.parentElement.querySelector('.onboarding-step-container'), 1);
    });
    nav.appendChild(next);
  } else {
    const next = document.createElement('button');
    next.className = 'onboarding-btn onboarding-btn-primary';
    next.textContent = 'Continue';
    next.addEventListener('click', () => goToStep(2));
    nav.appendChild(next);
  }

  container.appendChild(nav);
}

async function renderMcpConfig(container) {
  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined onboarding-hero-icon';
  icon.textContent = 'widgets';
  container.appendChild(icon);

  const h2 = document.createElement('h2');
  h2.className = 'onboarding-title';
  h2.textContent = 'Configure MCP Servers';
  container.appendChild(h2);

  const desc = document.createElement('p');
  desc.className = 'onboarding-desc';
  desc.textContent = 'Agent Desk bundles 4 MCP servers. Configure them for your installed AI coding tools?';
  container.appendChild(desc);

  // Loading state
  const listEl = document.createElement('div');
  listEl.className = 'onboarding-mcp-list';
  listEl.innerHTML = '<p style="color:var(--text-secondary);font-size:13px">Detecting installed tools...</p>';
  container.appendChild(listEl);

  // Detect tools
  let tools = [];
  try {
    tools = await agentDesk.mcp.detectTools();
  } catch {
    tools = [];
  }

  if (tools.length === 0) {
    listEl.innerHTML =
      '<p style="color:var(--text-secondary);font-size:13px">No supported tools detected. You can configure later in Settings.</p>';
  } else {
    listEl.innerHTML = '';
    tools.forEach((t) => {
      const row = document.createElement('label');
      row.className = 'onboarding-mcp-tool';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !t.configured;
      cb.disabled = t.configured;
      cb.dataset.tool = t.name;

      const text = document.createElement('span');
      text.textContent = t.label + (t.configured ? ' (already configured)' : '');

      row.appendChild(cb);
      row.appendChild(text);
      listEl.appendChild(row);
    });
  }

  // Results area
  const resultsEl = document.createElement('div');
  resultsEl.className = 'onboarding-mcp-results';
  container.appendChild(resultsEl);

  // Buttons
  const nav = document.createElement('div');
  nav.className = 'onboarding-nav-row';

  const skip = document.createElement('button');
  skip.className = 'onboarding-btn onboarding-btn-secondary';
  skip.textContent = 'Skip';
  skip.addEventListener('click', () => goToStep(3));
  nav.appendChild(skip);

  const configure = document.createElement('button');
  configure.className = 'onboarding-btn onboarding-btn-primary';
  configure.textContent = 'Configure Selected';
  configure.addEventListener('click', async () => {
    configure.disabled = true;
    configure.textContent = 'Configuring...';
    try {
      const results = await agentDesk.mcp.autoConfigure();
      resultsEl.innerHTML = '';
      results.forEach((r) => {
        const line = document.createElement('div');
        line.style.cssText = 'font-size:12px;padding:2px 0;color:var(--text-secondary)';
        const statusIcon =
          r.status === 'configured' ? 'check_circle' : r.status === 'skipped' ? 'remove_circle' : 'error';
        const color =
          r.status === 'configured' ? '#4caf50' : r.status === 'error' ? '#f44336' : 'var(--text-secondary)';
        line.innerHTML =
          '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;color:' +
          color +
          '">' +
          statusIcon +
          '</span> ' +
          r.label +
          ': ' +
          (r.status === 'configured' ? 'Done' : r.message || r.status);
        resultsEl.appendChild(line);
      });
      configure.textContent = 'Done!';
      setTimeout(() => goToStep(3), 2000);
    } catch (err) {
      configure.disabled = false;
      configure.textContent = 'Configure Selected';
      resultsEl.innerHTML = '<p style="color:#f44336;font-size:12px">Error: ' + err.message + '</p>';
    }
  });
  if (tools.length > 0) nav.appendChild(configure);

  container.appendChild(nav);
}

function renderQuickStart(container) {
  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined onboarding-hero-icon';
  icon.textContent = 'rocket_launch';
  container.appendChild(icon);

  const h2 = document.createElement('h2');
  h2.className = 'onboarding-title';
  h2.textContent = 'Ready to Go!';
  container.appendChild(h2);

  const launchBtn = document.createElement('button');
  launchBtn.className = 'onboarding-btn onboarding-btn-primary';
  launchBtn.textContent = 'Launch your first agent';
  launchBtn.addEventListener('click', () => {
    completeOnboarding(true);
  });
  container.appendChild(launchBtn);

  const explore = document.createElement('button');
  explore.className = 'onboarding-btn onboarding-btn-link';
  explore.textContent = 'Or explore on your own';
  explore.addEventListener('click', () => {
    completeOnboarding(false);
  });
  container.appendChild(explore);

  // Checkbox
  const label = document.createElement('label');
  label.className = 'onboarding-checkbox-label';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = true;
  cb.className = 'onboarding-checkbox';
  cb.id = 'onboarding-dont-show';
  label.appendChild(cb);

  const labelText = document.createElement('span');
  labelText.textContent = "Don't show again";
  label.appendChild(labelText);

  container.appendChild(label);
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function goToStep(step) {
  _currentStep = step;
  if (_overlay) {
    const sc = _overlay.querySelector('.onboarding-step-container');
    if (sc) renderStep(sc, step);
  }
}

async function completeOnboarding(launchAgent) {
  const dontShow = document.getElementById('onboarding-dont-show');
  const shouldRemember = dontShow ? dontShow.checked : true;

  if (shouldRemember) {
    await mergeConfig({ onboardingComplete: true });
  }

  if (_overlay) {
    _overlay.classList.remove('visible');
    setTimeout(() => {
      if (_overlay && _overlay.parentNode) _overlay.remove();
      _overlay = null;
    }, 250);
  }

  if (launchAgent && registry.createTerminal) {
    const profiles = typeof getProfiles === 'function' ? getProfiles() : [];
    const shellIds = new Set(['default-shell']);
    const agentProfile = profiles.find((p) => !shellIds.has(p.id) && p.command && p.command !== '');
    if (agentProfile) {
      registry.createTerminalFromProfile(agentProfile);
    } else {
      registry.createTerminal();
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initOnboarding() {
  // Use localStorage for onboarding state — immune to config write races
  if (localStorage.getItem('agent-desk-onboarding-complete') === 'true') return;

  const cfg = await readConfig();
  if (cfg.onboardingComplete) {
    localStorage.setItem('agent-desk-onboarding-complete', 'true');
    return;
  }

  // Track first launch date
  if (!cfg.firstLaunchDate) {
    await mergeConfig({ firstLaunchDate: Date.now() });
  }

  // Mark as complete immediately — immune to config race conditions
  localStorage.setItem('agent-desk-onboarding-complete', 'true');
  await mergeConfig({ onboardingComplete: true });

  _currentStep = 0;
  _featureIndex = 0;
  _overlay = buildOverlay();
  document.body.appendChild(_overlay);

  const sc = _overlay.querySelector('.onboarding-step-container');
  renderStep(sc, 0);

  requestAnimationFrame(() => _overlay.classList.add('visible'));
}

registry.initOnboarding = initOnboarding;
