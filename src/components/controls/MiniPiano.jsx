import './MiniPiano.css';

const WHITE_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEYS = [
  { note: 'C#', flat: 'Db', left: '10.00%'  },
  { note: 'D#', flat: 'Eb', left: '24.29%'  },
  { note: 'F#', flat: 'Gb', left: '52.86%'  },
  { note: 'G#', flat: 'Ab', left: '67.14%'  },
  { note: 'A#', flat: 'Bb', left: '81.43%'  },
];
const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
function toSharp(note) { return FLAT_TO_SHARP[note] || note; }

export default function MiniPiano({ selectedNote = 'C', onNoteChange, notation = 'sharps', vs }) {
  const selectedSharp = toSharp(selectedNote);
  const v = vs || {};
  const hasVs = !!vs;

  function emit(note, e) { e.stopPropagation(); onNoteChange?.(note); }

  // CSS custom properties for hover/selected effects
  const rootStyle = hasVs ? {
    height: v.height ?? 44,
    border: `${v.borderWidth ?? 1}px solid ${v.borderColor || 'var(--border)'}`,
    borderRadius: v.keyBorderRadius ?? 3,
    '--piano-selected': v.selectedColor || 'var(--accent)',
    '--piano-hover-white': v.hoverBrightness ?? 0.93,
    '--piano-hover-black': 1 + ((v.hoverBrightness ?? 1.1) - 1) * 4,
  } : {};

  const whiteColor = hasVs ? (v.whiteKeyColor ?? '#e6e6e6') : undefined;
  const blackColor = hasVs ? (v.blackKeyColor ?? '#252535') : undefined;
  const showLabels = hasVs ? (v.showLabels !== false) : true;
  const labelSize  = hasVs ? (v.labelSize ?? 8) : undefined;
  const labelColor = hasVs ? (v.labelColor ?? 'rgba(0,0,0,0.35)') : undefined;
  const bkHeightR  = hasVs ? (v.blackKeyHeightRatio ?? 0.62) : 0.62;
  const bkWidthR   = hasVs ? (v.blackKeyWidthRatio ?? 0.6) : 0.6;
  const bkWidthPct = `${(bkWidthR / 7 * 100).toFixed(2)}%`;
  const bkHeightPct = `${(bkHeightR * 100).toFixed(0)}%`;
  const keyGap     = hasVs ? (v.keyGap ?? 1) : undefined;
  const keyBR      = hasVs ? (v.keyBorderRadius ?? 2) : undefined;

  return (
    <div className="piano-root" style={rootStyle}>
      {WHITE_KEYS.map((note, i) => {
        const selected = selectedSharp === note;
        const wStyle = {};
        if (whiteColor && !selected) wStyle.background = whiteColor;
        if (selected) wStyle.background = hasVs ? (v.selectedColor || 'var(--accent)') : undefined;
        if (keyGap != null && i < WHITE_KEYS.length - 1) wStyle.borderRightWidth = keyGap;
        if (keyBR != null) wStyle.borderRadius = `0 0 ${keyBR}px ${keyBR}px`;
        return (
          <div key={note}
            className={`piano-key piano-white${selected ? ' piano-key--selected' : ''}${i === WHITE_KEYS.length - 1 ? ' piano-white--last' : ''}`}
            style={wStyle}
            onMouseDown={(e) => emit(note, e)}>
            {showLabels && (
              <span className="piano-white-label"
                style={labelSize || labelColor ? { fontSize: labelSize, color: selected ? undefined : labelColor } : undefined}>
                {note}
              </span>
            )}
          </div>
        );
      })}

      {BLACK_KEYS.map((bk) => {
        const label = notation === 'flats' ? bk.flat : bk.note;
        const isSelected = selectedSharp === bk.note;
        const bStyle = { left: bk.left };
        if (hasVs) {
          bStyle.width  = bkWidthPct;
          bStyle.height = bkHeightPct;
          if (keyBR != null) bStyle.borderRadius = `0 0 ${keyBR}px ${keyBR}px`;
        }
        if (blackColor && !isSelected) bStyle.background = blackColor;
        if (isSelected) bStyle.background = hasVs ? (v.selectedColor || 'var(--accent)') : undefined;
        return (
          <div key={bk.note}
            className={`piano-key piano-black${isSelected ? ' piano-key--selected' : ''}`}
            style={bStyle}
            onMouseDown={(e) => emit(bk.note, e)}
            title={label}
          />
        );
      })}
    </div>
  );
}
