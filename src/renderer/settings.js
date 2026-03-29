// settings.js — Settings panel module for agent-desk
// Renders into #settings-panel, persists to ~/.agent-desk/config.json + localStorage cache

const STORAGE_KEY = 'agent-desk-settings';
const PROFILES_STORAGE_KEY = 'agent-desk-profiles';

// Config file state — loaded once at startup, kept in sync
let _configData = null;
let _configReady = false;
let _cleanupConfigWatch = null;

const DEFAULT_PROFILES = [
  { id: 'default-shell', name: 'Default Shell', command: '', args: [], cwd: '', icon: 'terminal', builtin: true },
  { id: 'claude', name: 'Claude', command: 'claude', args: [], cwd: '', icon: 'smart_toy', builtin: true },
  { id: 'opencode', name: 'OpenCode', command: 'opencode', args: [], cwd: '', icon: 'code', builtin: true },
];

const PROFILE_ICON_OPTIONS = [
  'terminal',
  'smart_toy',
  'code',
  'data_object',
  'memory',
  'bug_report',
  'build',
  'science',
  'psychology',
  'hub',
  'dns',
  'storage',
  'cloud',
  'settings',
  'folder',
  'language',
  'developer_mode',
  'speed',
  'analytics',
];

const DEFAULTS = {
  // Terminal
  defaultShell: 'PowerShell',
  defaultTerminalCwd: '',
  fontSize: 14,
  fontFamily: 'JetBrains Mono',
  cursorStyle: 'bar',
  cursorBlink: true,
  scrollback: 10000,
  lineHeight: 1.3,
  // Dashboard URLs
  agentCommUrl: 'http://localhost:3421',
  agentTasksUrl: 'http://localhost:3422',
  agentKnowledgeUrl: 'http://localhost:3423',
  // Appearance
  sidebarPosition: 'left',
  showStatusBar: true,
  tabCloseButton: 'hover',
  // Behavior
  closeToTray: true,
  startOnLogin: false,
  newTerminalOnStartup: true,
  defaultNewTerminalCommand: '',
  // Notifications
  bellSound: false,
  bellVisual: true,
  desktopNotifications: true,
  // Theme
  theme: 'dark',
  preferredDarkTheme: 'default-dark',
  preferredLightTheme: 'default-light',
  followSystemTheme: false,
};

let _settings = null;

// ── Config file helpers ──────────────────────────────────────────────

async function _initConfig() {
  if (_configReady) return;
  try {
    _configData = await agentDesk.config.read();
    if (!_configData || !_configData.version) {
      // First run or empty config — migrate from localStorage
      _configData = _buildConfigFromLocalStorage();
      await agentDesk.config.write(_configData);
    }
  } catch {
    _configData = null;
  }
  _configReady = true;

  // Watch for external config changes
  if (!_cleanupConfigWatch && agentDesk.config.onChange) {
    _cleanupConfigWatch = agentDesk.config.onChange((data) => {
      _configData = data;
      // Reload settings from new config
      if (_configData && _configData.settings) {
        _settings = { ...DEFAULTS, ..._configData.settings };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
        window.dispatchEvent(new CustomEvent('settings-changed', { detail: _settings }));
      }
    });
  }
}

function _buildConfigFromLocalStorage() {
  let settings = {};
  let profiles = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) settings = JSON.parse(raw);
  } catch {
    /* empty */
  }
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (raw) profiles = JSON.parse(raw);
  } catch {
    /* empty */
  }
  return {
    version: 1,
    settings,
    profiles,
    workspaces: {},
  };
}

function _syncConfigToFile() {
  if (!_configData) _configData = { version: 1, settings: {}, profiles: [], workspaces: {} };
  _configData.settings = { ..._settings };
  try {
    const profiles = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (profiles) _configData.profiles = JSON.parse(profiles);
  } catch {
    /* empty */
  }
  agentDesk.config.write(_configData).catch(() => {});
}

function load() {
  // Try config file first (sync from cached _configData)
  if (_configData && _configData.settings && Object.keys(_configData.settings).length > 0) {
    _settings = { ...DEFAULTS, ..._configData.settings };
    // Write-through to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
    return _settings;
  }
  // Fall back to localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _settings = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    _settings = { ...DEFAULTS };
  }
  return _settings;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
  _syncConfigToFile();
  window.dispatchEvent(new CustomEvent('settings-changed', { detail: _settings }));
}

function field(key, value) {
  _settings[key] = value;
  save();
}

// ── Schema for the form ──────────────────────────────────────────────

const SECTIONS = [
  {
    title: 'Terminal',
    icon: 'terminal',
    fields: [
      { key: 'defaultTerminalCwd', label: 'Default Terminal Path', type: 'directory', placeholder: 'C:\\Projects' },
      { key: 'fontSize', label: 'Font Size', type: 'number', min: 10, max: 24, step: 1 },
      { key: 'fontFamily', label: 'Font Family', type: 'text' },
      { key: 'cursorStyle', label: 'Cursor Style', type: 'select', options: ['bar', 'block', 'underline'] },
      { key: 'cursorBlink', label: 'Cursor Blink', type: 'checkbox' },
      { key: 'scrollback', label: 'Scrollback Lines', type: 'number', min: 1000, max: 100000, step: 1000 },
      { key: 'lineHeight', label: 'Line Height', type: 'number', min: 1.0, max: 2.0, step: 0.1 },
    ],
  },
  {
    title: 'Dashboard URLs',
    icon: 'language',
    fields: [
      { key: 'agentCommUrl', label: 'Agent Comm URL', type: 'text' },
      { key: 'agentTasksUrl', label: 'Agent Tasks URL', type: 'text' },
      { key: 'agentKnowledgeUrl', label: 'Agent Knowledge URL', type: 'text' },
    ],
  },
  {
    title: 'Appearance',
    icon: 'palette',
    fields: [
      { key: 'sidebarPosition', label: 'Sidebar Position', type: 'select', options: ['left', 'right'] },
      { key: 'showStatusBar', label: 'Show Status Bar', type: 'checkbox' },
      { key: 'tabCloseButton', label: 'Tab Close Button', type: 'select', options: ['always', 'hover', 'never'] },
    ],
  },
  {
    title: 'Themes',
    icon: 'palette',
    custom: true,
  },
  {
    title: 'Profiles',
    icon: 'account_circle',
    custom: true,
  },
  {
    title: 'Notifications',
    icon: 'notifications',
    fields: [
      { key: 'bellVisual', label: 'Visual Bell (flash tab)', type: 'checkbox' },
      { key: 'bellSound', label: 'Bell Sound (system beep)', type: 'checkbox' },
      { key: 'desktopNotifications', label: 'Desktop Notifications', type: 'checkbox' },
    ],
  },
  {
    title: 'Behavior',
    icon: 'tune',
    fields: [
      { key: 'closeToTray', label: 'Close to Tray', type: 'checkbox' },
      { key: 'startOnLogin', label: 'Start on Login', type: 'checkbox' },
      { key: 'newTerminalOnStartup', label: 'New Terminal on Startup', type: 'checkbox' },
      { key: 'defaultNewTerminalCommand', label: 'Default New Terminal Command', type: 'text' },
    ],
  },
  {
    title: 'Templates',
    icon: 'rocket_launch',
    custom: true,
  },
  {
    title: 'Workspaces',
    icon: 'workspaces',
    custom: true,
  },
  {
    title: 'Keyboard Shortcuts',
    icon: 'keyboard',
    custom: true,
  },
];

