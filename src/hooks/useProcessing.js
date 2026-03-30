import { useRef, useCallback, useEffect } from 'react';

const API_BASE = 'http://localhost:8765';

// -- Settings to backend parameter mapping --
// Formulas verified against PyQt6 SettingsPanel.get_settings()

export function settingsToBackend(settings) {
  // Harmonic compression amount (0-100 UI) maps to:
  //   Amount 0%   -> Knee 12 dB (soft), Release 200 ms (slow) -- gentlest
  //   Amount 100% -> Knee 0 dB  (hard), Release 10 ms  (fast) -- most aggressive
  const amount    = parseFloat(settings.harmonic_amount) || 0;
  const knee_db   = 12.0 - (amount / 100.0) * 12.0;
  const release_ms = 200.0 - (amount / 100.0) * 190.0;

  // Harmonic ceiling offsets: keys must be strings for JSON / FastAPI Dict[str, float]
  const ceilingOffsets = Object.fromEntries(
    Object.entries(settings.harmonic_ceiling_offsets_db ?? {}).map(([k, v]) => [String(k), Number(v)])
  );

  return {
    target_note:              `${settings.targetNote}${settings.octave}`,
    pitch_mode:               settings.pitch_mode,
    pitch_amount:             settings.pitch_amount,
    retune_speed_ms:          settings.retune_speed_ms,
    preserve_vibrato:         settings.preserve_vibrato,
    preserve_formants:        settings.formant_shift_cents === 0,
    normalize:                settings.normalize,
    formant_shift_cents:      settings.formant_shift_cents,
    formant_shift_beta:       settings.formant_shift_beta,
    stretch_method:           settings.stretch_method,
    stretch_factor:           settings.stretch_factor,
    cleanliness_percent:      settings.cleanliness_percent,
    clean_lowcut_percent:     settings.clean_lowcut_percent,
    clean_hf_rollback_percent: settings.clean_hf_rollback_percent,
    breathiness:              settings.breathiness,
    hf_bias:                  settings.hf_bias,
    harmonic_limiter_enabled: settings.harmonic_limiter_enabled,
    harmonic_knee_db:         knee_db,
    harmonic_release_ms:      release_ms,
    harmonic_ceiling_offsets_db: ceilingOffsets,
  };
}

// -- useProcessing --
/**
 * Manages the full processing pipeline lifecycle:
 *   - Prevents concurrent requests (queues the latest settings as pending)
 *   - Token-based stale-result detection (if superseded while in-flight, re-runs)
 *   - SSE progress stream from /api/process-progress
 *   - 60-second timeout on the processing request
 *
 * @param {{ onStart, onProgress, onComplete, onError }} callbacks
 * @returns {{ queueProcess(settings): void, cancelProcess(): void }}
 */
export function useProcessing({ onStart, onProgress, onComplete, onError }) {
  // Stable callback refs so queueProcess never needs to change identity
  const onStartRef    = useRef(onStart);
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef    = useRef(onError);

  useEffect(() => { onStartRef.current    = onStart;    }, [onStart]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onErrorRef.current    = onError;    }, [onError]);

  // Internal mutable state (refs keep queueProcess stable)
  const tokenRef    = useRef(0);
  const inFlightRef = useRef(false);
  const pendingRef  = useRef(null);   // { settings } waiting to run after current finishes
  const sseRef      = useRef(null);

  const closeSse = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

  // Cancel in-flight processing (best-effort token invalidation)
  const cancelProcess = useCallback(() => {
    tokenRef.current = tokenRef.current + 1; // stale-mark any in-flight result
    pendingRef.current = null;               // drop queued work
    closeSse();
  }, [closeSse]);

  // Core processing runner
  const runProcess = useCallback(async (settings, token) => {
    inFlightRef.current = true;
    onStartRef.current?.();

    // Open SSE for progress BEFORE sending POST
    closeSse();
    try {
      const sse = new EventSource(`${API_BASE}/api/process-progress`);
      sseRef.current = sse;
      sse.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (typeof payload.progress === 'number') {
            onProgressRef.current?.(Math.round(payload.progress * 100));
          }
        } catch (_) { /* malformed event -- ignore */ }
      };
      sse.onerror = () => {
        closeSse();
        // SSE dropped mid-processing -- fall back to indeterminate progress
        onProgressRef.current?.(0);
      };
    } catch (_) {
      // EventSource not supported or URL bad -- proceed without progress
    }

    // Send the processing request with a 60-second timeout
    const fetchCtrl = new AbortController();
    const fetchTimeout = setTimeout(() => fetchCtrl.abort(), 60000);
    try {
      const res = await fetch(`${API_BASE}/api/process`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(settingsToBackend(settings)),
        signal:  fetchCtrl.signal,
      });
      clearTimeout(fetchTimeout);

      closeSse();

      // Check if our token is still current
      if (tokenRef.current !== token) {
        // A newer settings change arrived while we were waiting for the response.
        // Discard this result and kick off the pending run immediately.
        inFlightRef.current = false;
        if (pendingRef.current) {
          const { settings: nextSettings } = pendingRef.current;
          pendingRef.current = null;
          const nextToken = ++tokenRef.current;
          runProcess(nextSettings, nextToken);
        }
        return;
      }

      if (!res.ok) {
        // 409 = server-side superseded (shouldn't normally reach here, but handle gracefully)
        if (res.status === 409) {
          inFlightRef.current = false;
          if (pendingRef.current) {
            const { settings: nextSettings } = pendingRef.current;
            pendingRef.current = null;
            const nextToken = ++tokenRef.current;
            runProcess(nextSettings, nextToken);
          }
          return;
        }
        let detail = res.statusText;
        try { detail = (await res.json()).detail ?? detail; } catch (_) {}
        throw new Error(detail);
      }

      const data = await res.json();
      inFlightRef.current = false;
      onCompleteRef.current?.(data);

      // If new settings arrived during processing, run them now
      if (pendingRef.current) {
        const { settings: nextSettings } = pendingRef.current;
        pendingRef.current = null;
        const nextToken = ++tokenRef.current;
        runProcess(nextSettings, nextToken);
      }
    } catch (err) {
      clearTimeout(fetchTimeout);
      closeSse();
      inFlightRef.current = false;

      if (tokenRef.current === token) {
        // AbortError from our 60s timeout -> friendly message flagged with "timeout"
        const msg = err.name === 'AbortError'
          ? 'Processing timed out -- timeout'
          : (err.message ?? String(err));
        onErrorRef.current?.(msg);
      }

      // Still drain pending after an error
      if (pendingRef.current) {
        const { settings: nextSettings } = pendingRef.current;
        pendingRef.current = null;
        const nextToken = ++tokenRef.current;
        runProcess(nextSettings, nextToken);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeSse]);

  // Public API:
  // Queue a new processing run. If already in flight, store as pending
  // (will be picked up automatically when the current request finishes).
  const queueProcess = useCallback((settings) => {
    if (inFlightRef.current) {
      // Bump token so the in-flight result will be discarded
      tokenRef.current = tokenRef.current + 1;
      pendingRef.current = { settings };
      return;
    }
    const token = ++tokenRef.current;
    runProcess(settings, token);
  }, [runProcess]);

  // Cleanup SSE on unmount
  useEffect(() => () => closeSse(), [closeSse]);

  return { queueProcess, cancelProcess };
}
