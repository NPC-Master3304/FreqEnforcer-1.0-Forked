import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import MiniPiano from './controls/MiniPiano';
import KnobControl from './controls/KnobControl';
import SliderControl from './controls/SliderControl';
import CleanlinessPopup from './CleanlinessPopup';
import {
  NOTE_NAMES_SHARP,
  NOTE_NAMES_FLAT,
  noteNameToPC,
  toMidi,
  midiToFreq,
  formatFreq,
} from '../utils/note_utils';
import './SettingsPanel.css';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STRETCH_METHOD_KEYS = [
  'audiotsm_wsola',
  'audiotsm_ola',
  'audiotsm_phasevocoder',
  'rubberband_default_engine_faster',
  'rubberband_default_engine_finer',
  'rubberband_percussive_engine_finer',
  'tdpsola',
];

// Modes that show Correction Amount / Retune Speed / Preserve Vibrato controls
// (everything except world_hard, which does a hard snap)
const SOFT_MODES = new Set([
  'world_soft', 'praat_soft', 'world_vt', 'world_hnm',
  'sine_spectral', 'stft_pitchshift',
]);

const PITCH_MODE_LAYOUT = [
  {
    groupKey: 'settings.pitch_mode.group_world',
    modes: ['world_hard', 'world_soft', 'world_vt', 'world_hnm'],
  },
  {
    groupKey: 'settings.pitch_mode.group_psola',
    modes: ['praat_soft'],
  },
  {
    groupKey: 'settings.pitch_mode.group_experimental',
    modes: ['sine_spectral', 'stft_pitchshift'],
  },
];

function buildPitchModeGroups(t) {
  return PITCH_MODE_LAYOUT.map((g) => ({
    label: t(g.groupKey),
    modes: g.modes.map((m) => ({
      value: m,
      label: t(`settings.pitch_mode.${m}.label`),
      desc:  t(`settings.pitch_mode.${m}.info`),
    })),
  }));
}