// ── Style (injected once) ────────────────────────────────────────────

const STYLE = `
.settings-root {
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 32px 48px 64px;
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--text, #e0e0e0);
  overflow-y: auto;
  height: 100%;
  box-sizing: border-box;
}

.settings-heading {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 28px;
  color: var(--text, #e0e0e0);
}

.settings-section {
  border-bottom: 1px solid var(--border, #2c2c2c);
  padding-bottom: 20px;
  margin-bottom: 24px;
  width: 100%;
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.settings-section-header .material-symbols-outlined {
  font-size: 20px;
  color: var(--accent, #5d8da8);
}

.settings-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text, #e0e0e0);
  letter-spacing: 0.3px;
}

.settings-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
}

.settings-field + .settings-field {
  border-top: 1px solid var(--border, rgba(255,255,255,0.04));
}

.settings-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted, #888);
  flex-shrink: 0;
  width: 200px;
  min-width: 200px;
}

.settings-input,
.settings-select {
  background: var(--surface, #1e1e1e);
  border: 1px solid var(--border, #2c2c2c);
  color: var(--text, #e0e0e0);
  padding: 8px 12px;
  border-radius: var(--radius, 6px);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  min-width: 200px;
  max-width: none;
  flex: 1;
  transition: border-color 0.15s;
}

.settings-input:focus,
.settings-select:focus {
  border-color: var(--accent, #5d8da8);
}

.settings-input[type="number"] {
  max-width: none;
  min-width: 100px;
  flex: 1;
}

.settings-select {
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23888' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

.settings-checkbox-wrap {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.settings-checkbox-wrap input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.settings-toggle {
  position: absolute;
  inset: 0;
  background: var(--border, #2c2c2c);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.settings-toggle::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--text-muted, #888);
  transition: transform 0.2s, background 0.2s;
}

.settings-checkbox-wrap input:checked + .settings-toggle {
  background: var(--accent, #5d8da8);
}

.settings-checkbox-wrap input:checked + .settings-toggle::after {
  transform: translateX(20px);
  background: #fff;
}

.settings-reset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--border, #2c2c2c);
  color: var(--text-muted, #888);
  border-radius: var(--radius, 6px);
  font-size: 12px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: color 0.15s, border-color 0.15s;
}

.settings-reset:hover {
  color: var(--text, #e0e0e0);
  border-color: var(--text-muted, #888);
}

.profile-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius, 6px);
  transition: background 0.15s;
}

.profile-row:hover {
  background: var(--surface, #1e1e1e);
}

.profile-icon {
  font-size: 20px;
  color: var(--accent, #5d8da8);
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.profile-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text, #e0e0e0);
}

.profile-command {
  font-size: 11px;
  color: var(--text-muted, #888);
  font-family: 'JetBrains Mono', monospace;
}

.profile-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.profile-action-btn {
  background: transparent;
  border: none;
  color: var(--text-muted, #888);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color 0.15s, background 0.15s;
}

.profile-action-btn:hover {
  color: var(--text, #e0e0e0);
  background: var(--border, #2c2c2c);
}

.profile-action-btn.danger:hover {
  color: #d45050;
}

.profile-launch-btn {
  color: var(--status-running, #4caf50) !important;
}

.profile-launch-btn:hover {
  color: #4caf50 !important;
  background: rgba(76, 175, 80, 0.15);
}

.profile-action-btn .material-symbols-outlined {
  font-size: 18px;
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--surface, #1e1e1e);
  border: 1px solid var(--border, #2c2c2c);
  border-radius: var(--radius, 6px);
}

.profile-form-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile-form-row .settings-label {
  min-width: 130px;
}

.profile-form-row .settings-input,
.profile-form-row .settings-select {
  flex: 1;
}

.profile-form-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

.profile-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border, #2c2c2c);
  border-radius: var(--radius, 6px);
  font-size: 12px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  font-family: inherit;
}

.profile-btn-save {
  background: var(--accent, #5d8da8);
  color: #fff;
  border-color: var(--accent, #5d8da8);
}

.profile-btn-save:hover {
  filter: brightness(1.1);
}

.profile-btn-cancel {
  background: transparent;
  color: var(--text-muted, #888);
}

.profile-btn-cancel:hover {
  color: var(--text, #e0e0e0);
  border-color: var(--text-muted, #888);
}

.profile-btn-add {
  background: transparent;
  color: var(--text-muted, #888);
  margin-top: 8px;
}

.profile-btn-add:hover {
  color: var(--text, #e0e0e0);
  border-color: var(--text-muted, #888);
}

.profile-default-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  margin: 8px 0;
  border-top: 1px solid var(--border, #2c2c2c);
}

.profile-default-row .settings-label {
  min-width: 120px;
  flex-shrink: 0;
  color: var(--text-muted, #888);
  font-size: 13px;
}

.profile-default-row .settings-select {
  flex: 1;
  max-width: 300px;
}

.workspace-card {
  border: 1px solid var(--border, #2c2c2c);
  border-radius: var(--radius, 6px);
  padding: 12px !important;
  margin-bottom: 4px;
  transition: background 0.15s, border-color 0.15s;
}

.workspace-card:hover {
  background: var(--surface, #1e1e1e);
  border-color: var(--accent, #5d8da8);
}
`;

let _styleInjected = false;

function injectStyle() {
  if (_styleInjected) return;
  const el = document.createElement('style');
  el.textContent = STYLE;
  document.head.appendChild(el);
  _styleInjected = true;
}

// ── Render ────────────────────────────────────────────────────────────

