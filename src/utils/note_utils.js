// Note pitch classes in order (index = pitch class 0–11)
export const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_TO_PC = {
  C: 0, 'B#': 0,
  'C#': 1, Db: 1,
  D: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  'E#': 5, F: 5,
  'F#': 6, Gb: 6,
  G: 7,
  'G#': 8, Ab: 8,
  A: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11,
};

/** pitch class string → 0..11, or null */
export function noteNameToPC(note) {
  if (!note) return null;
  return NOTE_TO_PC[note] ?? null;
}

/** (octave, pitchClass) → MIDI note number.  midi = (octave+1)*12 + pc */
export function toMidi(octave, pc) {
  return (octave + 1) * 12 + pc;
}

/** MIDI note number → frequency in Hz */
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** pitch class index + octave → frequency */
export function noteToFreq(pc, octave) {
  return midiToFreq(toMidi(octave, pc));
}

/** Format frequency to 2 decimal places */
export function formatFreq(hz) {
  if (hz == null || !Number.isFinite(hz)) return '—';
  return hz.toFixed(2);
}
