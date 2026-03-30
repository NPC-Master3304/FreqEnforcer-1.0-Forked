import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ToggleSwitch from './controls/ToggleSwitch';
import ThemeEditor from './ThemeEditor';
import './PreferencesDialog.css';

// ── PreferencesDialog ─────────────────────────────────────────────────────────
// Modeless side-panel that slides in from the right.
// The semi-transparent backdrop has pointer-events: none so the main app
// remains fully interactive while the panel is open.

export default function PreferencesDialog({
  isOpen,
  onClose,
  options,
  onOptionsChange,
  showToast,
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('preferences');
  const panelRef = useRef(null);

  // Escape key closes the dialog
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  function setOption(key, value) {
    onOptionsChange({ ...options, [key]: value });
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Non-blocking backdrop — pointer-events: none lets clicks through */}
      <div className="prefs-backdrop" aria-hidden="true" />

      {/* Panel */}
      <div
        className="prefs-panel"
        ref={panelRef}
        role="dialog"
        aria-label={t('preferences.title')}
      >
        {/* Title bar */}
        <div className="prefs-header">
          <span className="prefs-title">{t('preferences.title')}</span>
          <button className="prefs-close" onClick={onClose} title={t('electron.titlebar.close')}>
            ×
          </button>
        </div>

        {/* Tab bar */}
        <div className="prefs-tabs">
          <button
            className={`prefs-tab${activeTab === 'preferences' ? ' prefs-tab--active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            {t('preferences.tabs.preferences')}
          </button>
          <button
            className={`prefs-tab${activeTab === 'theme' ? ' prefs-tab--active' : ''}`}
            onClick={() => setActiveTab('theme')}
          >
            {t('preferences.tabs.theme')}
          </button>
        </div>

        {/* Content */}
        <div className="prefs-content">

          {/* ── Preferences tab ── */}
          <div className={`prefs-pref-tab${activeTab !== 'preferences' ? ' prefs-tab-hidden' : ''}`}>

            <div className="prefs-section-label">{t('preferences.section.general')}</div>

            {/* Show Loading Dialog */}
            <div className="prefs-row">
              <div className="prefs-row-info">
                <span className="prefs-row-label">{t('preferences.show_loading_dialog.label')}</span>
                <span className="prefs-row-desc">{t('preferences.show_loading_dialog.desc')}</span>
              </div>
              <ToggleSwitch
                checked={options.show_loading_dialog}
                onChange={(v) => setOption('show_loading_dialog', v)}
              />
            </div>

            {/* Performance Mode */}
            <div className="prefs-row">
              <div className="prefs-row-info">
                <span className="prefs-row-label">{t('preferences.performance_mode.label')}</span>
                <span className="prefs-row-desc">{t('preferences.performance_mode.desc')}</span>
              </div>
              <ToggleSwitch
                checked={options.performance_mode}
                onChange={(v) => setOption('performance_mode', v)}
              />
            </div>

            {/* Warm Up Audio Engine */}
            <div className="prefs-row">
              <div className="prefs-row-info">
                <span className="prefs-row-label">{t('preferences.warmup_enabled.label')}</span>
                <span className="prefs-row-desc">{t('preferences.warmup_enabled.desc')}</span>
              </div>
              <ToggleSwitch
                checked={options.warmup_enabled}
                onChange={(v) => setOption('warmup_enabled', v)}
              />
            </div>

            <div className="prefs-divider" />

            <div className="prefs-section-label">{t('preferences.section.display')}</div>

            {/* Note Notation */}
            <div className="prefs-row">
              <div className="prefs-row-info">
                <span className="prefs-row-label">{t('preferences.note_notation.label')}</span>
                <span className="prefs-row-desc">{t('preferences.note_notation.desc')}</span>
              </div>
              <div className="prefs-segmented">
                <button
                  className={`prefs-seg-btn${options.note_notation === 'sharps' ? ' prefs-seg-btn--active' : ''}`}
                  onClick={() => setOption('note_notation', 'sharps')}
                >
                  {t('preferences.note_notation.sharps')}
                </button>
                <button
                  className={`prefs-seg-btn${options.note_notation === 'flats' ? ' prefs-seg-btn--active' : ''}`}
                  onClick={() => setOption('note_notation', 'flats')}
                >
                  {t('preferences.note_notation.flats')}
                </button>
              </div>
            </div>

          </div>

          {/* ── Theme tab ── */}
          {/* Always mounted so ThemeEditor state is preserved across tab switches */}
          <div className={`prefs-theme-tab${activeTab !== 'theme' ? ' prefs-tab-hidden' : ''}`}>
            <ThemeEditor
              isOpen={false}
              onClose={() => {}}
              showToast={showToast}
              embedded
              active={activeTab === 'theme' && isOpen}
            />
          </div>

        </div>
      </div>
    </>
  );
}