function renderField(f, settings) {
  const row = document.createElement('div');
  row.className = 'settings-field';

  const label = document.createElement('label');
  label.className = 'settings-label';
  label.textContent = f.label;
  row.appendChild(label);

  if (f.type === 'checkbox') {
    const wrap = document.createElement('label');
    wrap.className = 'settings-checkbox-wrap';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = settings[f.key];
    input.addEventListener('change', () => field(f.key, input.checked));
    const toggle = document.createElement('span');
    toggle.className = 'settings-toggle';
    wrap.appendChild(input);
    wrap.appendChild(toggle);
    row.appendChild(wrap);
  } else if (f.type === 'select') {
    const select = document.createElement('select');
    select.className = 'settings-select';
    for (const opt of f.options) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (String(settings[f.key]) === opt) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener('change', () => field(f.key, select.value));
    row.appendChild(select);
  } else if (f.type === 'number') {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'settings-input';
    input.value = settings[f.key];
    if (f.min != null) input.min = f.min;
    if (f.max != null) input.max = f.max;
    if (f.step != null) input.step = f.step;
    input.addEventListener('change', () => {
      let v = parseFloat(input.value);
      if (f.min != null && v < f.min) v = f.min;
      if (f.max != null && v > f.max) v = f.max;
      input.value = v;
      field(f.key, v);
    });
    row.appendChild(input);
  } else if (f.type === 'directory') {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:8px;flex:1;min-width:0;';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'settings-input';
    input.style.flex = '1';
    input.value = settings[f.key] || '';
    input.placeholder = f.placeholder || '';
    input.addEventListener('change', () => field(f.key, input.value));
    wrap.appendChild(input);
    const browseBtn = document.createElement('button');
    browseBtn.className = 'settings-reset';
    browseBtn.style.cssText = 'margin:0;padding:6px 12px;white-space:nowrap;';
    browseBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">folder_open</span>';
    browseBtn.title = 'Browse...';
    browseBtn.addEventListener('click', async () => {
      const dir = await agentDesk.dialog.openDirectory({ defaultPath: input.value || undefined });
      if (dir) {
        input.value = dir;
        field(f.key, dir);
      }
    });
    wrap.appendChild(browseBtn);
    row.appendChild(wrap);
  } else {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'settings-input';
    input.value = settings[f.key];
    input.addEventListener('change', () => field(f.key, input.value));
    row.appendChild(input);
  }

  return row;
}

// ── Profile Management ───────────────────────────────────────────────

function loadProfiles() {
  // Try config file first
  if (_configData && Array.isArray(_configData.profiles) && _configData.profiles.length > 0) {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(_configData.profiles));
    return _configData.profiles;
  }
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_e) {
    /* ignore */
  }
  return DEFAULT_PROFILES.map((p) => ({ ...p }));
}

function saveProfiles(profiles) {
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  _syncConfigToFile();
  window.dispatchEvent(new CustomEvent('profiles-changed', { detail: profiles }));
}

// eslint-disable-next-line no-unused-vars
function getProfiles() {
  return loadProfiles();
}

function _parseArgs(str) {
  if (!str) return [];
  const args = [];
  let current = '';
  let inQuote = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

// -----------------------------------------------------------------------------
// Themes Section
// -----------------------------------------------------------------------------

function _buildThemeCard(theme, currentId, prefDarkId, prefLightId) {
  const card = document.createElement('div');
  const isActive = theme.id === currentId;
  const isPreferred =
    (theme.type === 'dark' && theme.id === prefDarkId) || (theme.type === 'light' && theme.id === prefLightId);
  card.className = 'theme-card' + (isActive ? ' active' : '') + (isPreferred && !isActive ? ' preferred' : '');

  const swatch = document.createElement('div');
  swatch.className = 'theme-swatch';
  swatch.style.background = theme.colors.background;
  swatch.style.borderColor = theme.colors.border;

  const colors = document.createElement('div');
  colors.className = 'theme-swatch-colors';
  const tc = theme.colors.terminal || {};
  ['red', 'green', 'blue', 'yellow', 'magenta', 'cyan'].forEach((c) => {
    const dot = document.createElement('span');
    dot.className = 'theme-color-dot';
    dot.style.background = tc[c] || '#888';
    colors.appendChild(dot);
  });
  swatch.appendChild(colors);

  const textPreview = document.createElement('div');
  textPreview.className = 'theme-swatch-text';
  textPreview.style.color = theme.colors.text;
  textPreview.textContent = 'Aa';
  swatch.appendChild(textPreview);

  const accentBar = document.createElement('div');
  accentBar.className = 'theme-swatch-accent';
  accentBar.style.background = theme.colors.accent || theme.colors.primary;
  swatch.appendChild(accentBar);

  const name = document.createElement('div');
  name.className = 'theme-card-name';
  name.textContent = theme.name;

  card.appendChild(swatch);
  card.appendChild(name);

  if (!theme.builtin) {
    const delBtn = document.createElement('button');
    delBtn.className = 'theme-card-delete';
    delBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">close</span>';
    delBtn.title = 'Delete theme';
    card.appendChild(delBtn);
  }

  return card;
}

function _renderThemesSection(sec, container) {
  const allThemes = typeof getAllThemes === 'function' ? getAllThemes() : [];
  const currentId = _settings.themeId || 'default-dark';
  const prefDarkId = _settings.preferredDarkTheme || 'default-dark';
  const prefLightId = _settings.preferredLightTheme || 'default-light';

  const darkThemes = allThemes.filter((t) => t.type === 'dark');
  const lightThemes = allThemes.filter((t) => t.type === 'light');

  // Dark Themes group
  const darkSubtitle = document.createElement('div');
  darkSubtitle.className = 'theme-group-subtitle';
  darkSubtitle.textContent = 'Dark Themes';
  sec.appendChild(darkSubtitle);

  const darkGrid = document.createElement('div');
  darkGrid.className = 'theme-grid';
  darkThemes.forEach((theme) => {
    const card = _buildThemeCard(theme, currentId, prefDarkId, prefLightId);
    card.addEventListener('click', () => {
      field('themeId', theme.id);
      field('theme', 'dark');
      field('preferredDarkTheme', theme.id);
      _renderThemesSection_refresh(sec, container);
    });
    const delBtn = card.querySelector('.theme-card-delete');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof deleteCustomTheme === 'function') deleteCustomTheme(theme.id);
        if (currentId === theme.id) {
          field('themeId', 'default-dark');
          field('theme', 'dark');
        }
        if (prefDarkId === theme.id) field('preferredDarkTheme', 'default-dark');
        initSettings(container);
      });
    }
    darkGrid.appendChild(card);
  });
  sec.appendChild(darkGrid);

  // Light Themes group
  const lightSubtitle = document.createElement('div');
  lightSubtitle.className = 'theme-group-subtitle';
  lightSubtitle.textContent = 'Light Themes';
  sec.appendChild(lightSubtitle);

  const lightGrid = document.createElement('div');
  lightGrid.className = 'theme-grid';
  lightThemes.forEach((theme) => {
    const card = _buildThemeCard(theme, currentId, prefDarkId, prefLightId);
    card.addEventListener('click', () => {
      field('themeId', theme.id);
      field('theme', 'light');
      field('preferredLightTheme', theme.id);
      _renderThemesSection_refresh(sec, container);
    });
    const delBtn = card.querySelector('.theme-card-delete');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof deleteCustomTheme === 'function') deleteCustomTheme(theme.id);
        if (currentId === theme.id) {
          field('themeId', 'default-light');
          field('theme', 'light');
        }
        if (prefLightId === theme.id) field('preferredLightTheme', 'default-light');
        initSettings(container);
      });
    }
    lightGrid.appendChild(card);
  });
  sec.appendChild(lightGrid);

  // Follow System Theme checkbox
  const sysRow = document.createElement('div');
  sysRow.className = 'settings-field theme-follow-system';
  const sysLabel = document.createElement('label');
  sysLabel.textContent = 'Follow System Theme';
  const sysCheck = document.createElement('input');
  sysCheck.type = 'checkbox';
  sysCheck.checked = _settings.followSystemTheme === true;
  sysCheck.addEventListener('change', () => {
    field('followSystemTheme', sysCheck.checked);
    window.dispatchEvent(new CustomEvent('follow-system-theme-changed', { detail: sysCheck.checked }));
  });
  sysRow.appendChild(sysLabel);
  sysRow.appendChild(sysCheck);
  sec.appendChild(sysRow);

  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:12px;color:var(--text-muted);margin:4px 0 12px;padding:0 4px';
  hint.textContent =
    'When enabled, the app auto-switches between your preferred light and dark themes based on the OS setting.';
  sec.appendChild(hint);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'theme-actions';

  const customizeBtn = document.createElement('button');
  customizeBtn.className = 'settings-btn';
  customizeBtn.innerHTML =
    '<span class="material-symbols-outlined" style="font-size:16px">edit</span> Customize Current';
  customizeBtn.addEventListener('click', () => {
    _showThemeEditor(sec, container, currentId);
  });

  const createBtn = document.createElement('button');
  createBtn.className = 'settings-btn theme-create-btn';
  createBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">add</span> Create New Theme';
  createBtn.addEventListener('click', () => {
    _showCreateThemeDialog(sec, container, currentId);
  });

  actions.appendChild(customizeBtn);
  actions.appendChild(createBtn);
  sec.appendChild(actions);
}

