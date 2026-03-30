def write_sfz(output_path, program_name, zones):
    """
    Generate an SFZ instrument file for DirectWave / sforzando / any SFZ player.

    The SFZ file must be in the SAME FOLDER as the WAV files it references.
    Filenames use 's' for sharps (Cs, Ds, Fs, Gs, As) because SFZ treats '#'
    as a comment character. NEVER use '#' in filenames or anywhere in the file
    except intentional comments at the very start.

    Args:
        output_path: full path to write the .sfz file
        program_name: instrument name for the comment header
        zones: list of dicts from render_note_range(), each with:
            - midi: MIDI note number (0-127)
            - filename: WAV filename only, no path (e.g., "kick_Cs3.wav")
            - loop_start: loop start sample index (or None)
            - loop_end: loop end sample index (or None)

    Zones must be sorted by MIDI note (ascending).
    """
    lines = []

    # Group header — applies to all regions
    all_have_loops = all(
        z.get('loop_start') is not None and z.get('loop_end') is not None
        for z in zones
    )

    lines.append('<group>')
    lines.append('lovel=0 hivel=127')

    if all_have_loops:
        lines.append('loop_mode=loop_sustain')

    lines.append('')

    # One region per zone
    for i, zone in enumerate(zones):
        midi = zone['midi']
        filename = zone['filename']
        is_first = (i == 0)
        is_last = (i == len(zones) - 1)

        # Key range:
        # First zone extends lokey down to 0
        # Last zone extends hikey up to 127
        # All others: lokey = hikey = midi
        lokey = 0 if is_first else midi
        hikey = 127 if is_last else midi

        parts = [
            '<region>',
            'trigger=attack',
            f'sample={filename}',
            f'pitch_keycenter={midi}',
            f'lokey={lokey}',
            f'hikey={hikey}',
        ]

        loop_start = zone.get('loop_start')
        loop_end = zone.get('loop_end')

        if loop_start is not None and loop_end is not None:
            parts.append(f'loop_start={loop_start}')
            parts.append(f'loop_end={loop_end}')

            if not all_have_loops:
                parts.append('loop_mode=loop_sustain')

        lines.append(' '.join(parts))

    with open(output_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))
        f.write('\n')


def note_name_for_filename(midi_note):
    """
    Convert a MIDI note number to a filename-safe note name.
    Uses 's' for sharps instead of '#'.

    Examples:
        49 -> "Cs3"
        60 -> "C4"
        66 -> "Fs4"
        69 -> "A4"
    """
    note_names = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']
    octave = (midi_note // 12) - 1
    note = note_names[midi_note % 12]
    return f'{note}{octave}'
