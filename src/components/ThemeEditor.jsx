import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invalidateThemeCache } from '../utils/themeColors';
import './ThemeEditor.css';

// ── Color group definitions (Advanced mode) ───────────────────────────────────

const THEME_GROUPS = [
  {
    labelKey: 'electron.theme.group_backgrounds',
    vars: [
      { name: '--bg-app',         labelKey: 'electron.theme.var_app_background' },
      { name: '--bg-titlebar',    labelKey: 'electron.theme.var_title_bar' },
      { name: '--bg-panel',       labelKey: 'electron.theme.var_panel_surfaces' },
      { name: '--bg-panel-hover', labelKey: 'electron.theme.var_panel_hover' },
      { name: '--bg-panel-light', labelKey: 'electron.theme.var_panel_light' },
    ],
  },
  {
    labelKey: 'electron.theme.group_borders',
    vars: [
      { name: '--border',          labelKey: 'electron.theme.var_default_border' },
      { name: '--border-emphasis', labelKey: 'electron.theme.var_emphasis_border' },
    ],
  },
  {
    labelKey: 'electron.theme.group_text',
    vars: [
      { name: '--text-primary',   labelKey: 'electron.theme.var_primary_text' },
      { name: '--text-secondary', labelKey: 'electron.theme.var_secondary_text' },
      { name: '--text-dim',       labelKey: 'electron.theme.var_dimmed_text' },
      { name: '--text-bright',    labelKey: 'electron.theme.var_bright_text' },
    ],
  },
  {
    labelKey: 'electron.theme.group_accent',
    vars: [
      { name: '--accent',       labelKey: 'electron.theme.var_accent' },
      { name: '--accent-hover', labelKey: 'electron.theme.var_accent_hover' },
    ],
  },
  {
    labelKey: 'electron.theme.group_waveform',
    vars: [
      { name: '--wf-white-key', labelKey: 'electron.theme.var_white_key_lane' },
      { name: '--wf-black-key', labelKey: 'electron.theme.var_black_key_lane' },
      { name: '--wf-grid',      labelKey: 'electron.theme.var_grid_lines' },
      { name: '--wf-label',     labelKey: 'electron.theme.var_note_labels' },
      { name: '--wf-bg-white',  labelKey: 'electron.theme.var_bg_white_note' },
      { name: '--wf-bg-black',  labelKey: 'electron.theme.var_bg_black_note' },
      { name: '--wf-grid-line', labelKey: 'electron.theme.var_bg_grid_line' },
    ],
  },
  {
    labelKey: 'electron.theme.group_harmonic',
    vars: [
      { name: '--harmonic-start',    labelKey: 'electron.theme.var_node_gradient_start' },
      { name: '--harmonic-end',      labelKey: 'electron.theme.var_node_gradient_end' },
      { name: '--harmonic-grid',     labelKey: 'electron.theme.var_harmonic_grid_lines' },
      { name: '--harmonic-modified', labelKey: 'electron.theme.var_modified_node' },
    ],
  },
  {
    labelKey: 'electron.theme.group_semantic',
    vars: [
      { name: '--success',       labelKey: 'electron.theme.var_success_ok' },
      { name: '--color-error',   labelKey: 'electron.theme.var_error_close' },
      { name: '--color-warning', labelKey: 'electron.theme.var_warning' },
      { name: '--primary',       labelKey: 'electron.theme.var_primary_action' },
    ],
  },
];

const ALL_VAR_NAMES = THEME_GROUPS.flatMap((g) => g.vars.map((v) => v.name));

// ── Built-in presets ──────────────────────────────────────────────────────────