function _renderThemesSection_refresh(sec, container) {
  const header = sec.querySelector('.settings-section-header');
  while (sec.lastChild && sec.lastChild !== header) {
    sec.removeChild(sec.lastChild);
  }
  _renderThemesSection(sec, container);
}

function _showCreateThemeDialog(sec, container, baseThemeId) {
  const overlay = document.createElement('div');
  overlay.className = 'theme-import-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'theme-editor-dialog';
  dialog.style.maxWidth = '360px';
  dialog.innerHTML = '<h3>Create New Theme</h3>';

  const hint = document.createElement('p');
  hint.style.cssText = 'font-size:12px;color:var(--text-muted);margin:0 0 12px';
  hint.textContent = 'Enter a name for your new theme. It will be based on the currently active theme.';
  dialog.appendChild(hint);

  const nameRow = document.createElement('div');
  nameRow.className = 'theme-editor-field';
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Theme Name';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'My Custom Theme';
  nameInput.style.cssText =
    'flex:1;padding:6px 8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:13px';
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  dialog.appendChild(nameRow);

  const typeRow = document.createElement('div');
  typeRow.className = 'theme-editor-field';
  const typeLabel = document.createElement('label');
  typeLabel.textContent = 'Type';
  const typeToggle = document.createElement('div');
  typeToggle.style.cssText = 'display:flex;gap:4px;flex:1';
  const baseType = typeof getThemeById === 'function' ? getThemeById(baseThemeId)?.type || 'dark' : 'dark';
  let selectedType = baseType;
  for (const t of ['dark', 'light']) {
    const btn = document.createElement('button');
    btn.className = 'settings-btn' + (t === selectedType ? ' settings-btn-primary' : '');
    btn.textContent = t === 'dark' ? 'Dark' : 'Light';
    btn.style.cssText = 'flex:1;padding:6px 0;font-size:12px;text-transform:uppercase';
    btn.dataset.type = t;
    btn.addEventListener('click', () => {
      selectedType = t;
      typeToggle.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('settings-btn-primary', b.dataset.type === t);
      });
    });
    typeToggle.appendChild(btn);
  }
  typeRow.appendChild(typeLabel);
  typeRow.appendChild(typeToggle);
  dialog.appendChild(typeRow);

  const btnRow = document.createElement('div');
  btnRow.className = 'theme-import-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'settings-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => overlay.remove());

  const createBtnConfirm = document.createElement('button');
  createBtnConfirm.className = 'settings-btn settings-btn-primary';
  createBtnConfirm.textContent = 'Create & Customize';
  createBtnConfirm.addEventListener('click', () => {
    const themeName = nameInput.value.trim();
    if (!themeName) {
      nameInput.style.borderColor = '#d45050';
      nameInput.focus();
      return;
    }

    const baseTheme = typeof getThemeById === 'function' ? getThemeById(baseThemeId) : null;
    if (!baseTheme) return;

    const newId =
      'custom-' +
      themeName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now();
    const newTheme = {
      id: newId,
      name: themeName,
      type: selectedType,
      builtin: false,
      colors: JSON.parse(JSON.stringify(baseTheme.colors)),
    };

    if (typeof saveCustomTheme === 'function') saveCustomTheme(newTheme);
    field('themeId', newTheme.id);
    field('theme', newTheme.type);

    overlay.remove();

    // Re-render themes section then open editor for the new theme
    _renderThemesSection(sec, container);
    _showThemeEditor(sec, container, newTheme.id);
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(createBtnConfirm);
  dialog.appendChild(btnRow);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  nameInput.focus();
}

function _showThemeEditor(sec, container, baseThemeId) {
  const baseTheme = typeof getThemeById === 'function' ? getThemeById(baseThemeId) : null;
  if (!baseTheme) return;

  const overlay = document.createElement('div');
  overlay.className = 'theme-import-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'theme-editor-dialog';

  dialog.innerHTML = '<h3>Customize Theme</h3>';

  const nameRow = document.createElement('div');
  nameRow.className = 'theme-editor-field';
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name';
  nameLabel.className = 'term-settings-label';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'settings-input';
  nameInput.value = baseTheme.name + ' (Custom)';
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  dialog.appendChild(nameRow);

  const typeRow = document.createElement('div');
  typeRow.className = 'theme-editor-field';
  const typeLabel = document.createElement('label');
  typeLabel.textContent = 'Type';
  typeLabel.className = 'term-settings-label';
  const typeSelect = document.createElement('select');
  typeSelect.className = 'settings-select';
  ['dark', 'light'].forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  });
  typeSelect.value = baseTheme.type || 'dark';
  typeRow.appendChild(typeLabel);
  typeRow.appendChild(typeSelect);
  dialog.appendChild(typeRow);

  const colorFields = {};
  const chromeColors = [
    ['background', 'Background'],
    ['surface', 'Surface'],
    ['border', 'Border'],
    ['text', 'Text'],
    ['textSecondary', 'Text Secondary'],
    ['accent', 'Accent'],
  ];

  const chromeSection = document.createElement('div');
  chromeSection.innerHTML = '<h4 style="margin:12px 0 8px;font-size:12px;color:var(--text-muted)">APP CHROME</h4>';
  dialog.appendChild(chromeSection);

  chromeColors.forEach(([key, label]) => {
    const row = document.createElement('div');
    row.className = 'theme-editor-color-row';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.className = 'theme-editor-color-label';
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'theme-editor-color-input';
    input.value = baseTheme.colors[key] || '#000000';
    row.appendChild(lbl);
    row.appendChild(input);
    dialog.appendChild(row);
    colorFields[key] = input;
  });

  const termColors = [
    ['background', 'Background'],
    ['foreground', 'Foreground'],
    ['cursor', 'Cursor'],
    ['black', 'Black'],
    ['red', 'Red'],
    ['green', 'Green'],
    ['yellow', 'Yellow'],
    ['blue', 'Blue'],
    ['magenta', 'Magenta'],
    ['cyan', 'Cyan'],
    ['white', 'White'],
    ['brightBlack', 'Bright Black'],
    ['brightRed', 'Bright Red'],
    ['brightGreen', 'Bright Green'],
    ['brightYellow', 'Bright Yellow'],
    ['brightBlue', 'Bright Blue'],
    ['brightMagenta', 'Bright Magenta'],
    ['brightCyan', 'Bright Cyan'],
    ['brightWhite', 'Bright White'],
  ];

  const termSection = document.createElement('div');
  termSection.innerHTML = '<h4 style="margin:12px 0 8px;font-size:12px;color:var(--text-muted)">TERMINAL</h4>';
  dialog.appendChild(termSection);

  const termColorFields = {};
  termColors.forEach(([key, label]) => {
    const row = document.createElement('div');
    row.className = 'theme-editor-color-row';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.className = 'theme-editor-color-label';
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'theme-editor-color-input';
    const val = (baseTheme.colors.terminal || {})[key] || '#000000';
    input.value = val.startsWith('rgba') ? '#000000' : val;
    row.appendChild(lbl);
    row.appendChild(input);
    dialog.appendChild(row);
    termColorFields[key] = input;
  });

  const btnRow = document.createElement('div');
  btnRow.className = 'theme-import-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'settings-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => overlay.remove());

  const saveBtn = document.createElement('button');
  saveBtn.className = 'settings-btn settings-btn-primary';
  saveBtn.textContent = 'Save as Custom Theme';
  saveBtn.addEventListener('click', () => {
    const colors = {};
    Object.entries(colorFields).forEach(([k, inp]) => {
      colors[k] = inp.value;
    });
    colors.surfaceHover = colors.surface;
    colors.primary = colors.accent;
    colors.onPrimary = typeSelect.value === 'dark' ? '#ffffff' : colors.background;
    colors.accentHover = colors.accent;

    const terminal = {};
    Object.entries(termColorFields).forEach(([k, inp]) => {
      terminal[k] = inp.value;
    });
    terminal.cursorAccent = terminal.background;
    terminal.selectionBackground = terminal.background + '88';
    colors.terminal = terminal;

    const newTheme = {
      id: 'custom-' + Date.now(),
      name: nameInput.value || 'Custom Theme',
      type: typeSelect.value,
      builtin: false,
      colors,
    };

    if (typeof saveCustomTheme === 'function') saveCustomTheme(newTheme);
    field('themeId', newTheme.id);
    field('theme', newTheme.type);
    overlay.remove();
    initSettings(container);
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  dialog.appendChild(btnRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function _generateProfileId() {
  return 'profile-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function _renderProfileForm(sec, existingProfile, onSave, onCancel) {
  const form = document.createElement('div');
  form.className = 'profile-form';

  const fields = [
    { key: 'name', label: 'Name', type: 'text', placeholder: 'My Profile' },
    { key: 'command', label: 'Command', type: 'text', placeholder: 'node, python, ssh...' },
    { key: 'args', label: 'Arguments', type: 'text', placeholder: '--flag1 --flag2 (space-separated)' },
    { key: 'cwd', label: 'Working Directory', type: 'text', placeholder: 'C:\\Users\\...' },
  ];

  const envStr =
    existingProfile && existingProfile.env
      ? Object.entries(existingProfile.env)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n')
      : '';

  const values = {
    name: existingProfile ? existingProfile.name : '',
    command: existingProfile ? existingProfile.command : '',
    args: existingProfile ? (existingProfile.args || []).join(' ') : '',
    cwd: existingProfile ? existingProfile.cwd || '' : '',
    icon: existingProfile ? existingProfile.icon : 'terminal',
    env: envStr,
  };

  const inputs = {};

  for (const f of fields) {
    const row = document.createElement('div');
    row.className = 'profile-form-row';
    const label = document.createElement('label');
    label.className = 'settings-label';
    label.textContent = f.label;
    row.appendChild(label);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'settings-input';
    input.placeholder = f.placeholder || '';
    input.value = values[f.key] || '';
    inputs[f.key] = input;
    if (f.key === 'cwd') {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:8px;flex:1;min-width:0;';
      input.style.flex = '1';
      wrap.appendChild(input);
      const browseBtn = document.createElement('button');
      browseBtn.type = 'button';
      browseBtn.className = 'settings-reset';
      browseBtn.style.cssText = 'margin:0;padding:6px 12px;';
      browseBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">folder_open</span>';
      browseBtn.title = 'Browse...';
      browseBtn.addEventListener('click', async () => {
        const dir = await agentDesk.dialog.openDirectory({ defaultPath: input.value || undefined });
        if (dir) input.value = dir;
      });
      wrap.appendChild(browseBtn);
      row.appendChild(wrap);
    } else {
      row.appendChild(input);
    }
    form.appendChild(row);
  }

  // Environment variables textarea
  const envRow = document.createElement('div');
  envRow.className = 'profile-form-row';
  const envLabel = document.createElement('label');
  envLabel.className = 'settings-label';
  envLabel.textContent = 'Environment';
  envRow.appendChild(envLabel);
  const envTextarea = document.createElement('textarea');
  envTextarea.className = 'settings-input';
  envTextarea.placeholder = 'KEY=value (one per line)';
  envTextarea.rows = 3;
  envTextarea.style.cssText = 'resize:vertical;min-height:60px;font-family:monospace;font-size:12px;';
  envTextarea.value = values.env || '';
  inputs.env = envTextarea;
  envRow.appendChild(envTextarea);
  form.appendChild(envRow);

  // Icon selector
  const iconRow = document.createElement('div');
  iconRow.className = 'profile-form-row';
  const iconLabel = document.createElement('label');
  iconLabel.className = 'settings-label';
  iconLabel.textContent = 'Icon';
  iconRow.appendChild(iconLabel);
  const iconWrap = document.createElement('div');
  iconWrap.style.cssText = 'display:flex;align-items:center;gap:10px;flex:1;';
  const iconPreview = document.createElement('span');
  iconPreview.className = 'material-symbols-outlined';
  iconPreview.style.cssText = 'font-size:22px;color:var(--accent,#5d8da8);';
  iconPreview.textContent = values.icon || 'terminal';
  iconWrap.appendChild(iconPreview);
  const iconSelect = document.createElement('select');
  iconSelect.className = 'settings-select';
  iconSelect.style.flex = '1';
  for (const ic of PROFILE_ICON_OPTIONS) {
    const o = document.createElement('option');
    o.value = ic;
    o.textContent = ic.replace(/_/g, ' ');
    if (ic === values.icon) o.selected = true;
    iconSelect.appendChild(o);
  }
  iconSelect.addEventListener('change', () => {
    iconPreview.textContent = iconSelect.value;
  });
  inputs.icon = iconSelect;
  iconWrap.appendChild(iconSelect);
  iconRow.appendChild(iconWrap);
  form.appendChild(iconRow);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'profile-form-buttons';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'profile-btn profile-btn-save';
  saveBtn.textContent = existingProfile ? 'Update' : 'Add';
  saveBtn.addEventListener('click', () => {
    const name = inputs.name.value.trim();
    if (!name) {
      inputs.name.focus();
      return;
    }
    const envMap = {};
    const envText = (inputs.env.value || '').trim();
    if (envText) {
      for (const line of envText.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.includes('=')) continue;
        const eqIdx = trimmed.indexOf('=');
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim();
        if (k) envMap[k] = v;
      }
    }
    const profile = {
      id: existingProfile ? existingProfile.id : _generateProfileId(),
      name,
      command: inputs.command.value.trim(),
      args: _parseArgs(inputs.args.value.trim()),
      cwd: inputs.cwd.value.trim(),
      env: Object.keys(envMap).length > 0 ? envMap : undefined,
      icon: iconSelect.value,
    };
    if (existingProfile && existingProfile.builtin) profile.builtin = true;
    onSave(profile);
  });
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'profile-btn profile-btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', onCancel);
  btnRow.appendChild(saveBtn);
  btnRow.appendChild(cancelBtn);
  form.appendChild(btnRow);

  sec.appendChild(form);
  inputs.name.focus();
  return form;
}

function _renderProfilesSection(sec, container) {
  const profiles = loadProfiles();

  const list = document.createElement('div');
  list.className = 'profile-list';

  function refresh() {
    sec
      .querySelectorAll('.profile-list, .profile-form, .profile-btn-add, .profile-default-row')
      .forEach((el) => el.remove());
    _renderProfilesSection(sec, container);
  }

  for (const profile of profiles) {
    const row = document.createElement('div');
    row.className = 'profile-row';

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined profile-icon';
    icon.textContent = profile.icon || 'terminal';
    row.appendChild(icon);

    const info = document.createElement('div');
    info.className = 'profile-info';
    const nameEl = document.createElement('span');
    nameEl.className = 'profile-name';
    nameEl.textContent = profile.name;
    info.appendChild(nameEl);
    const cmdEl = document.createElement('span');
    cmdEl.className = 'profile-command';
    cmdEl.textContent = profile.command || '(default shell)';
    info.appendChild(cmdEl);
    row.appendChild(info);

    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      if (typeof createTerminalFromProfile === 'function') {
        createTerminalFromProfile(profile);
      }
    });

    const actions = document.createElement('div');
    actions.className = 'profile-actions';

    const launchBtn = document.createElement('button');
    launchBtn.className = 'profile-action-btn profile-launch-btn';
    launchBtn.title = 'Launch terminal';
    launchBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
    launchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof createTerminalFromProfile === 'function') {
        createTerminalFromProfile(profile);
      }
    });
    actions.appendChild(launchBtn);

    const editBtn = document.createElement('button');
    editBtn.className = 'profile-action-btn';
    editBtn.title = 'Edit';
    editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      list.style.display = 'none';
      _renderProfileForm(
        sec,
        profile,
        (updated) => {
          const all = loadProfiles();
          const idx = all.findIndex((p) => p.id === updated.id);
          if (idx >= 0) all[idx] = updated;
          saveProfiles(all);
          refresh();
        },
        refresh,
      );
    });
    actions.appendChild(editBtn);

    if (!profile.builtin) {
      const delBtn = document.createElement('button');
      delBtn.className = 'profile-action-btn danger';
      delBtn.title = 'Delete';
      delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const all = loadProfiles().filter((p) => p.id !== profile.id);
        saveProfiles(all);
        refresh();
      });
      actions.appendChild(delBtn);
    }

    row.appendChild(actions);
    list.appendChild(row);
  }

  sec.appendChild(list);

  // Default profile selector
  const defaultRow = document.createElement('div');
  defaultRow.className = 'profile-default-row';
  const defaultLabel = document.createElement('label');
  defaultLabel.className = 'settings-label';
  defaultLabel.textContent = 'Default Profile';
  defaultLabel.title = 'Profile used for Ctrl+Shift+T and the "+" button';
  defaultRow.appendChild(defaultLabel);
  const defaultSelect = document.createElement('select');
  defaultSelect.className = 'settings-select';
  const currentDefault = _settings.defaultProfile || 'default-shell';
  for (const p of profiles) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    if (p.id === currentDefault) o.selected = true;
    defaultSelect.appendChild(o);
  }
  defaultSelect.addEventListener('change', () => {
    field('defaultProfile', defaultSelect.value);
  });
  defaultRow.appendChild(defaultSelect);
  sec.appendChild(defaultRow);

  const addBtn = document.createElement('button');
  addBtn.className = 'profile-btn profile-btn-add';
  addBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">add</span> Add Profile';
  addBtn.addEventListener('click', () => {
    list.style.display = 'none';
    addBtn.style.display = 'none';
    _renderProfileForm(
      sec,
      null,
      (newProfile) => {
        const all = loadProfiles();
        all.push(newProfile);
        saveProfiles(all);
        refresh();
      },
      refresh,
    );
  });
  sec.appendChild(addBtn);
}

