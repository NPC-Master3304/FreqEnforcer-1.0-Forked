import os
from pathlib import Path
from .loader import load_audio, save_audio, set_wav_root_note
from .loop_crossfade import process_with_loop
from .sfz_writer import write_sfz, note_name_for_filename


def render_note_range(
    source_audio, source_sr, source_note_midi,
    low_note_midi, high_note_midi,
    settings, process_func,
    output_dir, base_name,
    enable_loop=True,
    template_periods=6, min_loop_periods=10, crossfade_periods=2,
    start_trim_ms=0.0,
    progress_callback=None
):
    """
    Render the source sample at every MIDI note from low_note to high_note.

    Args:
        source_audio: float32 mono numpy array
        source_sr: sample rate (44100)
        source_note_midi: MIDI note of the source sample
        low_note_midi: lowest MIDI note to render (e.g., 36 = C2)
        high_note_midi: highest MIDI note to render (e.g., 96 = C7)
        settings: dict of processing settings (pitch_mode, formant, etc.)
        process_func: callable that takes (audio, sr, settings) and returns processed audio
        output_dir: directory to write WAV files into
        base_name: base name for files (e.g., "Piano" -> "Piano_C4.wav")
        enable_loop: whether to find and embed loop points
        template_periods: template match length in pitch periods (default 6)
        min_loop_periods: minimum loop length in pitch periods (default 10)
        crossfade_periods: safety crossfade length in pitch periods (default 2)
        start_trim_ms: trim this many ms from the start of each rendered sample (0 = no trim)
        max_loop_periods: maximum loop length in pitch periods
        progress_callback: called with (current_note_index, total_notes, midi_note)

    Returns:
        (results, sfz_path) where results is a list of dicts:
        [{ 'midi': 60, 'note_name': 'Cs4', 'path': '...',
           'loop_start': N, 'loop_end': N, 'sample_count': N }, ...]
        and sfz_path is the path to the generated SFZ file.
    """
    note_names_display = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    os.makedirs(output_dir, exist_ok=True)

    results = []
    total = high_note_midi - low_note_midi + 1

    for i, midi_note in enumerate(range(low_note_midi, high_note_midi + 1)):
        note_name = note_name_for_filename(midi_note)

        if progress_callback:
            progress_callback(i, total, midi_note)

        # Build settings for this note (pipeline needs '#' style names)
        target_note_str = note_names_display[midi_note % 12] + str(midi_note // 12 - 1)
        note_settings = dict(settings)
        note_settings['target_note'] = target_note_str

        # Process (pitch correct to this target note)
        processed = process_func(source_audio.copy(), source_sr, note_settings)

        # Start trim offset
        if start_trim_ms > 0:
            trim_samples = int(start_trim_ms / 1000.0 * source_sr)
            if trim_samples < len(processed):
                processed = processed[trim_samples:]

        # Apply crossfade loop
        loop_start = None
        loop_end = None
        if enable_loop:
            # Compute target f0 for this MIDI note
            target_f0 = 440.0 * (2 ** ((midi_note - 69) / 12))
            processed, loop_start, loop_end = process_with_loop(
                processed, source_sr,
                f0_hz=target_f0,
                template_periods=template_periods,
                min_loop_periods=min_loop_periods,
                crossfade_periods=crossfade_periods,
            )

        # Filename uses 's' for sharps: BaseName_Cs4.wav
        filename = f"{base_name}_{note_name}.wav"
        filepath = os.path.join(output_dir, filename)

        # Save WAV
        save_audio(filepath, processed, source_sr)

        # Embed root note + loop points
        set_wav_root_note(filepath, midi_note, source_sr, loop_start, loop_end)

        results.append({
            'midi': midi_note,
            'note_name': note_name,
            'path': filepath,
            'filename': filename,
            'loop_start': loop_start,
            'loop_end': loop_end,
            'sample_count': len(processed),
        })

    # Generate SFZ file in the same folder as the WAVs
    sfz_path = os.path.join(output_dir, f'{base_name}.sfz')
    write_sfz(sfz_path, base_name, results)

    return results, sfz_path