const PRESET_THEMES = {
  'Default': {
    '--bg-app': '#1e1e1e', '--bg-titlebar': '#171717', '--bg-panel': '#252525',
    '--bg-panel-hover': '#2e2e2e', '--bg-panel-light': '#383838',
    '--border': '#3a3a3a', '--border-emphasis': '#505050',
    '--text-primary': '#e8e8e8', '--text-secondary': '#a0a0a0',
    '--text-dim': '#606060', '--text-bright': '#ffffff',
    '--accent': '#33CED6', '--accent-hover': '#26a8b0',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#a0a0b0',
    '--wf-bg-white': '#1e1e36', '--wf-bg-black': '#16162e', '--wf-grid-line': '#2a2a48',
    '--harmonic-start': '#33CED6', '--harmonic-end': '#4EDE83',
    '--harmonic-grid': '#3a3a5a', '--harmonic-modified': '#ffb340',
    '--success': '#4EDE83', '--color-error': '#e94560',
    '--color-warning': '#e6c84a', '--primary': '#1D5AAA',
  },
  'Midnight Blue': {
    '--bg-app': '#080c18', '--bg-titlebar': '#0a1020', '--bg-panel': '#0e1628',
    '--bg-panel-hover': '#141e34', '--bg-panel-light': '#1a2640',
    '--border': '#162040', '--border-emphasis': '#243454',
    '--text-primary': '#c0d0e8', '--text-secondary': '#7088aa',
    '--text-dim': '#3a5070', '--text-bright': '#dce8f8',
    '--accent': '#4da6ff', '--accent-hover': '#3690e8',
    '--wf-white-key': '#c0d0e8', '--wf-black-key': '#040810',
    '--wf-grid': '#4da6ff', '--wf-label': '#7088aa',
    '--wf-bg-white': '#201810', '--wf-bg-black': '#18120a', '--wf-grid-line': '#302418',
    '--harmonic-start': '#4da6ff', '--harmonic-end': '#06d6a0',
    '--harmonic-grid': '#162040', '--harmonic-modified': '#ffb340',
    '--success': '#06d6a0', '--color-error': '#e94560',
    '--color-warning': '#e6c84a', '--primary': '#2460b8',
  },
  'High Contrast': {
    '--bg-app': '#000000', '--bg-titlebar': '#080808', '--bg-panel': '#0f0f0f',
    '--bg-panel-hover': '#1a1a1a', '--bg-panel-light': '#222222',
    '--border': '#333333', '--border-emphasis': '#555555',
    '--text-primary': '#ffffff', '--text-secondary': '#cccccc',
    '--text-dim': '#888888', '--text-bright': '#ffffff',
    '--accent': '#00ffcc', '--accent-hover': '#00ccaa',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#00ffcc', '--wf-label': '#cccccc',
    '--wf-bg-white': '#1a0a0a', '--wf-bg-black': '#120606', '--wf-grid-line': '#2a1212',
    '--harmonic-start': '#00ffcc', '--harmonic-end': '#ffff00',
    '--harmonic-grid': '#333333', '--harmonic-modified': '#ff8800',
    '--success': '#00ff88', '--color-error': '#ff0044',
    '--color-warning': '#ffcc00', '--primary': '#0066ff',
  },
  'Amber': {
    '--bg-app': '#1e1c17', '--bg-titlebar': '#171511', '--bg-panel': '#26241d',
    '--bg-panel-hover': '#302d24', '--bg-panel-light': '#3c382e',
    '--border': '#444034', '--border-emphasis': '#585248',
    '--text-primary': '#e8e6e0', '--text-secondary': '#a8a498',
    '--text-dim': '#6a6454', '--text-bright': '#ffffff',
    '--accent': '#E8A830', '--accent-hover': '#c48e26',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#b0a89c',
    '--wf-bg-white': '#242018', '--wf-bg-black': '#1c1a14', '--wf-grid-line': '#3a3626',
    '--harmonic-start': '#E8A830', '--harmonic-end': '#80D870',
    '--harmonic-grid': '#4a4434', '--harmonic-modified': '#f0d050',
    '--success': '#4EDE83', '--color-error': '#e94560',
    '--color-warning': '#e6c84a', '--primary': '#AA8028',
  },
  'Chartreuse': {
    '--bg-app': '#1b1c16', '--bg-titlebar': '#141510', '--bg-panel': '#23241c',
    '--bg-panel-hover': '#2c2d24', '--bg-panel-light': '#383a2e',
    '--border': '#404234', '--border-emphasis': '#545648',
    '--text-primary': '#e6e8e0', '--text-secondary': '#a4a896',
    '--text-dim': '#646850', '--text-bright': '#ffffff',
    '--accent': '#A0D840', '--accent-hover': '#88b836',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#a8b09c',
    '--wf-bg-white': '#202218', '--wf-bg-black': '#181a14', '--wf-grid-line': '#343828',
    '--harmonic-start': '#A0D840', '--harmonic-end': '#40D8A0',
    '--harmonic-grid': '#444834', '--harmonic-modified': '#f0b040',
    '--success': '#A0D840', '--color-error': '#e94560',
    '--color-warning': '#e6c84a', '--primary': '#688830',
  },
  'Cherry': {
    '--bg-app': '#1e1a1a', '--bg-titlebar': '#171314', '--bg-panel': '#261f20',
    '--bg-panel-hover': '#2e2628', '--bg-panel-light': '#3a3032',
    '--border': '#3e3234', '--border-emphasis': '#554548',
    '--text-primary': '#e8e4e4', '--text-secondary': '#a89a9c',
    '--text-dim': '#6a5558', '--text-bright': '#ffffff',
    '--accent': '#E8405A', '--accent-hover': '#c43248',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#b0a0a4',
    '--wf-bg-white': '#241a1e', '--wf-bg-black': '#1c1418', '--wf-grid-line': '#3a2a30',
    '--harmonic-start': '#E8405A', '--harmonic-end': '#F5A060',
    '--harmonic-grid': '#4a3238', '--harmonic-modified': '#ffb340',
    '--success': '#4EDE83', '--color-error': '#ff4466',
    '--color-warning': '#e6c84a', '--primary': '#AA3050',
  },
  'Coral': {
    '--bg-app': '#1e1b19', '--bg-titlebar': '#171413', '--bg-panel': '#262120',
    '--bg-panel-hover': '#302928', '--bg-panel-light': '#3c3432',
    '--border': '#443836', '--border-emphasis': '#584a48',
    '--text-primary': '#e8e5e4', '--text-secondary': '#a89e9c',
    '--text-dim': '#6a5e58', '--text-bright': '#ffffff',
    '--accent': '#E86850', '--accent-hover': '#c45540',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#b0a4a0',
    '--wf-bg-white': '#241e1c', '--wf-bg-black': '#1c1614', '--wf-grid-line': '#3a2e2a',
    '--harmonic-start': '#E86850', '--harmonic-end': '#F0C050',
    '--harmonic-grid': '#4a3a36', '--harmonic-modified': '#ffb340',
    '--success': '#4EDE83', '--color-error': '#e94560',
    '--color-warning': '#e6c84a', '--primary': '#AA5040',
  },
  'Emerald': {
    '--bg-app': '#181e1a', '--bg-titlebar': '#121714', '--bg-panel': '#1e261f',
    '--bg-panel-hover': '#263028', '--bg-panel-light': '#303c32',
    '--border': '#344438', '--border-emphasis': '#48584c',
    '--text-primary': '#e2e8e4', '--text-secondary': '#98a89c',
    '--text-dim': '#546a58', '--text-bright': '#ffffff',
    '--accent': '#3CD878', '--accent-hover': '#30b862',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#9cb0a4',
    '--wf-bg-white': '#1a241e', '--wf-bg-black': '#141c18', '--wf-grid-line': '#283a2e',
    '--harmonic-start': '#3CD878', '--harmonic-end': '#3CB8D8',
    '--harmonic-grid': '#344a3a', '--harmonic-modified': '#f0b040',
    '--success': '#3CD878', '--color-error': '#e94560',
    '--color-warning': '#e6c84a', '--primary': '#2A8858',
  },
  'Forest': {
    '--bg-app': '#191e19', '--bg-titlebar': '#131713', '--bg-panel': '#20261f',
    '--bg-panel-hover': '#283028', '--bg-panel-light': '#323c32',
    '--border': '#384438', '--border-emphasis': '#4c584c',
    '--text-primary': '#e2e8e2', '--text-secondary': '#98a898',
    '--text-dim': '#586a58', '--text-bright': '#ffffff',
    '--accent': '#58A858', '--accent-hover': '#488a48',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#9cb09c',
    '--wf-bg-white': '#1c241c', '--wf-bg-black': '#161c16', '--wf-grid-line': '#2a3a2a',
    '--harmonic-start': '#58A858', '--harmonic-end': '#58A8A8',
    '--harmonic-grid': '#364a36', '--harmonic-modified': '#f0b040',
    '--success': '#58A858', '--color-error': '#e94560',
    '--color-warning': '#e6c84a', '--primary': '#3A7040',
  },
  'Jade': {
    '--bg-app': '#171e1d', '--bg-titlebar': '#111716', '--bg-panel': '#1d2625',
    '--bg-panel-hover': '#24302e', '--bg-panel-light': '#2e3c3a',
    '--border': '#324442', '--border-emphasis': '#465856',
    '--text-primary': '#e0e8e7', '--text-secondary': '#96a8a6',
    '--text-dim': '#506a66', '--text-bright': '#ffffff',
    '--accent': '#3ABCAC', '--accent-hover': '#2e9c90',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#98b0ac',
    '--wf-bg-white': '#1a2424', '--wf-bg-black': '#141c1c', '--wf-grid-line': '#283a38',
    '--harmonic-start': '#3ABCAC', '--harmonic-end': '#6ABC3A',
    '--harmonic-grid': '#324a46', '--harmonic-modified': '#f0b040',
    '--success': '#4EDE83', '--color-error': '#e94560',
    '--color-warning': '#e6c84a', '--primary': '#28887C',
  },
  'Mint': {
    '--bg-app': '#181e1c', '--bg-titlebar': '#121716', '--bg-panel': '#1e2624',
    '--bg-panel-hover': '#26302c', '--bg-panel-light': '#303c38',
    '--border': '#34443e', '--border-emphasis': '#485854',
    '--text-primary': '#e2e8e6', '--text-secondary': '#98a8a4',
    '--text-dim': '#546a64', '--text-bright': '#ffffff',
    '--accent': '#50D8A8', '--accent-hover': '#40b890',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#9cb0aa',
    '--wf-bg-white': '#1a2422', '--wf-bg-black': '#141c1a', '--wf-grid-line': '#283a36',
    '--harmonic-start': '#50D8A8', '--harmonic-end': '#50A8D8',
    '--harmonic-grid': '#344a44', '--harmonic-modified': '#f0b040',
    '--success': '#50D8A8', '--color-error': '#e94560',
    '--color-warning': '#e6c84a', '--primary': '#308878',
  },
  'Peach': {
    '--bg-app': '#1e1b18', '--bg-titlebar': '#171413', '--bg-panel': '#262220',
    '--bg-panel-hover': '#302b28', '--bg-panel-light': '#3c3632',
    '--border': '#443e38', '--border-emphasis': '#56504c',
    '--text-primary': '#e8e6e2', '--text-secondary': '#a8a29e',
    '--text-dim': '#6a6258', '--text-bright': '#ffffff',
    '--accent': '#E8A088', '--accent-hover': '#c48870',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#b0a8a0',
    '--wf-bg-white': '#241e1c', '--wf-bg-black': '#1c1816', '--wf-grid-line': '#3a322c',
    '--harmonic-start': '#E8A088', '--harmonic-end': '#E8D088',
    '--harmonic-grid': '#4a3e38', '--harmonic-modified': '#f0c060',
    '--success': '#4EDE83', '--color-error': '#e94560',
    '--color-warning': '#e6c84a', '--primary': '#AA7868',
  },
  'Rosé': {
    '--bg-app': '#1e1a1c', '--bg-titlebar': '#171314', '--bg-panel': '#262022',
    '--bg-panel-hover': '#2e282a', '--bg-panel-light': '#3a3234',
    '--border': '#443a3c', '--border-emphasis': '#564c4e',
    '--text-primary': '#e8e4e6', '--text-secondary': '#a89ca0',
    '--text-dim': '#6a585e', '--text-bright': '#ffffff',
    '--accent': '#D070A0', '--accent-hover': '#b05c88',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#b0a0a8',
    '--wf-bg-white': '#241a20', '--wf-bg-black': '#1c1418', '--wf-grid-line': '#3a2a32',
    '--harmonic-start': '#D070A0', '--harmonic-end': '#A070D0',
    '--harmonic-grid': '#4a3640', '--harmonic-modified': '#f0b060',
    '--success': '#4EDE83', '--color-error': '#e94560',
    '--color-warning': '#e6c84a', '--primary': '#8A4870',
  },
  'Saffron': {
    '--bg-app': '#1d1c16', '--bg-titlebar': '#161510', '--bg-panel': '#25241c',
    '--bg-panel-hover': '#2e2d24', '--bg-panel-light': '#3a382e',
    '--border': '#424034', '--border-emphasis': '#56544a',
    '--text-primary': '#e8e7e0', '--text-secondary': '#a8a696',
    '--text-dim': '#686650', '--text-bright': '#ffffff',
    '--accent': '#DCC030', '--accent-hover': '#b8a028',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#b0ae9c',
    '--wf-bg-white': '#222018', '--wf-bg-black': '#1c1a14', '--wf-grid-line': '#383626',
    '--harmonic-start': '#DCC030', '--harmonic-end': '#70D878',
    '--harmonic-grid': '#484434', '--harmonic-modified': '#f09040',
    '--success': '#4EDE83', '--color-error': '#e94560',
    '--color-warning': '#DCC030', '--primary': '#8A8028',
  },
  'Tangerine': {
    '--bg-app': '#1e1c18', '--bg-titlebar': '#171512', '--bg-panel': '#26231e',
    '--bg-panel-hover': '#302c26', '--bg-panel-light': '#3c3730',
    '--border': '#443e36', '--border-emphasis': '#585048',
    '--text-primary': '#e8e6e2', '--text-secondary': '#a8a49c',
    '--text-dim': '#6a6458', '--text-bright': '#ffffff',
    '--accent': '#E8922E', '--accent-hover': '#c47a24',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#b0a8a0',
    '--wf-bg-white': '#24201a', '--wf-bg-black': '#1c1814', '--wf-grid-line': '#3a3428',
    '--harmonic-start': '#E8922E', '--harmonic-end': '#E8CC40',
    '--harmonic-grid': '#4a4236', '--harmonic-modified': '#f0d050',
    '--success': '#4EDE83', '--color-error': '#e94560',
    '--color-warning': '#e6c84a', '--primary': '#AA7030',
  },
  'Vermillion': {
    '--bg-app': '#1e1a18', '--bg-titlebar': '#171312', '--bg-panel': '#26211e',
    '--bg-panel-hover': '#302a26', '--bg-panel-light': '#3c3430',
    '--border': '#443a36', '--border-emphasis': '#584e48',
    '--text-primary': '#e8e5e2', '--text-secondary': '#a8a09c',
    '--text-dim': '#6a5e56', '--text-bright': '#ffffff',
    '--accent': '#E8603C', '--accent-hover': '#c44e30',
    '--wf-white-key': '#ffffff', '--wf-black-key': '#000000',
    '--wf-grid': '#ffffff', '--wf-label': '#b0a4a0',
    '--wf-bg-white': '#241e1a', '--wf-bg-black': '#1c1614', '--wf-grid-line': '#3a2e28',
    '--harmonic-start': '#E8603C', '--harmonic-end': '#E8C040',
    '--harmonic-grid': '#4a3836', '--harmonic-modified': '#f0d060',
    '--success': '#4EDE83', '--color-error': '#ff5040',
    '--color-warning': '#e6c84a', '--primary': '#AA4830',
  },
};