// ── Workspaces ────────────────────────────────────────────────────────

function loadWorkspaces() {
  if (_configData && _configData.workspaces) {
    return _configData.workspaces;
  }
  return {};
}

// eslint-disable-next-line no-unused-vars
function saveWorkspace(name, workspaceData) {
  if (!_configData) _configData = { version: 1, settings: {}, profiles: [], workspaces: {} };
  if (!_configData.workspaces) _configData.workspaces = {};
  _configData.workspaces[name] = workspaceData;
  agentDesk.config.write(_configData).catch(() => {});
  window.dispatchEvent(new CustomEvent('workspaces-changed'));
}

function deleteWorkspace(name) {
  if (!_configData || !_configData.workspaces) return;
  delete _configData.workspaces[name];
  agentDesk.config.write(_configData).catch(() => {});
  window.dispatchEvent(new CustomEvent('workspaces-changed'));
}

function renameWorkspace(oldName, newName) {
  if (!_configData || !_configData.workspaces || !_configData.workspaces[oldName]) return;
  _configData.workspaces[newName] = _configData.workspaces[oldName];
  _configData.workspaces[newName].name = newName;
  delete _configData.workspaces[oldName];
  agentDesk.config.write(_configData).catch(() => {});
  window.dispatchEvent(new CustomEvent('workspaces-changed'));
}

