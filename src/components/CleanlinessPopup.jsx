import { useRef, useEffect, useCallback } from 'react';
import './CleanlinessPopup.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const LOG_MIN  = Math.log10(20);
const LOG_MAX  = Math.log10(20000);
const LOG_SPAN = LOG_MAX - LOG_MIN;

const AXIS_TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const NUM_HARMONICS = 24;

// ─── Coordinate helpers ───────────────────────────────────────────────────────

function freqToX(hz, left, width) {
  const clamped = Math.max(20, Math.min(20000, hz));
  const t = (Math.log10(clamped) - LOG_MIN) / LOG_SPAN;
  return left + t * width;
}

function hfRollbackStartHz(rollbackPct, sr = 44100) {
  if (rollbackPct <= 0) return Infinity;
  const nyq = sr / 2;
  const t   = rollbackPct / 100;
  return Math.max(2000, Math.min(nyq, nyq * Math.pow(2000 / nyq, t)));
}

// ─── Main draw function ───────────────────────────────────────────────────────

function draw(canvas, { fundamentalHz, lowcutHz, maskBandwidthHz, hfRollbackPercent }) {
  const ctx = canvas.getContext('2d');
  const W   = canvas.width;
  const H   = canvas.height;

  const PAD_TOP    = 10;
  const PAD_BOTTOM = 22;
  const PAD_LEFT   = 6;
  const PAD_RIGHT  = 6;

  const innerLeft   = PAD_LEFT;
  const innerTop    = PAD_TOP;
  const innerWidth  = W - PAD_LEFT - PAD_RIGHT;
  const innerHeight = H - PAD_TOP - PAD_BOTTOM;
  const innerBottom = innerTop + innerHeight;

  // Read CSS variables for theming
  const style      = getComputedStyle(canvas);
  const colAccent  = style.getPropertyValue('--accent').trim()  || '#33CED6';
  const colDim     = style.getPropertyValue('--text-dim').trim() || '#6B7BA0';
  const colBorder  = style.getPropertyValue('--border').trim()  || '#2D3347';

  ctx.clearRect(0, 0, W, H);

  // ── 1. Low-cut zone (red, left side) ────────────────────────────────────
  if (lowcutHz > 0) {
    const xCut = Math.max(innerLeft, Math.min(freqToX(lowcutHz, innerLeft, innerWidth), innerLeft + innerWidth));
    ctx.fillStyle = 'rgba(230,80,80,0.20)';
    ctx.fillRect(innerLeft, innerTop, xCut - innerLeft, innerHeight);
    ctx.strokeStyle = 'rgba(230,80,80,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xCut, innerTop);
    ctx.lineTo(xCut, innerBottom);
    ctx.stroke();
  }

  // ── 2. HF rollback zone (blue, right side) ───────────────────────────────
  const rollStart = hfRollbackStartHz(hfRollbackPercent);
  if (rollStart < 20000) {
    const xRoll = Math.max(innerLeft, Math.min(freqToX(rollStart, innerLeft, innerWidth), innerLeft + innerWidth));
    const rightEdge = innerLeft + innerWidth;
    ctx.fillStyle = 'rgba(80,140,230,0.15)';
    ctx.fillRect(xRoll, innerTop, rightEdge - xRoll, innerHeight);
    ctx.strokeStyle = 'rgba(80,140,230,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xRoll, innerTop);
    ctx.lineTo(xRoll, innerBottom);
    ctx.stroke();
  }

  // ── 3. Comb / harmonic mask shape ────────────────────────────────────────
  //
  // For each pixel column: compute mask value = max over all harmonics of
  //   Gaussian(freq, harmonic_hz, sigma)
  // where sigma = maskBandwidthHz / 2.355 (FWHM convention).
  //
  // Then: apply HF rollback fade above rollStart (linearly fade mask → 0).
  // The drawn height is maskValue * innerHeight.

  const sigma = Math.max(1, maskBandwidthHz) / 2.355;
  const f0    = fundamentalHz > 0 ? fundamentalHz : 220;  // default A3 when no pitch

  const nyq       = 22050;
  const rollFade  = rollStart < nyq ? rollStart : Infinity;
  const rollSpan  = nyq - rollFade;

  // Build path for fill
  ctx.beginPath();
  ctx.moveTo(innerLeft, innerBottom);

  for (let px = 0; px < innerWidth; px++) {
    const t    = px / (innerWidth - 1);
    const freq = Math.pow(10, LOG_MIN + t * LOG_SPAN);

    // Max Gaussian across all harmonics
    let maskVal = 0;
    for (let h = 1; h <= NUM_HARMONICS; h++) {
      const hFreq = f0 * h;
      if (hFreq > 20000) break;
      const dist = freq - hFreq;
      const g    = Math.exp(-0.5 * (dist / sigma) ** 2);
      if (g > maskVal) maskVal = g;
    }

    // Apply HF rollback fade
    if (rollStart < nyq && freq > rollStart) {
      const fade = Math.max(0, 1 - (freq - rollStart) / rollSpan);
      maskVal *= fade;
    }

    const screenX = innerLeft + px;
    const screenY = innerBottom - maskVal * innerHeight;
    if (px === 0) ctx.moveTo(screenX, innerBottom);
    ctx.lineTo(screenX, screenY);
  }

  ctx.lineTo(innerLeft + innerWidth - 1, innerBottom);
  ctx.closePath();

  // Fill accent at 25% opacity
  ctx.fillStyle = colAccent + '40'; // hex alpha ~25%
  ctx.fill();

  // Stroke accent at 60% opacity
  ctx.beginPath();
  ctx.moveTo(innerLeft, innerBottom);
  for (let px = 0; px < innerWidth; px++) {
    const t    = px / (innerWidth - 1);
    const freq = Math.pow(10, LOG_MIN + t * LOG_SPAN);
    let maskVal = 0;
    for (let h = 1; h <= NUM_HARMONICS; h++) {
      const hFreq = f0 * h;
      if (hFreq > 20000) break;
      const dist = freq - hFreq;
      const g    = Math.exp(-0.5 * (dist / sigma) ** 2);
      if (g > maskVal) maskVal = g;
    }
    if (rollStart < nyq && freq > rollStart) {
      const fade = Math.max(0, 1 - (freq - rollStart) / rollSpan);
      maskVal *= fade;
    }
    const screenX = innerLeft + px;
    const screenY = innerBottom - maskVal * innerHeight;
    if (px === 0) ctx.moveTo(screenX, screenY);
    else ctx.lineTo(screenX, screenY);
  }
  ctx.strokeStyle = colAccent + '99'; // ~60% opacity
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── 4. Harmonic tick marks along bottom axis ─────────────────────────────
  for (let h = 2; h <= NUM_HARMONICS; h++) {
    const hFreq = f0 * h;
    if (hFreq < 20 || hFreq > 20000) continue;
    const xH = freqToX(hFreq, innerLeft, innerWidth);
    ctx.strokeStyle = colAccent + '55';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xH, innerBottom);
    ctx.lineTo(xH, innerBottom + 3);
    ctx.stroke();
  }

  // ── 5. Fundamental dashed marker ─────────────────────────────────────────
  if (fundamentalHz > 0 && fundamentalHz <= 20000) {
    const xF0 = freqToX(fundamentalHz, innerLeft, innerWidth);
    ctx.strokeStyle = colAccent;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xF0, innerTop);
    ctx.lineTo(xF0, innerBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // "f₀" label
    ctx.fillStyle = colAccent;
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('f\u2080', xF0, innerTop + 8);
  }

  // ── 6. Hz labels for low cut and HF rollback ─────────────────────────────
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'left';

  if (lowcutHz > 0) {
    const xCut = Math.max(innerLeft, Math.min(freqToX(lowcutHz, innerLeft, innerWidth), innerLeft + innerWidth));
    const lbl  = lowcutHz >= 1000 ? `${(lowcutHz / 1000).toFixed(1)}k` : `${Math.round(lowcutHz)}`;
    ctx.fillStyle = 'rgba(230,80,80,0.85)';
    const w = ctx.measureText(lbl).width;
    const tx = Math.min(xCut + 2, innerLeft + innerWidth - w - 2);
    ctx.fillText(lbl, tx, innerTop + 9);
  }

  if (rollStart < 20000) {
    const xRoll = Math.max(innerLeft, Math.min(freqToX(rollStart, innerLeft, innerWidth), innerLeft + innerWidth));
    const lbl   = rollStart >= 1000 ? `${(rollStart / 1000).toFixed(1)}k` : `${Math.round(rollStart)}`;
    ctx.fillStyle = 'rgba(80,140,230,0.85)';
    const w  = ctx.measureText(lbl).width;
    const tx = Math.max(innerLeft + 2, xRoll - w - 2);
    ctx.textAlign = 'left';
    ctx.fillText(lbl, tx, innerTop + 9);
  }

  // ── 7. Frequency axis labels ──────────────────────────────────────────────
  ctx.fillStyle  = colDim;
  ctx.font       = '7px sans-serif';
  const axisY    = H - PAD_BOTTOM / 2 + 3;

  for (const hz of AXIS_TICKS) {
    const x   = freqToX(hz, innerLeft, innerWidth);
    const lbl = hz >= 1000 ? `${hz / 1000}k` : String(hz);
    ctx.textAlign = 'center';
    ctx.fillText(lbl, x, axisY);

    // Tick mark
    ctx.strokeStyle = colBorder + '88';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x, innerBottom);
    ctx.lineTo(x, innerBottom + 3);
    ctx.stroke();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CleanlinessPopup({
  visible,
  fundamentalHz,
  lowcutHz,
  maskBandwidthHz,
  hfRollbackPercent,
  onFadeComplete,
}) {
  const canvasRef = useRef(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    draw(canvas, { fundamentalHz, lowcutHz, maskBandwidthHz, hfRollbackPercent });
  }, [fundamentalHz, lowcutHz, maskBandwidthHz, hfRollbackPercent]);

  // Redraw whenever values change
  useEffect(() => {
    if (visible) redraw();
  }, [visible, redraw]);

  // Also redraw on first paint after becoming visible (ensures CSS vars resolve)
  useEffect(() => {
    if (visible) requestAnimationFrame(redraw);
  }, [visible, redraw]);

  function handleTransitionEnd(e) {
    if (e.propertyName === 'opacity' && !visible) onFadeComplete?.();
  }

  return (
    <div
      className={`cleanliness-popup ${visible ? 'cleanliness-popup--visible' : ''}`}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden={!visible}
    >
      <canvas
        ref={canvasRef}
        className="cleanliness-popup__canvas"
        width={308}
        height={140}
      />
    </div>
  );
}
