# FreqEnforcer v2.0.0 — Known Issues

## Functional Issues

- [Severity: Low] **Undo/Redo not implemented** — Ctrl+Z and Ctrl+Shift+Z are reserved but do nothing. Changing a setting cannot be reversed except by manually adjusting the control back.

- [Severity: Low] **Cleanliness DSP intentionally differs from PyQt6 v1** — The cleanliness system was redesigned for v2. The original high-shelf gain + Hz-based low-cut has been replaced with a percentage-based smart low-cut and HF rollback system. Output from cleanliness processing will not be sample-identical to the PyQt6 version; this is by design.

- [Severity: Low] **Detected pitch display requires backend** — If the Python backend is slow to start, the pitch detection result may not appear until after the first processing pass completes.

- [Severity: Low] **Stretch factor snap-to-1.0** — The stretch factor slider snaps to exactly 1.0 in a small deadband near center. Users who want values like 0.99x or 1.01x need to use the manual text input.

## Visual Issues

- [Severity: Low] **Harmonic limiter spectrum may show stale nodes briefly** — After loading a new file, the harmonic limiter spectrum can briefly display the previous file's harmonic nodes until the first processing pass completes.

- [Severity: Low] **Waveform canvas does not anti-alias on very low-resolution displays** — On sub-1080p screens, the waveform blob edges may appear slightly jagged.

- [Severity: Low] **Theme editor color picker requires exact hex input for precise colors** — The native color picker provided by the browser may vary slightly in precision across operating systems.

## Platform-Specific

- [Windows] **Port 8765 conflict on first launch** — If another instance of FreqEnforcer is already running, the backend will fail to start and a toast will appear. Ensure only one instance is running at a time.

- [Windows] **DPI scaling above 150%** — At very high DPI scaling (175–200%), some fixed-size canvas elements (harmonic limiter, waveform) may appear smaller than intended. The app is optimized for 100–125% DPI.

- [Windows] **File paths with non-ASCII characters** — Unicode file paths (Japanese, Russian, Arabic, etc.) are generally supported but have not been exhaustively tested. If a load fails, try moving the file to a path with ASCII characters only.

## Limitations

- Multi-sample rendering can take several minutes for large note ranges (60+ notes at high-quality stretch settings).
- Crossfade loop quality depends heavily on the source material. Highly transient or non-periodic sounds (drums, one-shots) may not loop cleanly regardless of crossfade duration.
- The Python backend must be running for all audio processing, export, and detection features. The UI will load but show errors if the backend is not available.
- `world_hnm` and `sine_spectral` pitch modes are experimental and may produce artifacts on some source material, particularly at extreme pitch shifts (>±12 semitones).
- SFZ export is formatted for DirectWave (FL Studio). Compatibility with other samplers (Kontakt, HALion, etc.) has not been tested.
- Loop point embedding (smpl chunk) is only supported in WAV export. MP3/OGG/FLAC exports do not carry loop metadata.
- The app requires Python 3.11+ and all dependencies in `requirements.txt`. It is not self-contained — the Python environment must be set up separately before first launch.