function _renderWorkspacesSection(sec) {
  const workspaces = loadWorkspaces();
  const names = Object.keys(workspaces).sort((a, b) => {
    const ta = workspaces[a].created || '';
    const tb = workspaces[b].created || '';
    return tb.localeCompare(ta);
  });

  const list = document.createElement('div');
  list.className = 'profile-list';

  function refresh() {
    sec.querySelectorAll('.profile-list, .profile-form, .profile-btn-add').forEach((el) => el.remove());
    _renderWorkspacesSection(sec);
  }

  for (const name of names) {
    const ws = workspaces[name];
    const row = document.createElement('div');
    row.className = 'profile-row workspace-card';

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined profile-icon';
    icon.textContent = 'workspaces';
    row.appendChild(icon);

    const info = document.createElement('div');
    info.className = 'profile-info';
    const nameEl = document.createElement('span');
    nameEl.className = 'profile-name';
    nameEl.textContent = name;
    info.appendChild(nameEl);
    const meta = document.createElement('span');
    meta.className = 'profile-command';
    const termCount = ws.terminals ? ws.terminals.length : 0;
    const dateStr = ws.created ? new Date(ws.created).toLocaleDateString() : '';
    meta.textContent = `${termCount} terminal${termCount !== 1 ? 's' : ''}${dateStr ? ' \u00b7 ' + dateStr : ''}`;
    info.appendChild(meta);
    row.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'profile-actions';

    const loadBtn = document.createElement('button');
    loadBtn.className = 'profile-action-btn profile-launch-btn';
    loadBtn.title = 'Load workspace';
    loadBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
    loadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('workspace-load', { detail: { name } }));
    });
    actions.appendChild(loadBtn);

    const renBtn = document.createElement('button');
    renBtn.className = 'profile-action-btn';
    renBtn.title = 'Rename';
    renBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';
    renBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Inline rename
      nameEl.contentEditable = 'true';
      nameEl.focus();
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      function finishRename() {
        nameEl.contentEditable = 'false';
        const newName = nameEl.textContent.trim();
        if (newName && newName !== name) {
          renameWorkspace(name, newName);
          refresh();
        } else {
          nameEl.textContent = name;
        }
      }
      nameEl.addEventListener('blur', finishRename, { once: true });
      nameEl.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') {
          ke.preventDefault();
          nameEl.blur();
        }
        if (ke.key === 'Escape') {
          nameEl.textContent = name;
          nameEl.blur();
        }
      });
    });
    actions.appendChild(renBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'profile-action-btn danger';
    delBtn.title = 'Delete';
    delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteWorkspace(name);
      refresh();
    });
    actions.appendChild(delBtn);

    row.appendChild(actions);
    row.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('workspace-load', { detail: { name } }));
    });
    row.style.cursor = 'pointer';
    list.appendChild(row);
  }

  if (names.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--text-muted,#888);font-size:12px;padding:8px 0;';
    empty.textContent = 'No saved workspaces. Use Ctrl+Shift+W to save the current layout.';
    list.appendChild(empty);
  }

  sec.appendChild(list);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'profile-btn profile-btn-add';
  saveBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">save</span> Save Current Layout';
  saveBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('workspace-save-request'));
  });
  sec.appendChild(saveBtn);
}