// ── HSV utilities ─────────────────────────────────────────────────────────────

function hsvToHex(h, s, v) {
  h = h / 360;
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
    default: r = v; g = t; b = p;
  }
  const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function generateThemeFromHue(hue, saturation = 0.6, brightness = 0.85) {
  const accent      = hsvToHex(hue, saturation, brightness);
  const accentHover = hsvToHex(hue, saturation * 0.8, Math.min(brightness * 1.15, 1.0));
  const harmEnd     = hsvToHex((hue + 120) % 360, saturation * 0.9, Math.min(brightness * 1.1, 1.0));
  const primary     = hsvToHex(hue, Math.min(saturation * 1.4, 1.0), brightness * 0.65);
  // Complementary hue for waveform display background
  const compHue     = (hue + 180) % 360;
  return {
    '--bg-app':          hsvToHex(hue, saturation * 0.15, 0.05),
    '--bg-titlebar':     hsvToHex(hue, saturation * 0.15, 0.07),
    '--bg-panel':        hsvToHex(hue, saturation * 0.15, 0.09),
    '--bg-panel-hover':  hsvToHex(hue, saturation * 0.15, 0.12),
    '--bg-panel-light':  hsvToHex(hue, saturation * 0.15, 0.16),
    '--border':          hsvToHex(hue, saturation * 0.20, 0.14),
    '--border-emphasis': hsvToHex(hue, saturation * 0.20, 0.22),
    '--text-primary':    hsvToHex(hue, saturation * 0.08, 0.82),
    '--text-secondary':  hsvToHex(hue, saturation * 0.10, 0.60),
    '--text-dim':        hsvToHex(hue, saturation * 0.12, 0.38),
    '--text-bright':     hsvToHex(hue, saturation * 0.05, 0.92),
    '--accent':          accent,
    '--accent-hover':    accentHover,
    '--wf-white-key':    hsvToHex(hue, saturation * 0.08, 0.82),
    '--wf-black-key':    hsvToHex(hue, saturation * 0.15, 0.04),
    '--wf-grid':         accent,
    '--wf-label':        hsvToHex(hue, saturation * 0.10, 0.60),
    '--wf-bg-white':     hsvToHex(compHue, saturation * 0.25, 0.12),
    '--wf-bg-black':     hsvToHex(compHue, saturation * 0.30, 0.09),
    '--wf-grid-line':    hsvToHex(compHue, saturation * 0.20, 0.22),
    '--harmonic-start':  accent,
    '--harmonic-end':    harmEnd,
    '--harmonic-grid':   hsvToHex(hue, saturation * 0.20, 0.22),
    '--harmonic-modified': '#ffb340',
    '--success':         '#4EDE83',
    '--color-error':     '#e94560',
    '--color-warning':   '#e6c84a',
    '--primary':         primary,
  };
}

