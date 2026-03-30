import struct
from pathlib import Path


def write_dwp(output_path, program_name, zones, sample_rate=44100):
    """
    Generate a DirectWave .dwp instrument patch.

    Args:
        output_path: path to write the .dwp file
        program_name: instrument name (e.g., "My Piano")
        zones: list of dicts from render_note_range(), each with:
            - midi: MIDI note number
            - note_name: e.g., "C4"
            - path: absolute path to the WAV file
            - filename: just the filename
            - sample_count: number of samples in the WAV
            - loop_start: loop start sample (or None)
            - loop_end: loop end sample (or None)
        sample_rate: audio sample rate
    """
    # Build the inner content (everything after the outer envelope)
    inner = bytearray()

    # === PROGRAM-LEVEL SETTINGS ===
    inner.extend(_write_global_section(program_name, str(output_path)))

    # === ZONE DATA ===
    for i, zone in enumerate(zones):
        is_first = (i == 0)
        is_last = (i == len(zones) - 1)
        zone_data = _build_zone(
            zone, i, len(zones), program_name,
            is_first, is_last, sample_rate
        )
        # Wrap in a 0x0003 container chunk
        inner.extend(_write_chunk(0x0003, zone_data))

    # === FILE TERMINATOR ===
    inner.extend(_write_chunk(0x0002, b''))

    # === OUTER ENVELOPE ===
    out = bytearray()
    out.extend(b'DwPr')                          # magic
    out.extend(struct.pack('<I', 38))             # version
    out.extend(_write_chunk(0x0006, bytes(16)))   # global header (16 zero bytes)
    out.extend(struct.pack('<I', 1))              # instrument count
    out.extend(struct.pack('<I', len(inner)))      # inner block size
    out.extend(struct.pack('<I', 0))              # padding
    out.extend(inner)

    Path(output_path).write_bytes(out)


def _write_chunk(tag_id, data):
    """Write a single tagged chunk: tag(2) + pad(2) + size(4) + pad(4) + data."""
    chunk = bytearray()
    chunk.extend(struct.pack('<H', tag_id))
    chunk.extend(struct.pack('<H', 0))
    chunk.extend(struct.pack('<I', len(data)))
    chunk.extend(struct.pack('<I', 0))
    chunk.extend(data)
    return chunk


def _write_global_section(program_name, output_path):
    """Write program-level chunks (0x0064 through 0x006E)."""
    chunks = bytearray()

    # 0x0064: Program settings (30 bytes)
    # Byte layout from reference: zeros except float 1.0 at offset 8, 0x58 at offset 20
    prog = bytearray(30)
    struct.pack_into('<f', prog, 8, 1.0)   # master volume
    prog[20] = 0x58
    chunks.extend(_write_chunk(0x0064, prog))

    # 0x0066: Program name (ASCII)
    chunks.extend(_write_chunk(0x0066, program_name.encode('ascii', errors='replace')))

    # 0x0067: Program path (ASCII)
    chunks.extend(_write_chunk(0x0067, output_path.encode('ascii', errors='replace')))

    # 0x0068: 10 bytes zeros
    chunks.extend(_write_chunk(0x0068, bytes(10)))

    # 0x0069: 18 bytes — envelope defaults from reference
    chunks.extend(_write_chunk(0x0069, bytes.fromhex(
        '00000000403f0000403f0000003f0000403f'
    )))

    # 0x006A: 17 bytes — ADSR envelope 1
    chunks.extend(_write_chunk(0x006A, bytes.fromhex(
        '01fbff3f3f0000003f0000403f0000803e'
    )))

    # 0x006B: 17 bytes — ADSR envelope 2
    chunks.extend(_write_chunk(0x006B, bytes.fromhex(
        '000000803e0000003f0000803e00000000'
    )))

    # 0x006C: LFO params (20 bytes each, 2 instances)
    lfo_data = bytes.fromhex('00000000cdcccc3d0000803f0000000000000000')
    chunks.extend(_write_chunk(0x006C, lfo_data))
    chunks.extend(_write_chunk(0x006C, lfo_data))

    # 0x006D: Mod matrix (4 bytes each, 4 instances)
    for _ in range(4):
        chunks.extend(_write_chunk(0x006D, bytes(4)))

    # 0x006E: Key group entries (13 bytes each, 100 instances, index 0x00–0x63)
    # Layout: uint32(index) + byte(0x00) + float32(1.0) + uint32(0)
    for i in range(100):
        entry = struct.pack('<I', i) + b'\x00' + struct.pack('<f', 1.0) + b'\x00\x00\x00\x00'
        chunks.extend(_write_chunk(0x006E, entry))

    return chunks


