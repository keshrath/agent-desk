'use strict';
try {
  var raw = localStorage.getItem('agent-desk-settings');
  var settings = raw ? JSON.parse(raw) : {};
  var themeId = settings.themeId || null;
  var themesRaw = localStorage.getItem('agent-desk-custom-themes');
  var customThemes = themesRaw ? JSON.parse(themesRaw) : [];

  var themeObj = null;
  if (themeId) {
    for (var i = 0; i < customThemes.length; i++) {
      if (customThemes[i].id === themeId) {
        themeObj = customThemes[i];
        break;
      }
    }
  }

  var baseType = themeObj ? themeObj.type || 'dark' : settings.theme || 'dark';
  document.documentElement.setAttribute('data-theme', baseType);

  if (themeObj && themeObj.colors) {
    var c = themeObj.colors;
    var s = document.documentElement.style;
    if (c.background) s.setProperty('--bg', c.background);
    if (c.surface) s.setProperty('--surface', c.surface);
    if (c.surfaceHover) s.setProperty('--surface-hover', c.surfaceHover);
    if (c.border) s.setProperty('--border', c.border);
    if (c.text) s.setProperty('--text', c.text);
    if (c.textSecondary) {
      s.setProperty('--text-muted', c.textSecondary);
      s.setProperty('--text-dim', c.textSecondary);
    }
    if (c.accent || c.primary) {
      s.setProperty('--accent', c.accent || c.primary);
      s.setProperty('--accent-dim', c.primary || c.accent);
    }
    if (c.accentHover) s.setProperty('--accent-hover', c.accentHover);
  }
} catch (_e) {
  document.documentElement.setAttribute('data-theme', 'dark');
}