// ── Apply theme to CSS custom properties ──────────────────────────────────────

function applyTheme(values) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(values)) {
    root.style.setProperty(name, value);
  }
  // Derived accent variants
  const accent = values['--accent'] || '#33CED6';
  root.style.setProperty('--accent-subtle', accent + '15');
  root.style.setProperty('--accent-border', accent + '33');
  root.style.setProperty('--accent-glow',   accent + '55');
  root.style.setProperty('--accent-active', values['--accent-hover'] || '#26a8b0');
  root.style.setProperty('--accent-dim',    values['--accent-hover'] || '#26a8b0');
  // Legacy aliases for older components
  if (values['--bg-app'])       root.style.setProperty('--bg-dark',     values['--bg-app']);
  if (values['--bg-titlebar'])  root.style.setProperty('--bg-titlebar', values['--bg-titlebar']);
  if (values['--text-primary']) root.style.setProperty('--text',        values['--text-primary']);
  invalidateThemeCache();
}

// ── Read all theme variable values from the live DOM ─────────────────────────

function readCurrentValues() {
  const style = getComputedStyle(document.documentElement);
  const values = {};
  for (const name of ALL_VAR_NAMES) {
    values[name] = style.getPropertyValue(name).trim();
  }
  return values;
}

function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'custom-theme';
}