// ── Public API ────────────────────────────────────────────────────────

// ── Keyboard Shortcuts Section ────────────────────────────────────────

function _renderKeybindingsSection(sec) {
  if (typeof KeybindingManager === 'undefined') {
    const msg = document.createElement('div');
    msg.style.cssText = 'padding:8px 0;opacity:0.6;font-size:13px;';
    msg.textContent = 'KeybindingManager not loaded.';
    sec.appendChild(msg);
    return;
  }

  const filterInput = document.createElement('input');
  filterInput.type = 'text';
  filterInput.placeholder = 'Filter shortcuts\u2026';
  filterInput.style.cssText =
    'width:100%;margin-bottom:12px;box-sizing:border-box;background:var(--surface,#1e1e1e);' +
    'border:1px solid var(--border,#2c2c2c);color:var(--text,#e0e0e0);padding:8px 12px;' +
    'border-radius:6px;font-size:13px;font-family:inherit;outline:none;';
  sec.appendChild(filterInput);

  const table = document.createElement('div');
  table.className = 'keybinding-table';
  table.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
  sec.appendChild(table);

  function renderBindings(filter) {
    table.innerHTML = '';
    const bindings = KeybindingManager.getBindings();
    const filterLower = (filter || '').toLowerCase();

    for (const b of bindings) {
      if (
        filterLower &&
        !b.label.toLowerCase().includes(filterLower) &&
        !b.effectiveKeys.toLowerCase().includes(filterLower)
      )
        continue;

      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;' + 'font-size:13px;';

      const label = document.createElement('span');
      label.style.cssText = 'flex:1;';
      label.textContent = b.label;
      row.appendChild(label);

      const keys = document.createElement('kbd');
      keys.style.cssText =
        'min-width:120px;text-align:center;padding:3px 8px;border-radius:4px;font-size:12px;' +
        'background:var(--surface,#252830);border:1px solid var(--border,#2c2c2c);' +
        'font-family:inherit;color:var(--text,#e0e0e0);';
      keys.textContent = b.effectiveKeys || '(unbound)';
      row.appendChild(keys);

      const editBtn = document.createElement('button');
      editBtn.className = 'settings-reset';
      editBtn.style.cssText = 'margin:0;padding:4px 8px;font-size:12px;';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        keys.textContent = 'Press keys\u2026';
        keys.style.borderColor = '#5d8da8';
        const cancel = KeybindingManager.startCapture((newKeys) => {
          if (newKeys !== null) {
            KeybindingManager.setBindingKeys(b.id, newKeys);
          }
          renderBindings(filterInput.value);
        });
        editBtn.textContent = 'Cancel';
        editBtn.onclick = () => {
          cancel();
          renderBindings(filterInput.value);
        };
      });
      row.appendChild(editBtn);

      const resetBtn = document.createElement('button');
      resetBtn.className = 'settings-reset';
      resetBtn.style.cssText = 'margin:0;padding:4px 8px;font-size:12px;';
      resetBtn.textContent = 'Reset';
      resetBtn.disabled = b.keys === null || b.keys === undefined;
      resetBtn.addEventListener('click', () => {
        KeybindingManager.resetBinding(b.id);
        renderBindings(filterInput.value);
      });
      row.appendChild(resetBtn);

      table.appendChild(row);
    }
  }

  filterInput.addEventListener('input', () => renderBindings(filterInput.value));
  renderBindings('');

  const resetAllBtn = document.createElement('button');
  resetAllBtn.className = 'settings-reset';
  resetAllBtn.style.cssText = 'margin-top:12px;';
  resetAllBtn.innerHTML =
    '<span class="material-symbols-outlined" style="font-size:14px">restart_alt</span> Reset All Shortcuts';
  resetAllBtn.addEventListener('click', () => {
    KeybindingManager.resetAll();
    renderBindings(filterInput.value);
  });
  sec.appendChild(resetAllBtn);
}

