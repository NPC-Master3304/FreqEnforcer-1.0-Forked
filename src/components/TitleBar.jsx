import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './TitleBar.css';

// ---------------------------------------------------------------------------
// Menu definitions — built inside the component so t() is available
// ---------------------------------------------------------------------------

const LANG_ITEMS = [
  { id: 'lang-en',   code: 'en',    nativeLabel: 'English' },
  { id: 'lang-es',   code: 'es',    nativeLabel: 'Español' },
  { id: 'lang-pt',   code: 'pt_BR', nativeLabel: 'Português (Brasil)' },
  { id: 'lang-ja',   code: 'ja',    nativeLabel: '日本語' },
  { id: 'lang-ru',   code: 'ru',    nativeLabel: 'Русский' },
];

// ---------------------------------------------------------------------------
// TitleBar
// ---------------------------------------------------------------------------

export default function TitleBar({
  sampleName, sampleMeta, peakDb, rmsDb,
  onABToggle, onPlay, isPlaying, abMode,
  onNewSample, onRefreshSample, audioLoaded,
  isProcessing, processingProgress,
  onOpenPreferences,
  onExport, onQuickExport, onMultiSample,
}) {
  const { t, i18n } = useTranslation();

  const [openMenu, setOpenMenu]       = useState(null); // 'file' | 'options' | null
  const [isMaximized, setIsMaximized] = useState(false);
  const [langSubmenuOpen, setLangSubmenuOpen] = useState(false);
  const [menuPos, setMenuPos]         = useState({ x: 0, y: 36 });

  const titleBarRef = useRef(null);
  const menuRef     = useRef(null);

  // ── Maximize state sync ──────────────────────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.isMaximized().then(setIsMaximized).catch(() => {});

    const cleanup = api.onMaximizeChange
      ? api.onMaximizeChange((maximized) => setIsMaximized(maximized))
      : null;

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  // ── Click-outside to close menu ──────────────────────────────────────────
  useEffect(() => {
    if (!openMenu) return;

    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
        setLangSubmenuOpen(false);
      }
    }

    function handleEscape(e) {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setLangSubmenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutside, true);
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [openMenu]);

  // ── Menu toggle helper ───────────────────────────────────────────────────
  const toggleMenu = useCallback((name, buttonEl) => {
    if (openMenu === name) {
      setOpenMenu(null);
      setLangSubmenuOpen(false);
      return;
    }
    if (buttonEl) {
      const rect = buttonEl.getBoundingClientRect();
      setMenuPos({ x: rect.left, y: rect.bottom });
    }
    setOpenMenu(name);
    setLangSubmenuOpen(false);
  }, [openMenu]);

  // ── Menu item click ──────────────────────────────────────────────────────
  const handleMenuAction = useCallback((id) => {
    setOpenMenu(null);
    setLangSubmenuOpen(false);

    switch (id) {
      case 'quit':
        window.electronAPI?.closeWindow();
        break;
      case 'new-sample':
        onNewSample?.();
        break;
      case 'refresh':
        if (audioLoaded) onRefreshSample?.();
        break;
      case 'preferences':
        onOpenPreferences?.();
        break;
      case 'export-wav':
        onExport?.();
        break;
      case 'quick-export':
        onQuickExport?.();
        break;
      case 'multi-sample':
        onMultiSample?.();
        break;
      default:
        if (id.startsWith('lang-')) {
          const item = LANG_ITEMS.find((l) => l.id === id);
          if (item) i18n.changeLanguage(item.code);
        }
    }
  }, [onNewSample, onRefreshSample, audioLoaded, onOpenPreferences, onExport, onQuickExport, onMultiSample]);

  // ── Title bar double-click ───────────────────────────────────────────────
  function handleTitleBarDblClick(e) {
    if (e.target !== e.currentTarget && e.target.closest('.tb-no-drag')) return;
    window.electronAPI?.maximizeWindow();
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  function renderMenuItems(items, source) {
    return items.map((item, i) => {
      if (item.type === 'separator') {
        return <div key={`sep-${i}`} className="tb-menu-sep" />;
      }

      if (item.submenu) {
        return (
          <div
            key={item.id}
            className="tb-menu-item tb-has-submenu"
            onMouseEnter={() => setLangSubmenuOpen(true)}
            onMouseLeave={() => setLangSubmenuOpen(false)}
          >
            <span>{item.label}</span>
            <span className="tb-menu-arrow">›</span>
            {langSubmenuOpen && (
              <div className="tb-submenu">
                {item.submenu.map((sub) => (
                  <div
                    key={sub.id}
                    className="tb-menu-item"
                    onMouseDown={(e) => { e.stopPropagation(); handleMenuAction(sub.id); }}
                  >
                    {sub.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      const disabled = item.enabled === false;
      return (
        <div
          key={item.id}
          className={`tb-menu-item${disabled ? ' tb-menu-item--disabled' : ''}`}
          onMouseDown={disabled ? undefined : (e) => { e.stopPropagation(); handleMenuAction(item.id); }}
        >
          <span>{item.label}</span>
          {item.shortcut && <span className="tb-menu-shortcut">{item.shortcut}</span>}
        </div>
      );
    });
  }

  // ── Build menus with translated labels ────────────────────────────────────
  const FILE_MENU = [
    { id: 'new-sample', label: t('ui.menu.file_new_sample'),     shortcut: 'Ctrl+N', enabled: true },
    { id: 'refresh',    label: t('ui.menu.file_refresh_sample'), shortcut: 'Ctrl+R', enabled: Boolean(audioLoaded) },
    { type: 'separator' },
    { id: 'quit',       label: t('ui.menu.file_quit'),           shortcut: 'Ctrl+Q', enabled: true },
  ];

  const EXPORT_MENU = [
    { id: 'export-wav',   label: t('settings.button.export_wav'),          shortcut: 'Ctrl+Shift+E', enabled: Boolean(audioLoaded) },
    { id: 'quick-export', label: t('settings.button.quick_export'),         shortcut: 'Ctrl+E',       enabled: Boolean(audioLoaded) },
    { id: 'multi-sample', label: t('settings.button.multi_sample_export'),  shortcut: 'Ctrl+M',       enabled: Boolean(audioLoaded) },
  ];

  const OPTIONS_MENU = [
    {
      id: 'language',
      label: t('ui.menu.language'),
      submenu: LANG_ITEMS.map((l) => ({
        ...l,
        label: `${i18n.language === l.code ? '✓ ' : '   '}${l.nativeLabel}`,
      })),
    },
    { type: 'separator' },
    { id: 'preferences', label: t('electron.titlebar.preferences'), shortcut: 'Ctrl+,', enabled: true },
  ];

  // ── Info ─────────────────────────────────────────────────────────────────
  const hasSample = Boolean(sampleName);
  const peakStr   = peakDb  != null && Number.isFinite(peakDb) ? `${peakDb.toFixed(1)} dB`  : '---';
  const rmsStr    = rmsDb   != null && Number.isFinite(rmsDb)  ? `${rmsDb.toFixed(1)} dB`   : '---';
  const maxIcon   = isMaximized ? '❐' : '□';

  return (
    <div
      className="tb-root"
      ref={titleBarRef}
      onDoubleClick={handleTitleBarDblClick}
    >
      {/* ── Left: menus ── */}
      <div className="tb-left tb-no-drag">
        {/* File menu */}
        <button
          className={`tb-menu-btn${openMenu === 'file' ? ' tb-menu-btn--active' : ''}`}
          onMouseDown={(e) => { e.stopPropagation(); toggleMenu('file', e.currentTarget); }}
        >
          {t('ui.menu.file')}
        </button>

        {/* Export menu */}
        <button
          className={`tb-menu-btn${openMenu === 'export' ? ' tb-menu-btn--active' : ''}`}
          onMouseDown={(e) => { e.stopPropagation(); toggleMenu('export', e.currentTarget); }}
        >
          Export
        </button>

        {/* Options menu */}
        <button
          className={`tb-menu-btn${openMenu === 'options' ? ' tb-menu-btn--active' : ''}`}
          onMouseDown={(e) => { e.stopPropagation(); toggleMenu('options', e.currentTarget); }}
        >
          {t('ui.menu.options')}
        </button>
      </div>

      {/* ── Center: processing state or file info ── */}
      <div className="tb-center">
        {isProcessing ? (
          <div className="tb-processing-wrap">
            <div className="tb-processing-row">
              <span className="tb-processing-label">{t('electron.titlebar.processing')}</span>
              {processingProgress > 0 && processingProgress < 100 && (
                <span className="tb-processing-pct">{processingProgress}%</span>
              )}
            </div>
            <div className="tb-processing-track">
              {processingProgress > 0 && processingProgress < 100 ? (
                <div className="tb-processing-fill" style={{ width: `${processingProgress}%` }} />
              ) : (
                <div className="tb-processing-fill tb-processing-fill--indeterminate" />
              )}
            </div>
          </div>
        ) : hasSample ? (
          <>
            <span className="tb-sample-name">{sampleName}</span>
            {sampleMeta && <span className="tb-sample-meta">{sampleMeta}</span>}
          </>
        ) : (
          <span className="tb-no-sample">{t('electron.titlebar.no_sample')}</span>
        )}
      </div>

      {/* ── Right: meters + controls + window buttons ── */}
      <div className="tb-right tb-no-drag">
        <span className="tb-meters">
          Peak: {peakStr} &nbsp;|&nbsp; RMS: {rmsStr}
        </span>

        <button
          className={`tb-ab-toggle${abMode === 'processed' ? ' tb-ab-toggle--active' : ''}`}
          onClick={onABToggle}
          title={`${t('electron.titlebar.toggle_ab')} (A)`}
        >
          {abMode === 'processed' ? t('main.waveform.processed') : t('main.waveform.original')}
        </button>

        <button
          className={`tb-play-btn${isPlaying ? ' tb-play-btn--playing' : ''}`}
          onClick={onPlay}
          title={`${isPlaying ? t('main.button.stop') : t('main.button.play')} (Space)`}
        >
          {isPlaying ? '■' : '▶'}
        </button>

        {/* Window controls */}
        <button className="tb-wc tb-wc--min" onClick={() => window.electronAPI?.minimizeWindow()} title={t('electron.titlebar.minimize')}>─</button>
        <button className="tb-wc tb-wc--max" onClick={() => window.electronAPI?.maximizeWindow()} title={isMaximized ? t('electron.titlebar.restore') : t('electron.titlebar.maximize')}>{maxIcon}</button>
        <button className="tb-wc tb-wc--close" onClick={() => window.electronAPI?.closeWindow()} title={t('electron.titlebar.close')}>×</button>
      </div>

      {/* ── Dropdown menus (fixed position) ── */}
      {openMenu && (
        <div
          className={`tb-dropdown tb-dropdown--${openMenu === 'file' ? 'entering' : 'entering'}`}
          ref={menuRef}
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          {openMenu === 'file'    && renderMenuItems(FILE_MENU,    'file')}
          {openMenu === 'export'  && renderMenuItems(EXPORT_MENU,  'export')}
          {openMenu === 'options' && renderMenuItems(OPTIONS_MENU, 'options')}
        </div>
      )}
    </div>
  );
}
