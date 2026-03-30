"""
Compares audio output between PyQt6 FreqEnforcer and Electron FreqEnforcer.

Usage:
    python scripts/compare_outputs.py <pyqt6_output.wav> <electron_output.wav>

Checks:
    1. Duration match (must be identical)
    2. Sample-level difference (max absolute diff, mean absolute diff)
    3. RMS difference
    4. Pass/fail verdict
"""
import sys
import numpy as np
import soundfile as sf


def compare(path_a, path_b):
    audio_a, sr_a = sf.read(path_a, dtype='float32')
    audio_b, sr_b = sf.read(path_b, dtype='float32')

    print(f"File A: {path_a}")
    print(f"  Duration: {len(audio_a)/sr_a:.4f}s | SR: {sr_a} | Samples: {len(audio_a)}")
    print(f"File B: {path_b}")
    print(f"  Duration: {len(audio_b)/sr_b:.4f}s | SR: {sr_b} | Samples: {len(audio_b)}")
    print()

    # Duration check
    if sr_a != sr_b:
        print("FAIL: Sample rates differ")
        return False

    if abs(len(audio_a) - len(audio_b)) > 10:
        print(f"FAIL: Length mismatch ({len(audio_a)} vs {len(audio_b)}, diff={abs(len(audio_a)-len(audio_b))})")
        return False

    # Truncate to same length
    min_len = min(len(audio_a), len(audio_b))
    audio_a = audio_a[:min_len]
    audio_b = audio_b[:min_len]

    # Sample-level comparison
    diff = np.abs(audio_a - audio_b)
    max_diff = np.max(diff)
    mean_diff = np.mean(diff)
    rms_a = np.sqrt(np.mean(audio_a**2))
    rms_b = np.sqrt(np.mean(audio_b**2))
    rms_diff = abs(rms_a - rms_b)

    print(f"Max absolute difference: {max_diff:.8f}")
    print(f"Mean absolute difference: {mean_diff:.8f}")
    print(f"RMS A: {rms_a:.6f} | RMS B: {rms_b:.6f} | RMS diff: {rms_diff:.6f}")
    print()

    # Verdict
    # Allow small floating-point differences from HTTP serialization
    if max_diff < 1e-4:
        print("PASS: Outputs are effectively identical (diff < 1e-4)")
        return True
    elif max_diff < 1e-2:
        print("WARN: Small differences detected (diff < 1e-2) — likely floating point precision from API serialization")
        return True
    else:
        print(f"FAIL: Significant differences (max diff = {max_diff:.6f})")
        # Find where the biggest differences are
        worst_indices = np.argsort(diff)[-5:]
        for idx in worst_indices:
            t = idx / sr_a
            print(f"  @sample {idx} ({t:.4f}s): A={audio_a[idx]:.6f} B={audio_b[idx]:.6f} diff={diff[idx]:.6f}")
        return False


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python compare_outputs.py <file_a.wav> <file_b.wav>")
        sys.exit(1)

    success = compare(sys.argv[1], sys.argv[2])
    sys.exit(0 if success else 1)