// ── Swatch row (10-color preview) ─────────────────────────────────────────────

function SwatchRow({ values }) {
  const keys = [
    '--bg-app', '--bg-panel', '--bg-panel-light', '--border', '--border-emphasis',
    '--text-primary', '--text-secondary', '--text-dim', '--accent', '--accent-hover',
  ];
  return (
    <div className="te2-swatch-row">
      {keys.map((k) => (
        <div
          key={k}
          className="te2-swatch-preview"
          style={{ background: values[k] || '#000' }}
          title={k}
        />
      ))}
    </div>
  );
}

// ── Hue strip canvas ──────────────────────────────────────────────────────────

function HueStrip({ hue, onChange }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    for (let x = 0; x < w; x++) {
      ctx.fillStyle = `hsl(${(x / w) * 360}, 100%, 50%)`;
      ctx.fillRect(x, 0, 1, h);
    }
  }, []);

  const handleInteraction = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    onChange((x / rect.width) * 360);
  }, [onChange]);

  const handlePointerDown = useCallback((e) => {
    handleInteraction(e);
    const move = (ev) => handleInteraction(ev);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [handleInteraction]);

  return (
    <div className="te2-hue-strip-wrap">
      <canvas
        ref={canvasRef}
        className="te2-hue-strip"
        width={360}
        height={24}
        onPointerDown={handlePointerDown}
      />
      <div className="te2-hue-marker" style={{ left: `${(hue / 360) * 100}%` }} />
    </div>
  );
}