def _build_zone(zone, index, total_zones, program_name,
                is_first, is_last, sample_rate):
    """Build the sub-chunks for a single zone (content of a 0x0003 container)."""
    chunks = bytearray()
    midi = zone['midi']

    # Determine key range:
    # First zone: low_key=0 (catches everything below)
    # Last zone: high_key=127 (catches everything above)
    # Middle zones: low_key = high_key = root
    low_key = 0 if is_first else midi
    high_key = 127 if is_last else midi

    # 0x01F4: Zone params (25 bytes)
    zp = bytearray(25)
    zp[0] = midi                                   # root note
    zp[1] = low_key                                # low key
    zp[2] = high_key                               # high key
    zp[3] = 0                                       # padding
    zp[4] = 0x7F                                    # high velocity = 127
    struct.pack_into('<f', zp, 10, 1.0)             # gain
    struct.pack_into('<f', zp, 14, 0.5)             # pan center
    zp[22] = 0x02                                   # flag
    chunks.extend(_write_chunk(0x01F4, zp))

    # 0x01F5: Zone name (ASCII)
    zone_name = f"{program_name} {index + 1}"
    chunks.extend(_write_chunk(0x01F5, zone_name.encode('ascii', errors='replace')))

    # 0x01F6: WAV path (absolute, ASCII)
    wav_path = str(Path(zone['path']).resolve())
    chunks.extend(_write_chunk(0x01F6, wav_path.encode('ascii', errors='replace')))

    # 0x01F7: Sample info (40 bytes)
    si = bytearray(40)
    struct.pack_into('<I', si, 0, zone['sample_count'])  # sample frame count
    struct.pack_into('<I', si, 4, 0)                      # unused
    struct.pack_into('<I', si, 8, 1)                      # channels (mono)
    struct.pack_into('<I', si, 12, 128)                   # format flag (0x80)
    struct.pack_into('<f', si, 16, float(sample_rate))    # sample rate
    # Offsets 20–32: zeros (unused/loop)
    struct.pack_into('<I', si, 36, 32)                    # flag (0x20)
    chunks.extend(_write_chunk(0x01F7, si))

    # 0x01F8–0x0204: Per-zone DSP defaults (exact bytes from reference)
    chunks.extend(_zone_dsp_defaults())

    # 0x0004: Zone terminator
    chunks.extend(_write_chunk(0x0004, b''))

    return chunks


def _zone_dsp_defaults():
    """Per-zone DSP chunks (0x01F8–0x0204) with exact defaults from reference."""
    chunks = bytearray()

    # 0x01F8: 8 bytes — pan + volume
    chunks.extend(_write_chunk(0x01F8, bytes.fromhex('0000003f00006400')))

    # 0x01F9: 14 bytes — filter
    chunks.extend(_write_chunk(0x01F9, bytes.fromhex('00000000003f0000003f0000803f')))

    # 0x01FA: 48 bytes — zone envelope
    chunks.extend(_write_chunk(0x01FA, bytes.fromhex(
        '0000003f0000003f3433b33e0000803f'
        '00000000000000000000000000000000'
        '00000000000000000000000000000000'
    )))

    # 0x01FB: 20 bytes each, 2 instances — ADSR envelopes
    chunks.extend(_write_chunk(0x01FB, bytes.fromhex(
        '01000000d8a3f03e000000000000000000000000'
    )))
    chunks.extend(_write_chunk(0x01FB, bytes.fromhex(
        '00000000c8e3f13e0000003f0000000000000000'
    )))

    # 0x01FC: 2 bytes
    chunks.extend(_write_chunk(0x01FC, bytes(2)))

    # 0x01FD: 16 bytes
    chunks.extend(_write_chunk(0x01FD, bytes.fromhex('000000000000003f0000803fae47013f')))

    # 0x01FE–0x0201: 9 bytes each
    chunks.extend(_write_chunk(0x01FE, bytes.fromhex('00000000000000803f')))
    chunks.extend(_write_chunk(0x01FF, bytes.fromhex('00000000000000803f')))
    chunks.extend(_write_chunk(0x0200, bytes.fromhex('00000000000000803f')))
    chunks.extend(_write_chunk(0x0201, bytes.fromhex('000000003f0000803f')))

    # 0x0202: 16 bytes each, 2 instances
    d_0202 = bytes.fromhex('000000000000003f0000003f0000803e')
    chunks.extend(_write_chunk(0x0202, d_0202))
    chunks.extend(_write_chunk(0x0202, d_0202))

    # 0x0203: 20 bytes each, 2 instances
    chunks.extend(_write_chunk(0x0203, bytes.fromhex(
        '00000000cdcccc3d0000803f0000000000000000'
    )))
    chunks.extend(_write_chunk(0x0203, bytes.fromhex(
        '00000000cdcc0c3f0000803f0000000000000000'
    )))

    # 0x0204: 8 bytes each, 16 instances — modulation routing
    mod_defaults = [
        '020002000000803f',  # mod 0
        '030022000000403f',  # mod 1
        '0c0001000000003f',  # mod 2
        '02000700c3f5683f',  # mod 3
        '010007000000403f',  # mod 4
    ]
    for md in mod_defaults:
        chunks.extend(_write_chunk(0x0204, bytes.fromhex(md)))
    # Remaining 11 entries: default routing
    default_mod = bytes.fromhex('000000000000003f')
    for _ in range(11):
        chunks.extend(_write_chunk(0x0204, default_mod))

    return chunks
