/**
 * Theme color utilities for canvas drawing and JS code.
 * Reads CSS custom properties from :root so canvas code stays in sync with the theme.
 */

const cache = new Map();
let cacheEpoch = 0;

/** Invalidate the CSS variable cache (call when theme changes). */
export function invalidateThemeCache() {
  cache.clear();
  cacheEpoch += 1;
  notifyThemeChange();
}

/**
 * Read a CSS custom property value from :root.
 * Results are cached until invalidateThemeCache() is called.
 */
export function getCssVar(name, fallback = '') {
  const key = name + '|' + cacheEpoch;
  if (cache.has(key)) return cache.get(key);
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  cache.set(key, value);
  return value;
}

/** Convert a hex color to an rgba string with given alpha. */
export function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Get a CSS variable color as rgba with given alpha. */
export function getCssVarRgba(name, alpha, fallbackHex = '#888888') {
  const hex = getCssVar(name, fallbackHex);
  return hexToRgba(hex, alpha);
}

/**
 * Get all common theme colors for canvas drawing.
 * Call once per render frame; the result is cheap (cache-backed).
 */
export function getThemeColors() {
  return {
    // Backgrounds
    bgApp:         getCssVar('--bg-app',         '#1e1e1e'),
    bgPanel:       getCssVar('--bg-panel',        '#252525'),
    bgPanelLight:  getCssVar('--bg-panel-light',  '#383838'),
    // Borders
    border:          getCssVar('--border',          '#3a3a3a'),
    borderEmphasis:  getCssVar('--border-emphasis', '#505050'),
    // Text
    textPrimary:    getCssVar('--text-primary',   '#e8e8e8'),
    textSecondary:  getCssVar('--text-secondary', '#a0a0a0'),
    textDim:        getCssVar('--text-dim',       '#606060'),
    textBright:     getCssVar('--text-bright',    '#ffffff'),
    // Accent
    accent:       getCssVar('--accent',       '#33CED6'),
    accentHover:  getCssVar('--accent-hover', '#26a8b0'),
    // Waveform-specific
    wfWhiteKey:  getCssVar('--wf-white-key', '#ffffff'),
    wfBlackKey:  getCssVar('--wf-black-key', '#000000'),
    wfGrid:      getCssVar('--wf-grid',      '#ffffff'),
    wfLabel:     getCssVar('--wf-label',     '#a0a0b0'),
    wfBgWhite:   getCssVar('--wf-bg-white',  '#1e1e36'),
    wfBgBlack:   getCssVar('--wf-bg-black',  '#16162e'),
    wfGridLine:  getCssVar('--wf-grid-line', 'rgba(60,60,90,0.4)'),
    // Harmonic limiter
    harmonicStart:    getCssVar('--harmonic-start',    '#33CED6'),
    harmonicEnd:      getCssVar('--harmonic-end',      '#4EDE83'),
    harmonicGrid:     getCssVar('--harmonic-grid',     '#3a3a5a'),
    harmonicModified: getCssVar('--harmonic-modified', '#ffb340'),
    // Semantic
    success:      getCssVar('--success',       '#4EDE83'),
    colorError:   getCssVar('--color-error',   '#e94560'),
    colorWarning: getCssVar('--color-warning', '#e6c84a'),
    primary:      getCssVar('--primary',       '#1D5AAA'),
  };
}

// ── Theme-change listeners ────────────────────────────────────────────────────
// Canvas components register here to trigger redraws when the theme changes.

const themeChangeListeners = new Set();

export function onThemeChange(fn) {
  themeChangeListeners.add(fn);
  return () => themeChangeListeners.delete(fn);
}

export function notifyThemeChange() {
  for (const fn of themeChangeListeners) {
    try { fn(); } catch { /* ignore */ }
  }
}