function buildStretchMethodItems(t) {
  return STRETCH_METHOD_KEYS.map((key) => ({
    value: key,
    label: t(`settings.stretch_method.${key}.label`),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible Section
// Fixed: height is managed 100% imperatively via useLayoutEffect so React's
// re-render never overwrites the CSS transition mid-flight.
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, defaultOpen = true, bodyClassName, children }) {
  // openRef drives behaviour; chevronOpen drives the chevron glyph re-render only
  const openRef      = useRef(defaultOpen);
  const [chevronOpen, setChevronOpen] = useState(defaultOpen);
  const bodyRef      = useRef(null);

  // Set initial height before first paint — no React style prop needed
  useLayoutEffect(() => {
    if (!openRef.current && bodyRef.current) {
      bodyRef.current.style.height = '0px';
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    const body = bodyRef.current;
    if (!body) return;

    const opening = !openRef.current;
    openRef.current = opening;
    setChevronOpen(opening); // triggers re-render for chevron glyph only

    if (opening) {
      // Expand: 0 → scrollHeight, then clear to '' so content can reflow freely
      body.style.height = body.scrollHeight + 'px';
      body.addEventListener(
        'transitionend',
        () => { if (openRef.current) body.style.height = ''; },
        { once: true },
      );
    } else {
      // Collapse: pin to scrollHeight (so transition has a known start), then → 0
      body.style.height = body.scrollHeight + 'px';
      body.offsetHeight; // force reflow so the pin is painted
      body.style.height = '0px';
    }
  }

  return (
    <div className="sp-section">
      <button className="sp-section-header" onClick={toggle} type="button">
        <span className="sp-chevron">{chevronOpen ? '▾' : '▸'}</span>
        {title}
      </button>
      {/* No style prop — height managed 100% imperatively to avoid React overwrite */}
      <div ref={bodyRef} className="sp-section-body-wrap">
        <div className={`sp-section-body${bodyClassName ? ' ' + bodyClassName : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated Reveal — smooth conditional show/hide
// Same imperative-only pattern as Section to avoid React style prop conflicts.
// ─────────────────────────────────────────────────────────────────────────────

function Reveal({ visible, children }) {
  const ref        = useRef(null);
  const prevRef    = useRef(visible); // tracks previous value without re-render

  // Initial height set before first paint
  useLayoutEffect(() => {
    if (!visible && ref.current) ref.current.style.height = '0px';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate on every subsequent visibility change
  useLayoutEffect(() => {
    const el  = ref.current;
    if (!el) return;
    const was = prevRef.current;
    if (visible === was) return; // skip on initial mount (already handled above)
    prevRef.current = visible;

    if (visible) {
      el.style.height = el.scrollHeight + 'px';
      el.addEventListener(
        'transitionend',
        () => { el.style.height = ''; },
        { once: true },
      );
    } else {
      el.style.height = el.scrollHeight + 'px';
      el.offsetHeight; // force reflow
      el.style.height = '0px';
    }
  }, [visible]);

  // No style prop — height driven imperatively
  return (
    <div ref={ref} className="sp-reveal">
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Checkbox
// ─────────────────────────────────────────────────────────────────────────────

function Checkbox({ checked, onChange, label }) {
  return (
    <div className="sp-checkbox-row" onClick={() => onChange(!checked)}>
      <div className={`sp-checkbox${checked ? ' sp-checkbox--checked' : ''}`}>
        {checked && <span className="sp-checkbox-tick">✓</span>}
      </div>
      <span className="sp-checkbox-label">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Portal Dropdown — reusable custom dropdown with optional groups & descriptions
// ─────────────────────────────────────────────────────────────────────────────

function PortalDropdown({ value, onChange, items, groups }) {
  const [open, setOpen]     = useState(false);
  const [pos,  setPos]      = useState({ top: 0, left: 0, width: 0, above: false });
  const triggerRef          = useRef(null);
  const listRef             = useRef(null);

  // Flatten items from groups if groups are provided
  const allItems = groups
    ? groups.flatMap((g) => g.modes)
    : items ?? [];
  const selected = allItems.find((m) => m.value === value) ?? allItems[0];

  function openList() {
    const r   = triggerRef.current.getBoundingClientRect();
    const vh  = window.innerHeight;
    const itemH = allItems.some((m) => m.desc) ? 68 : 36;
    const groupH = groups ? groups.length * 28 : 0;
    const listH = allItems.length * itemH + groupH;
    const above = r.bottom + listH > vh - 16 && r.top > listH;
    setPos({
      top:   above ? r.top  - listH - 4 : r.bottom + 4,
      left:  r.left,
      width: r.width,
      above,
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (!listRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown',   onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown',   onKey);
    };
  }, [open]);

  function pick(mode) { onChange(mode); setOpen(false); }

  function renderItem(mode) {
    return (
      <div
        key={mode.value}
        className={`sp-dropdown-item${mode.value === value ? ' sp-dropdown-item--selected' : ''}`}
        onMouseDown={() => pick(mode.value)}
      >
        <div className="sp-dropdown-item-label">{mode.label}</div>
        {mode.desc && <div className="sp-dropdown-item-desc">{mode.desc}</div>}
      </div>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        className={`sp-dropdown-trigger${open ? ' sp-dropdown-trigger--open' : ''}`}
        type="button"
        onClick={open ? () => setOpen(false) : openList}
      >
        <span className="sp-dropdown-trigger-label">{selected?.label ?? ''}</span>
        <span className="sp-dropdown-arrow">{open ? '▴' : '▾'}</span>
      </button>

      {open && createPortal(
        <div
          ref={listRef}
          className={`sp-dropdown-list${pos.above ? ' sp-dropdown-list--above' : ''}`}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {groups ? (
            groups.map((g) => (
              <div key={g.label}>
                <div className="sp-dropdown-group-label">{g.label}</div>
                {g.modes.map(renderItem)}
              </div>
            ))
          ) : (
            allItems.map(renderItem)
          )}
        </div>,
        document.body,
      )}
    </>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// NoteGroup
// ─────────────────────────────────────────────────────────────────────────────

function NoteGroup({ settings, onSettingsChange, detectedPitch, vs }) {
  const { t } = useTranslation();
  const notation    = settings.notation   ?? 'sharps';
  const targetNote  = settings.targetNote ?? 'C';
  const octave      = settings.octave     ?? 4;
  const noteNames   = notation === 'flats' ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const pc          = noteNameToPC(targetNote) ?? 0;
  const freq        = midiToFreq(toMidi(octave, pc));
  const displayNote = noteNames[pc];

  function change(patch) { onSettingsChange({ ...settings, ...patch }); }

  function handlePianoChange(note) {
    const newPc = noteNameToPC(note) ?? 0;
    change({ targetNote: noteNames[newPc] });
  }

  return (
    <Section title={t('settings.group.target_note')} defaultOpen bodyClassName="sp-note-group-body">
      <MiniPiano
        selectedNote={displayNote}
        onNoteChange={handlePianoChange}
        notation={notation}
        vs={vs?.piano}
      />
      <div className="sp-note-row">
        <select
          className="sp-select"
          value={displayNote}
          onChange={(e) => change({ targetNote: e.target.value })}
        >
          {noteNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="sp-octave-wrap">
          <button
            className="sp-octave-btn"
            onClick={() => octave > 2 && change({ octave: octave - 1 })}
            disabled={octave <= 2} type="button" aria-label={t('electron.settings.decrease_octave')}
          >−</button>
          <div className="sp-octave-val">{octave}</div>
          <button
            className="sp-octave-btn"
            onClick={() => octave < 7 && change({ octave: octave + 1 })}
            disabled={octave >= 7} type="button" aria-label={t('electron.settings.increase_octave')}
          >+</button>
        </div>
      </div>
      <div className="sp-target-freq">
        {t('electron.settings.target')} {displayNote}{octave} ({formatFreq(freq)} Hz)
      </div>
      {detectedPitch?.freq_hz != null && (
        <div className="sp-detected-freq">
          {t('electron.settings.detected')} {detectedPitch.note_name ?? '—'} ({formatFreq(detectedPitch.freq_hz)} Hz)
        </div>
      )}
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProcessingGroup
// ─────────────────────────────────────────────────────────────────────────────

function ProcessingGroup({ settings, onSettingsChange, vs, onControlDragStart, onControlRelease }) {
  const { t } = useTranslation();
  const sliderVs = vs?.slider;
  const knobVs   = vs?.knob;

  // Editable stretch factor value
  const [editingStretch, setEditingStretch] = useState(false);
  const [stretchInput, setStretchInput] = useState(
    () => (settings.stretch_factor ?? 1.0).toFixed(2),
  );
  const stretchInputRef = useRef(null);

  // Sync stretchInput when slider drives a change externally
  useEffect(() => {
    if (!editingStretch) setStretchInput((settings.stretch_factor ?? 1.0).toFixed(2));
  }, [settings.stretch_factor, editingStretch]);

  // Auto-focus and select when editing starts
  useEffect(() => {
    if (editingStretch && stretchInputRef.current) {
      stretchInputRef.current.focus();
      stretchInputRef.current.select();
    }
  }, [editingStretch]);

  function change(patch) { onSettingsChange({ ...settings, ...patch }); }

  const pitchMode        = settings.pitch_mode       ?? 'world_hard';
  const breathiness      = settings.breathiness      ?? 1.0;
  const isSoftMode       = SOFT_MODES.has(pitchMode);
  const isVTorHNM        = pitchMode === 'world_vt' || pitchMode === 'world_hnm';
  const showFormantCents = new Set(['world_hard', 'world_soft', 'sine_spectral', 'stft_pitchshift']).has(pitchMode);
  const showHfBias       = Math.abs(breathiness - 1.0) > 0.001;

  // UI display values (stored as 0-1, displayed as 0-100)
  const pitchAmountUI     = Math.round((settings.pitch_amount    ?? 1.0) * 100);
  const preserveVibratoUI = Math.round((settings.preserve_vibrato ?? 1.0) * 100);
  const vtModelUI         = Math.round((settings.formant_shift_beta ?? 0.10) * 100);

  function commitStretchInput(raw) {
    const v = parseFloat(raw);
    if (Number.isFinite(v)) {
      const clamped = Math.max(0.01, Math.min(4.0, v));
      change({ stretch_factor: clamped });
      setStretchInput(clamped.toFixed(2));
    } else {
      setStretchInput((settings.stretch_factor ?? 1.0).toFixed(2));
    }
    setEditingStretch(false);
  }

  return (
    <Section title={t('settings.group.processing')} defaultOpen={true}>

      {/* ── Pitch Mode ── */}
      <PortalDropdown
        value={pitchMode}
        onChange={(v) => change({ pitch_mode: v })}
        groups={buildPitchModeGroups(t)}
      />

      {/* ── Normalize ── */}
      <Checkbox
        checked={settings.normalize ?? false}
        onChange={(v) => change({ normalize: v })}
        label={t('electron.settings.normalize')}
      />

      {/* ── Soft-mode controls ── */}
      <Reveal visible={isSoftMode}>
        <div className="sp-reveal-inner">
          <SliderControl
            label={t('settings.label.correction_amount')}
            value={pitchAmountUI}
            min={0} max={100} defaultValue={100} step={1} suffix="%"
            onChange={(v) => change({ pitch_amount: v / 100 })}
            onDragStart={onControlDragStart}
            onRelease={onControlRelease}
            vs={sliderVs}
          />
          <div className="sp-knob-row">
            <KnobControl
              label={t('settings.label.retune_speed')}
              value={settings.retune_speed_ms ?? 40}
              min={0} max={500} defaultValue={40} step={1} suffix="ms"
              onChange={(v) => change({ retune_speed_ms: v })}
              onDragStart={onControlDragStart}
              onRelease={onControlRelease}
              vs={knobVs}
            />
            <KnobControl
              label={t('settings.label.preserve_vibrato')}
              value={preserveVibratoUI}
              min={0} max={100} defaultValue={100} step={1} suffix="%"
              onChange={(v) => change({ preserve_vibrato: v / 100 })}
              onDragStart={onControlDragStart}
              onRelease={onControlRelease}
              vs={knobVs}
            />
          </div>
        </div>
      </Reveal>

      {/* ── Formant Shift (world_hard, world_soft, sine_spectral, stft_pitchshift) ── */}
      <Reveal visible={showFormantCents}>
        <div className="sp-reveal-inner">
          <SliderControl
            label={t('settings.label.formant_shift')}
            value={settings.formant_shift_cents ?? 0}
            min={-500} max={500} defaultValue={0} step={1} suffix="ct"
            snapPoints={[0]} snapDeadZone={15}
            onChange={(v) => change({ formant_shift_cents: v })}
            onDragStart={onControlDragStart}
            onRelease={onControlRelease}
            vs={sliderVs}
          />
        </div>
      </Reveal>

      {/* ── Vocal Tract Model (world_vt, world_hnm) ── */}
      <Reveal visible={isVTorHNM}>
        <div className="sp-reveal-inner">
          <SliderControl
            label={t('electron.settings.vocal_tract_model')}
            value={vtModelUI}
            min={0} max={100} defaultValue={10} step={1} suffix=""
            onChange={(v) => change({ formant_shift_beta: v / 100 })}
            onDragStart={onControlDragStart}
            onRelease={onControlRelease}
            vs={sliderVs}
          />
        </div>
      </Reveal>

      {/* ── Stretch Method ── */}
      <PortalDropdown
        value={settings.stretch_method ?? 'audiotsm_wsola'}
        onChange={(v) => change({ stretch_method: v })}
        items={buildStretchMethodItems(t)}
      />

      {/* ── Stretch Factor (value is double-click editable) ── */}
      <div className="sp-slider-editable-wrap">
        <SliderControl
          label={t('settings.label.stretch_factor')}
          value={settings.stretch_factor ?? 1.0}
          min={0.01} max={4.0} defaultValue={1.0} step={0.01} suffix="x"
          snapPoints={[1.0]} snapDeadZone={0.03}
          formatValue={(v) => v.toFixed(2) + 'x'}
          onChange={(v) => change({ stretch_factor: v })}
          onDragStart={onControlDragStart}
          onRelease={onControlRelease}
          vs={sliderVs}
        />
        {editingStretch ? (
          <input
            ref={stretchInputRef}
            type="number"
            className="sp-slider-value-input"
            value={stretchInput}
            min={0.01} max={4.0} step={0.01}
            onChange={(e) => setStretchInput(e.target.value)}
            onBlur={(e) => commitStretchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitStretchInput(e.target.value);
              if (e.key === 'Escape') setEditingStretch(false);
            }}
          />
        ) : (
          <div
            className="sp-slider-value-overlay"
            onDoubleClick={() => setEditingStretch(true)}
          />
        )}
      </div>

      {/* ── Breathiness ── */}
      <SliderControl
        label={t('settings.label.breathiness')}
        value={breathiness}
        min={0} max={5.0} defaultValue={1.0} step={0.01} suffix="x"
        snapPoints={[1.0]} snapDeadZone={0.05}
        formatValue={(v) => v.toFixed(2) + 'x'}
        onChange={(v) => change({ breathiness: v })}
        onDragStart={onControlDragStart}
        onRelease={onControlRelease}
        vs={sliderVs}
      />

      {/* ── HF Bias (only when breathiness ≠ 1.0) ── */}
      <Reveal visible={showHfBias}>
        <div className="sp-reveal-inner">
          <SliderControl
            label={t('settings.label.hf_bias')}
            value={settings.hf_bias ?? 0.0}
            min={0} max={1.0} defaultValue={0.0} step={0.01} suffix=""
            formatValue={(v) => v.toFixed(2)}
            onChange={(v) => change({ hf_bias: v })}
            onDragStart={onControlDragStart}
            onRelease={onControlRelease}
            vs={sliderVs}
          />
        </div>
      </Reveal>

    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ToggleSwitch — sliding pill with tactile ON/OFF state
// ─────────────────────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, label }) {
  const { t } = useTranslation();
  return (
    <div className="sp-toggle-row" onClick={() => onChange(!checked)}>
      <div className={`sp-toggle-track${checked ? ' sp-toggle-track--on' : ''}`}>
        <div className="sp-toggle-thumb" />
      </div>
      <span className="sp-toggle-label">{label}</span>
      <span className={`sp-toggle-state${checked ? ' sp-toggle-state--on' : ''}`}>
        {checked ? t('electron.settings.on') : t('electron.settings.off')}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NumberStepper — compact numeric input with −/+ flanking buttons
// ─────────────────────────────────────────────────────────────────────────────

function NumberStepper({ value, min, max, step = 1, suffix = '', onChange }) {
  const [raw, setRaw] = useState(() => String(value));

  useEffect(() => { setRaw(String(value)); }, [value]);

  function commit(str) {
    const v = parseFloat(str);
    if (Number.isFinite(v)) {
      const clamped = Math.max(min, Math.min(max, v));
      onChange(clamped);
      setRaw(String(clamped));
    } else {
      setRaw(String(value));
    }
  }

  function nudge(dir) {
    const next = Math.max(min, Math.min(max, value + dir * step));
    onChange(next);
  }

  return (
    <div className="sp-stepper">
      <button
        className="sp-stepper-btn" type="button"
        onClick={() => nudge(-1)} disabled={value <= min}
      >−</button>
      <input
        type="number"
        className="sp-stepper-input"
        value={raw} min={min} max={max} step={step}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(e.target.value); }}
      />
      {suffix && <span className="sp-stepper-suffix">{suffix}</span>}
      <button
        className="sp-stepper-btn" type="button"
        onClick={() => nudge(1)} disabled={value >= max}
      >+</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CleanlinessGroup
// ─────────────────────────────────────────────────────────────────────────────

// Piecewise low-cut automation curve (mirrors backend lowcut_curve)
const LC_X = [0, 10, 25, 75, 100];
const LC_Y = [0, 70, 90, 98, 100];
function lowcutCurve(a) {
  if (a <= LC_X[0]) return LC_Y[0];
  if (a >= LC_X[LC_X.length - 1]) return LC_Y[LC_Y.length - 1];
  for (let i = 1; i < LC_X.length; i++) {
    if (a <= LC_X[i]) {
      const t = (a - LC_X[i - 1]) / (LC_X[i] - LC_X[i - 1]);
      return LC_Y[i - 1] + t * (LC_Y[i] - LC_Y[i - 1]);
    }
  }
  return 100;
}

function computeSmartLowcutHz(f0Hz, amountPct) {
  const f0 = (f0Hz > 0 && isFinite(f0Hz)) ? f0Hz : 50;
  const maxCutoff = f0 * 0.85;
  const minCutoff = 20;
  if (maxCutoff <= minCutoff) return 0;
  return minCutoff + (amountPct / 100) * (maxCutoff - minCutoff);
}

function hfRollbackStartHz(rollbackPct, sr = 44100) {
  if (rollbackPct <= 0) return Infinity;
  const nyq = sr / 2;
  const t = rollbackPct / 100;
  return Math.max(2000, Math.min(nyq, nyq * Math.pow(2000 / nyq, t)));
}

function CleanlinessGroup({ settings, onSettingsChange, vs, onControlDragStart, onControlRelease, detectedPitch }) {
  const { t } = useTranslation();
  const sliderVs    = vs?.slider;
  const advancedMode = settings.clean_advanced_mode ?? false;
  function change(patch) { onSettingsChange({ ...settings, ...patch }); }

  // Popup visibility
  const [popupVisible, setPopupVisible] = useState(false);
  const hideTimerRef = useRef(null);

  const showPopup = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setPopupVisible(true);
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setPopupVisible(false), 1500);
  }, []);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  // Compute popup display values
  const f0Hz = detectedPitch?.freq_hz ?? 0;
  const cleanlinessPct = settings.cleanliness_percent ?? 0;
  const lowcutPct      = settings.clean_lowcut_percent ?? 0;
  const rollbackPct    = settings.clean_hf_rollback_percent ?? 0;
  const bandwidthHz    = 200 - (cleanlinessPct / 100) * 190;
  const lowcutHz       = computeSmartLowcutHz(f0Hz, lowcutPct);

  // In auto mode, low-cut follows the automation curve
  const effectiveLowcutPct = advancedMode ? lowcutPct : lowcutCurve(cleanlinessPct);
  const effectiveLowcutHz  = computeSmartLowcutHz(f0Hz, effectiveLowcutPct);

  const anyActive = cleanlinessPct > 0 || lowcutPct > 0 || rollbackPct > 0;

  function handleCleanDragStart() {
    if (anyActive) showPopup();
    onControlDragStart?.();
  }
  function handleCleanRelease() {
    scheduleHide();
    onControlRelease?.();
  }
  function handleCleanChange(patch) {
    change(patch);
    const newSettings = { ...settings, ...patch };
    const newClean    = newSettings.cleanliness_percent ?? 0;
    const newLowcut   = newSettings.clean_lowcut_percent ?? 0;
    const newRollback = newSettings.clean_hf_rollback_percent ?? 0;
    if (newClean > 0 || newLowcut > 0 || newRollback > 0) showPopup();
  }

  return (
    <Section title={t('settings.group.cleanliness')} defaultOpen>
      <SliderControl
        label={t('settings.group.cleanliness')}
        value={cleanlinessPct}
        min={0} max={100} defaultValue={0} step={1} suffix="%"
        onChange={(v) => handleCleanChange({ cleanliness_percent: v })}
        onDragStart={handleCleanDragStart}
        onRelease={handleCleanRelease}
        vs={sliderVs}
      />

      <Checkbox
        checked={advancedMode}
        onChange={(v) => change({ clean_advanced_mode: v })}
        label={t('settings.checkbox.advanced_mode')}
      />

      <Reveal visible={advancedMode}>
        <div className="sp-reveal-inner">
          <SliderControl
            label={t('settings.label.low_cut')}
            value={lowcutPct}
            min={0} max={100} defaultValue={0} step={1} suffix="%"
            onChange={(v) => handleCleanChange({ clean_lowcut_percent: v })}
            onDragStart={handleCleanDragStart}
            onRelease={handleCleanRelease}
            vs={sliderVs}
          />

          <SliderControl
            label="HF Rollback"
            value={rollbackPct}
            min={0} max={100} defaultValue={0} step={1} suffix="%"
            onChange={(v) => handleCleanChange({ clean_hf_rollback_percent: v })}
            onDragStart={handleCleanDragStart}
            onRelease={handleCleanRelease}
            vs={sliderVs}
          />
        </div>
      </Reveal>

      <CleanlinessPopup
        visible={popupVisible}
        fundamentalHz={f0Hz}
        lowcutHz={effectiveLowcutHz}
        maskBandwidthHz={bandwidthHz}
        hfRollbackPercent={rollbackPct}
        onFadeComplete={() => setPopupVisible(false)}
      />
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HarmonicGroup
// ─────────────────────────────────────────────────────────────────────────────

function HarmonicGroup({ settings, onSettingsChange, vs, onControlDragStart, onControlRelease }) {
  const { t } = useTranslation();
  const sliderVs = vs?.slider;
  const enabled  = settings.harmonic_limiter_enabled ?? false;
  function change(patch) { onSettingsChange({ ...settings, ...patch }); }

  return (
    <Section title={t('harmonic.title')} defaultOpen>
      <ToggleSwitch
        checked={enabled}
        onChange={(v) => change({ harmonic_limiter_enabled: v })}
        label={t('electron.settings.limiter')}
      />

      <div className={enabled ? undefined : 'sp-dimmed'}>
        <SliderControl
          label={t('electron.settings.harmonic_amount')}
          value={settings.harmonic_amount ?? 50}
          min={0} max={100} defaultValue={50} step={1} suffix="%"
          onChange={(v) => change({ harmonic_amount: v })}
          onDragStart={onControlDragStart}
          onRelease={onControlRelease}
          vs={sliderVs}
        />
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetectedPitchSection
// ─────────────────────────────────────────────────────────────────────────────

function DetectedPitchSection({ detectedPitch, audioLoaded }) {
  const { t } = useTranslation();
  const has = detectedPitch?.freq_hz != null;
  const cents = detectedPitch?.cents;
  const centsSign = cents >= 0 ? '+' : '';
  const centsClass = cents >= 0 ? 'sp-detected-cents--sharp' : 'sp-detected-cents--flat';

  return (
    <Section title={t('settings.group.detected_pitch')} defaultOpen>
      {has ? (
        <div className="sp-detected-detail">
          <span className="sp-detected-note">{detectedPitch.note_name}</span>
          <span className="sp-detected-info">
            {formatFreq(detectedPitch.freq_hz)} Hz
            {cents != null && (
              <span className={`sp-detected-cents ${centsClass}`}>
                &nbsp;{centsSign}{cents.toFixed(1)} ¢
              </span>
            )}
          </span>
        </div>
      ) : (
        <div className="sp-detected-empty">
          {audioLoaded ? t('settings.detected.no_pitch') : t('settings.detected.no_audio_loaded')}
        </div>
      )}
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SettingsPanel
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPanel({
  settings,
  onSettingsChange,
  detectedPitch,
  audioLoaded,
  isProcessing = false,
  performanceMode = false,
  onControlDragStart,
  onControlRelease,
  vs,
}) {
  const panelClass = [
    'settings-panel',
    audioLoaded ? '' : 'settings-panel--disabled',
    isProcessing   ? 'settings-panel--processing'   : '',
    performanceMode ? 'settings-panel--performance' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={panelClass}>
      <NoteGroup
        settings={settings}
        onSettingsChange={onSettingsChange}
        detectedPitch={detectedPitch}
        vs={vs}
      />
      <ProcessingGroup
        settings={settings}
        onSettingsChange={onSettingsChange}
        onControlDragStart={onControlDragStart}
        onControlRelease={onControlRelease}
        vs={vs}
      />
      <CleanlinessGroup
        settings={settings}
        onSettingsChange={onSettingsChange}
        onControlDragStart={onControlDragStart}
        onControlRelease={onControlRelease}
        detectedPitch={detectedPitch}
        vs={vs}
      />
      <HarmonicGroup
        settings={settings}
        onSettingsChange={onSettingsChange}
        onControlDragStart={onControlDragStart}
        onControlRelease={onControlRelease}
        vs={vs}
      />
      <DetectedPitchSection
        detectedPitch={detectedPitch}
        audioLoaded={audioLoaded}
      />
    </div>
  );
}