// ── Simple mode panel ─────────────────────────────────────────────────────────

function SimpleMode({ values, onValuesChange, simpleState, onSimpleStateChange }) {
  const { t } = useTranslation();
  const handleHueChange = useCallback((h) => {
    const next = { ...simpleState, hue: h };
    onSimpleStateChange(next);
    onValuesChange(generateThemeFromHue(next.hue, next.saturation, next.brightness));
  }, [simpleState, onSimpleStateChange, onValuesChange]);

  const handleSatChange = useCallback((e) => {
    const s = Number(e.target.value);
    const next = { ...simpleState, saturation: s };
    onSimpleStateChange(next);
    onValuesChange(generateThemeFromHue(next.hue, next.saturation, next.brightness));
  }, [simpleState, onSimpleStateChange, onValuesChange]);

  const handleBriChange = useCallback((e) => {
    const b = Number(e.target.value);
    const next = { ...simpleState, brightness: b };
    onSimpleStateChange(next);
    onValuesChange(generateThemeFromHue(next.hue, next.saturation, next.brightness));
  }, [simpleState, onSimpleStateChange, onValuesChange]);

  return (
    <div className="te2-simple">
      <div className="te2-simple-section">
        <label className="te2-simple-label">{t('electron.theme.hue')} ({Math.round(simpleState.hue)}°)</label>
        <HueStrip hue={simpleState.hue} onChange={handleHueChange} />
      </div>
      <div className="te2-simple-section">
        <label className="te2-simple-label">{t('electron.theme.saturation')} ({Math.round(simpleState.saturation * 100)}%)</label>
        <input
          type="range" className="te2-slider"
          min={0.1} max={1.0} step={0.01}
          value={simpleState.saturation}
          onChange={handleSatChange}
        />
      </div>
      <div className="te2-simple-section">
        <label className="te2-simple-label">{t('electron.theme.brightness')} ({Math.round(simpleState.brightness * 100)}%)</label>
        <input
          type="range" className="te2-slider"
          min={0.4} max={1.0} step={0.01}
          value={simpleState.brightness}
          onChange={handleBriChange}
        />
      </div>
      <SwatchRow values={values} />
    </div>
  );
}

// ── Advanced mode panel ───────────────────────────────────────────────────────

