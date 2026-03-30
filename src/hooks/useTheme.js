/**
 * Thin theme startup utility.
 * The full theme editor + applyTheme logic lives in ThemeEditor.jsx.
 * This module only provides the startup loader used by App.jsx.
 */

import { invalidateThemeCache } from '../utils/themeColors';

function applyThemeVars(variables) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(variables)) {
    root.style.setProperty(k, v);
  }
  // Derived accent variants
  const accent = variables['--accent'] || '';
  if (accent) {
    root.style.setProperty('--accent-subtle', accent + '15');
    root.style.setProperty('--accent-border', accent + '33');
    root.style.setProperty('--accent-glow',   accent + '55');
  }
  const accentHover = variables['--accent-hover'] || '';
  if (accentHover) {
    root.style.setProperty('--accent-active', accentHover);
    root.style.setProperty('--accent-dim',    accentHover);
  }
  // Legacy aliases
  const bgApp = variables['--bg-app'] || '';
  if (bgApp) root.style.setProperty('--bg-dark', bgApp);
  const text = variables['--text-primary'] || '';
  if (text) root.style.setProperty('--text', text);

  invalidateThemeCache();
}

/**
 * Load and apply the saved theme on app startup.
 * Call once in App.jsx useEffect (no deps).
 */
export async function loadSavedTheme() {
  try {
    const theme = await window.electronAPI?.themesLoad?.();
    if (theme?.variables && typeof theme.variables === 'object' && Object.keys(theme.variables).length > 0) {
      applyThemeVars(theme.variables);
    }
  } catch {
    // No saved theme — CSS variable defaults in index.css will apply
  }
}