// ── Shell Integration Section ────────────────────────────────────────

function _renderShellIntegrationSection(sec) {
  const desc = document.createElement('div');
  desc.style.cssText = 'padding:4px 0 12px;font-size:13px;opacity:0.8;line-height:1.5;';
  desc.textContent =
    'Shell integration enables current directory tracking, command boundary detection, ' +
    'and exit code display. Add the appropriate snippet to your shell configuration.';
  sec.appendChild(desc);

  const shells =
    typeof ShellIntegration !== 'undefined'
      ? ShellIntegration.getAvailableShells()
      : ['bash', 'zsh', 'fish', 'powershell'];
  const shellLabels = { bash: 'Bash', zsh: 'Zsh', fish: 'Fish', powershell: 'PowerShell' };

  for (const shell of shells) {
    const group = document.createElement('div');
    group.style.cssText = 'margin-bottom:16px;';

    const header = document.createElement('div');
    header.style.cssText = 'font-weight:600;font-size:13px;margin-bottom:6px;';
    header.textContent = shellLabels[shell] || shell;
    group.appendChild(header);

    const pre = document.createElement('pre');
    pre.style.cssText =
      'background:var(--surface,#1e1e1e);border:1px solid var(--border,#2c2c2c);' +
      'border-radius:6px;padding:12px;font-size:12px;font-family:"JetBrains Mono",monospace;' +
      'white-space:pre-wrap;word-break:break-all;color:var(--text,#e0e0e0);max-height:200px;overflow-y:auto;';
    const snippet = typeof ShellIntegration !== 'undefined' ? ShellIntegration.getSetupSnippet(shell) : '';
    pre.textContent = snippet || '';
    group.appendChild(pre);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'settings-reset';
    copyBtn.style.cssText = 'margin-top:4px;padding:4px 12px;font-size:12px;';
    copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">content_copy</span> Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.textContent);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">content_copy</span> Copy';
      }, 1500);
    });
    group.appendChild(copyBtn);

    sec.appendChild(group);
  }

  const statusDiv = document.createElement('div');
  statusDiv.style.cssText = 'padding:8px 0;font-size:13px;opacity:0.7;';
  if (typeof ShellIntegration !== 'undefined' && window.__agentDeskState) {
    const activeCount = [...window.__agentDeskState.terminals.keys()].filter((id) =>
      ShellIntegration.isActive(id),
    ).length;
    const totalCount = window.__agentDeskState.terminals.size;
    statusDiv.textContent = `Shell integration active in ${activeCount} of ${totalCount} terminal(s).`;
  } else {
    statusDiv.textContent = 'Shell integration status will appear after opening terminals.';
  }
  sec.appendChild(statusDiv);
}

async function initSettings(container) {
  injectStyle();
  await _initConfig();
  const settings = load();
  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'settings-root';

  const heading = document.createElement('h2');
  heading.className = 'settings-heading';
  heading.textContent = 'Settings';
  root.appendChild(heading);

  for (const section of SECTIONS) {
    const sec = document.createElement('div');
    sec.className = 'settings-section';

    const header = document.createElement('div');
    header.className = 'settings-section-header';
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = section.icon;
    const title = document.createElement('span');
    title.className = 'settings-section-title';
    title.textContent = section.title;
    header.appendChild(icon);
    header.appendChild(title);
    sec.appendChild(header);

    if (section.custom && section.title === 'Themes') {
      _renderThemesSection(sec, container);
    } else if (section.custom && section.title === 'Profiles') {
      _renderProfilesSection(sec, container);
    } else if (section.custom && section.title === 'Templates') {
      if (typeof renderTemplatesSection === 'function') renderTemplatesSection(sec);
    } else if (section.custom && section.title === 'Workspaces') {
      _renderWorkspacesSection(sec);
    } else if (section.custom && section.title === 'Keyboard Shortcuts') {
      _renderKeybindingsSection(sec);
    } else if (section.fields) {
      for (const f of section.fields) {
        sec.appendChild(renderField(f, settings));
      }
    }
    root.appendChild(sec);
  }

  // Reset button
  const resetBtn = document.createElement('button');
  resetBtn.className = 'settings-reset';
  resetBtn.innerHTML =
    '<span class="material-symbols-outlined" style="font-size:16px">restart_alt</span> Reset to Defaults';
  resetBtn.addEventListener('click', () => {
    _settings = { ...DEFAULTS };
    save();
    initSettings(container);
  });
  root.appendChild(resetBtn);

  container.appendChild(root);
}

// eslint-disable-next-line no-unused-vars
function getSettings() {
  if (!_settings) load();
  return { ..._settings };
}

// eslint-disable-next-line no-unused-vars
function getSetting(key) {
  if (!_settings) load();
  return _settings[key];
}

// eslint-disable-next-line no-unused-vars
function setSetting(key, value) {
  if (!_settings) load();
  field(key, value);
}