function AdvancedMode({ values, onColorChange, onSetValues }) {
  const { t } = useTranslation();
  return (
    <div className="te2-adv-body">
      {THEME_GROUPS.map((group) => (
        <div key={group.labelKey} className="te2-adv-group">
          <div className="te2-adv-group-label">{t(group.labelKey)}</div>
          {group.vars.map((v) => (
            <div key={v.name} className="te2-adv-row">
              <label className="te2-adv-row-label">{t(v.labelKey)}</label>
              <div className="te2-swatch-wrap">
                <input
                  type="color"
                  className="te2-color-input"
                  value={/^#[0-9a-fA-F]{6}$/.test(values[v.name] || '') ? values[v.name] : '#000000'}
                  onChange={(e) => onColorChange(v.name, e.target.value)}
                />
                <span
                  className="te2-swatch"
                  style={{ background: /^#[0-9a-fA-F]{6}$/.test(values[v.name] || '') ? values[v.name] : '#000000' }}
                />
              </div>
              <input
                type="text"
                className="te2-hex-input"
                value={values[v.name] || ''}
                onChange={(e) => {
                  const hex = e.target.value;
                  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
                    onColorChange(v.name, hex);
                  } else {
                    onSetValues((prev) => ({ ...prev, [v.name]: hex }));
                  }
                }}
                onBlur={(e) => {
                  if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                    onColorChange(v.name, e.target.value);
                  }
                }}
                spellCheck={false}
                maxLength={7}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Save-as dialog ────────────────────────────────────────────────────────────

function SaveDialog({ onSave, onCancel }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="te2-save-dialog">
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }}>
        <label className="te2-simple-label">{t('theme.name')}</label>
        <input
          ref={inputRef}
          type="text"
          className="te2-hex-input"
          style={{ width: '100%', marginBottom: 8 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('electron.theme.my_custom_theme')}
          spellCheck={false}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="te2-btn te2-btn--ghost" onClick={onCancel}>{t('theme.button.close')}</button>
          <button type="submit" className="te2-btn te2-btn--primary" disabled={!name.trim()}>{t('theme.button.save')}</button>
        </div>
      </form>
    </div>
  );
}

// ── Main ThemeEditor component ────────────────────────────────────────────────

export default function ThemeEditor({ isOpen, onClose, showToast, embedded = false, active = false }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('simple');
  const [values, setValues] = useState({});
  const [simpleState, setSimpleState] = useState({ hue: 200, saturation: 0.6, brightness: 0.85 });
  const [selectedPreset, setSelectedPreset] = useState('Default');
  const [userThemes, setUserThemes] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const presetNames = useMemo(() => Object.keys(PRESET_THEMES), []);

  // Load current CSS values and user theme list when editor opens or tab becomes active
  const openTrigger = embedded ? active : isOpen;
  useEffect(() => {
    if (!openTrigger) return;
    setValues(readCurrentValues());
    setShowSaveDialog(false);
    window.electronAPI?.themesList?.().then((files) => {
      if (Array.isArray(files)) setUserThemes(files);
    }).catch(() => {});
  }, [openTrigger]);

  const handleColorChange = useCallback((varName, newValue) => {
    setValues((prev) => {
      const next = { ...prev, [varName]: newValue };
      applyTheme(next);
      return next;
    });
    setSelectedPreset(null);
  }, []);

  const handleSimpleValuesChange = useCallback((generated) => {
    setValues(generated);
    applyTheme(generated);
    setSelectedPreset(null);
  }, []);

  const handlePreset = useCallback((presetName) => {
    const preset = PRESET_THEMES[presetName];
    if (!preset) return;
    setSelectedPreset(presetName);
    setValues({ ...preset });
    applyTheme(preset);
    setMode('simple');
    setSimpleState({ hue: 200, saturation: 0.6, brightness: 0.85 });
  }, []);

  const handleLoadUserTheme = useCallback(async (filename) => {
    try {
      const theme = await window.electronAPI?.themesLoadFile?.(filename);
      if (!theme?.variables) return;
      setValues(theme.variables);
      applyTheme(theme.variables);
      setSelectedPreset(filename);
      if (theme.mode === 'simple' && theme.simpleHue != null) {
        setMode('simple');
        setSimpleState({
          hue: theme.simpleHue,
          saturation: theme.simpleSaturation ?? 0.6,
          brightness: theme.simpleBrightness ?? 0.85,
        });
      } else {
        setMode('advanced');
      }
    } catch {
      showToast?.(t('electron.toast.theme_load_failed'), 'error', 3000);
    }
  }, [showToast, t]);

  const handleReset = useCallback(() => {
    handlePreset('Default');
  }, [handlePreset]);

  const handleApply = useCallback(async () => {
    try {
      const themeData = {
        name: selectedPreset || 'Custom',
        version: 1,
        mode,
        ...(mode === 'simple' ? {
          simpleHue: simpleState.hue,
          simpleSaturation: simpleState.saturation,
          simpleBrightness: simpleState.brightness,
        } : {}),
        variables: values,
      };
      await window.electronAPI?.themesSave?.(themeData);
      showToast?.(t('electron.toast.theme_applied'), 'success', 2500);
    } catch {
      showToast?.(t('electron.toast.theme_save_failed'), 'error', 3000);
    }
  }, [values, mode, simpleState, selectedPreset, showToast, t]);

  const handleSaveAs = useCallback(async (name) => {
    try {
      const filename = sanitizeFilename(name) + '.json';
      const themeData = {
        name,
        version: 1,
        mode,
        ...(mode === 'simple' ? {
          simpleHue: simpleState.hue,
          simpleSaturation: simpleState.saturation,
          simpleBrightness: simpleState.brightness,
        } : {}),
        variables: values,
      };
      await window.electronAPI?.themesSaveFile?.(filename, themeData);
      await window.electronAPI?.themesSave?.(themeData);
      setShowSaveDialog(false);
      showToast?.(t('electron.toast.theme_saved', { name }), 'success', 2500);
      const files = await window.electronAPI?.themesList?.();
      if (Array.isArray(files)) setUserThemes(files);
      setSelectedPreset(filename);
    } catch {
      showToast?.(t('electron.toast.theme_file_save_failed'), 'error', 3000);
    }
  }, [values, mode, simpleState, showToast, t]);

  const handleLoadFile = useCallback(async () => {
    try {
      const theme = await window.electronAPI?.themesDialog?.();
      if (!theme?.variables) return;
      setValues(theme.variables);
      applyTheme(theme.variables);
      setSelectedPreset(null);
      if (theme.mode === 'simple' && theme.simpleHue != null) {
        setMode('simple');
        setSimpleState({
          hue: theme.simpleHue,
          saturation: theme.simpleSaturation ?? 0.6,
          brightness: theme.simpleBrightness ?? 0.85,
        });
      } else {
        setMode('advanced');
      }
    } catch {
      showToast?.(t('electron.toast.theme_file_load_failed'), 'error', 3000);
    }
  }, [showToast, t]);

  const handleOpenFolder = useCallback(() => {
    window.electronAPI?.themesOpenFolder?.();
  }, []);

  // Escape key — standalone modal only; embedded mode lets the host dialog handle it
  useEffect(() => {
    if (embedded || !isOpen) return;
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose, embedded]);

  if (!embedded && !isOpen) return null;

  // Inner content is shared between the standalone modal and the embedded panel
  const innerContent = (
    <>
      {/* Mode tabs */}
      <div className="te2-tabs">
        <button
          className={`te2-tab${mode === 'simple' ? ' te2-tab--active' : ''}`}
          onClick={() => setMode('simple')}
        >
          {t('electron.theme.simple')}
        </button>
        <button
          className={`te2-tab${mode === 'advanced' ? ' te2-tab--active' : ''}`}
          onClick={() => { setMode('advanced'); setValues(readCurrentValues()); }}
        >
          {t('electron.theme.advanced')}
        </button>
      </div>

      {/* Preset chips */}
      <div className="te2-presets">
        <span className="te2-presets-label">{t('theme.preset')}</span>
        {presetNames.map((name) => (
          <button
            key={name}
            className={`te2-preset-btn${selectedPreset === name ? ' te2-preset-btn--active' : ''}`}
            onClick={() => handlePreset(name)}
          >
            {name}
          </button>
        ))}
        {userThemes.map((filename) => (
          <button
            key={filename}
            className={`te2-preset-btn te2-preset-btn--user${selectedPreset === filename ? ' te2-preset-btn--active' : ''}`}
            onClick={() => handleLoadUserTheme(filename)}
            title={filename}
          >
            {filename.replace(/\.json$/, '').replace(/-/g, ' ')}
          </button>
        ))}
      </div>

      {/* Mode content */}
      {mode === 'simple' ? (
        <SimpleMode
          values={values}
          onValuesChange={handleSimpleValuesChange}
          simpleState={simpleState}
          onSimpleStateChange={setSimpleState}
        />
      ) : (
        <AdvancedMode
          values={values}
          onColorChange={handleColorChange}
          onSetValues={setValues}
        />
      )}

      {/* Save dialog overlay */}
      {showSaveDialog && (
        <SaveDialog
          onSave={handleSaveAs}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}

      {/* Footer */}
      <div className="te2-footer">
        <div className="te2-footer-left">
          <button className="te2-btn te2-btn--ghost" onClick={handleReset}>{t('harmonic.button.reset_all')}</button>
          <button className="te2-btn te2-btn--ghost" onClick={handleOpenFolder} title={t('electron.theme.open_themes_folder')}>{t('electron.theme.folder')}</button>
        </div>
        <div className="te2-footer-right">
          <button className="te2-btn" onClick={handleLoadFile}>{t('theme.button.load')}...</button>
          <button className="te2-btn" onClick={() => setShowSaveDialog(true)}>{t('theme.button.save')}...</button>
          <button className="te2-btn te2-btn--primary" onClick={handleApply}>{t('theme.button.apply')}</button>
        </div>
      </div>
    </>
  );

  // ── Embedded mode — no backdrop/card, renders inline in a panel container
  if (embedded) {
    return <div className="te2-panel">{innerContent}</div>;
  }

  // ── Standalone modal mode — full-screen backdrop + card
  return (
    <div className="te2-backdrop" onClick={onClose}>
      <div className="te2-card" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="te2-header">
          <h3 className="te2-title">{t('theme.title')}</h3>
          <button className="te2-close" onClick={onClose}>×</button>
        </div>

        {innerContent}

      </div>
    </div>
  );
}

/**
 * Apply saved theme on app startup.
 * Call once in App.jsx useEffect on mount.
 */
export async function loadSavedTheme() {
  try {
    const theme = await window.electronAPI?.themesLoad?.();
    if (theme?.variables && typeof theme.variables === 'object' && Object.keys(theme.variables).length > 0) {
      applyTheme(theme.variables);
    }
  } catch {
    // Use CSS defaults
  }
}
