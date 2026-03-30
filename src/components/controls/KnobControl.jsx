import { useRef, useEffect, useState, useCallback } from 'react';
import { onThemeChange } from '../../utils/themeColors';
import './KnobControl.css';

// ── Defaults (used when no vs prop) ───────────────────────────────────────────
const DEF_W = 80, DEF_H = 90, DEF_R = 24, DEF_TRACK_R = 29;
const DEF_START = (135 * Math.PI) / 180;
const DEF_SWEEP = (270 * Math.PI) / 180;
const DRAG_PX = 150;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function cssVarRgba(name, alpha) {
  const hex = cssVar(name, '#888888');
  if (!hex.startsWith('#') || hex.length < 7) return `rgba(136,136,170,${alpha})`;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function getAccent() {
  return cssVar('--accent', '#33CED6');
}

function applySnap(rawValue, snapPoints, snapDeadZone, min, max) {
  if (!snapPoints || !snapPoints.length) return rawValue;
  for (const sp of snapPoints) {
    const tSP  = (sp - min) / (max - min);
    const tRaw = (rawValue - min) / (max - min);
    if (Math.abs(tRaw - tSP) * DRAG_PX < snapDeadZone) return sp;
  }
  return rawValue;
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function drawKnob(canvas, { value, min, max, label, suffix, formatValue, hovered, glowIntensity = 0, vs }) {
  const v = vs || {};
  const hasVs = !!vs;

  // Dimensions
  const W = hasVs ? (v.totalWidth ?? 80) : DEF_W;
  const H = hasVs ? (v.totalHeight ?? 90) : DEF_H;
  const BODY_R = hasVs ? (v.bodyRadius ?? 24) : DEF_R;
  const TRACK_R = BODY_R + 5;

  // Vertical center: balance label (top) and value (bottom)
  const labelSz = hasVs ? (v.labelSize ?? 10) : 9;
  const valueSz = hasVs ? (v.valueSize ?? 13) : 11;
  const CX = W / 2;
  const CY = (labelSz + 6 + H - valueSz - 4) / 2 + 2;

  // Arc angles
  const sweepDeg = hasVs ? (v.arcSweepDeg ?? 270) : 270;
  const SWEEP = (sweepDeg * Math.PI) / 180;
  const gapPos = hasVs ? (v.arcGapPosition ?? 'bottom') : 'bottom';
  const startDeg = gapPos === 'top'
    ? (-90 + (360 - sweepDeg) / 2)
    : (90 + (360 - sweepDeg) / 2);
  const START_ANGLE = hasVs ? (startDeg * Math.PI / 180) : DEF_START;

  // Visual params
  const arcWidth      = hasVs ? (v.arcWidth ?? 4)                    : 3;
  const inactiveColor = v.inactiveArcColor ?? cssVarRgba('--text-dim', 0.2);
  const accent        = getAccent();
  const activeColor   = v.activeArcColor || accent;
  const indicatorClr  = v.indicatorColor || accent;
  const indStart      = hasVs ? (v.indicatorLength ?? 0.6)           : 0.40;
  const indEnd        = hasVs ? (v.indicatorEndLength ?? 0.85)       : 0.78;
  const indW          = hasVs ? (v.indicatorWidth ?? 2)              : 2;
  const gradInner     = v.bodyGradientInner || cssVar('--bg-panel-light', '#3e3e62');
  const gradOuter     = v.bodyGradientOuter || cssVar('--bg-panel', '#13131f');
  const borderW       = hasVs ? (v.bodyBorderWidth ?? 1)             : 1;
  const borderColor   = v.bodyBorderColor || (hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)');
  const shadowColor   = hasVs ? (v.dropShadowColor ?? 'rgba(0,0,0,0.5)') : 'rgba(0,0,0,0.50)';
  const glowAlways    = hasVs ? (v.activeArcGlow ?? false)           : false;
  const glowBlur      = hasVs ? (v.activeArcGlowBlur ?? 6)          : 10;
  const hoverBr       = hasVs ? (v.hoverBrightness ?? 1.15)         : 1.15;
  const labelSpacing  = hasVs ? (v.labelSpacing ?? 0.5)             : 0.5;

  // Canvas sizing
  const dpr = window.devicePixelRatio || 1;
  const needW = Math.round(W * dpr);
  const needH = Math.round(H * dpr);
  if (canvas.width !== needW || canvas.height !== needH) {
    canvas.width  = needW;
    canvas.height = needH;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const t     = clamp((value - min) / (max - min), 0, 1);
  const angle = START_ANGLE + t * SWEEP;

  // ── Background arc track
  ctx.beginPath();
  ctx.arc(CX, CY, TRACK_R, START_ANGLE, START_ANGLE + SWEEP);
  ctx.strokeStyle = inactiveColor;
  ctx.lineWidth   = arcWidth;
  ctx.lineCap     = 'round';
  ctx.stroke();

  // ── Active arc
  if (t > 0.001) {
    if (glowIntensity > 0.01) {
      ctx.shadowColor = activeColor;
      ctx.shadowBlur  = glowBlur * glowIntensity;
    }
    ctx.beginPath();
    ctx.arc(CX, CY, TRACK_R, START_ANGLE, angle);
    ctx.strokeStyle = activeColor;
    ctx.lineWidth   = arcWidth;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }

  // ── Drop shadow (canvas shadow API)
  ctx.save();
  ctx.shadowColor   = shadowColor;
  ctx.shadowBlur    = hasVs ? (v.dropShadowBlur ?? 8) : 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = hasVs ? (v.dropShadowOffsetY ?? 3) : 0;
  if (!hasVs) {
    // Original ellipse shadow approach
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(CX, CY + BODY_R * 0.18, BODY_R * 0.78, BODY_R * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = shadowColor;
    ctx.fill();
  }

  // ── Knob body (radial gradient)
  const grad = ctx.createRadialGradient(
    CX - BODY_R * 0.28, CY - BODY_R * 0.28, BODY_R * 0.04,
    CX, CY, BODY_R,
  );
  grad.addColorStop(0,    gradInner);
  grad.addColorStop(0.55, blendHex(gradInner, gradOuter, 0.45));
  grad.addColorStop(1,    gradOuter);
  ctx.beginPath();
  ctx.arc(CX, CY, BODY_R, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore(); // end shadow

  // ── Rim highlight
  if (borderW > 0) {
    ctx.beginPath();
    ctx.arc(CX, CY, BODY_R, 0, Math.PI * 2);
    ctx.strokeStyle = hovered && !hasVs ? 'rgba(255,255,255,0.12)' : borderColor;
    ctx.lineWidth   = borderW;
    ctx.stroke();
  }

  // ── Indicator line
  const innerR = BODY_R * indStart;
  const outerR = BODY_R * indEnd;
  if (glowIntensity > 0.01) { ctx.shadowColor = indicatorClr; ctx.shadowBlur = 6 * glowIntensity; }
  ctx.beginPath();
  ctx.moveTo(CX + Math.cos(angle) * innerR, CY + Math.sin(angle) * innerR);
  ctx.lineTo(CX + Math.cos(angle) * outerR, CY + Math.sin(angle) * outerR);
  ctx.strokeStyle = indicatorClr;
  ctx.lineWidth   = indW;
  ctx.lineCap     = 'round';
  ctx.stroke();
  ctx.shadowBlur  = 0;

  // ── Label (top)
  ctx.font         = `${labelSz}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle    = hasVs ? (v.labelColor ?? 'rgba(136,136,170,0.85)') : cssVarRgba('--text-secondary', 0.85);
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${labelSpacing}px`;
  ctx.fillText(label.toUpperCase(), CX, labelSz + 1);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

  // ── Value (bottom)
  let display;
  if (formatValue) display = formatValue(value);
  else if (suffix === 'ct') display = `${value.toFixed(1)}${suffix}`;
  else display = `${Math.round(value)}${suffix}`;
  ctx.font         = `${valueSz}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle    = hasVs ? (v.valueColor ?? '#e0e0e0') : cssVar('--text-primary', '#e0e0e0');
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(display, CX, H - 2);
}

// ── Hex color blend helper ───────────────────────────────────────────────────
function blendHex(a, b, t) {
  const pa = parseColor(a), pb = parseColor(b);
  if (!pa || !pb) return a;
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function parseColor(c) {
  if (!c) return null;
  if (c.startsWith('#')) {
    const h = c.slice(1);
    if (h.length === 6) return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function KnobControl({
  label        = '',
  value        = 0,
  min          = 0,
  max          = 1,
  defaultValue = 0,
  step         = 1,
  suffix       = '',
  snapPoints   = [],
  snapDeadZone = 12,
  onChange,
  onRelease,
  onDragStart,
  formatValue,
  vs,
}) {
  const canvasRef      = useRef(null);
  const [hovered, setHovered] = useState(false);
  const glowRef        = useRef(1);   // permanent — starts at full glow
  const glowTargetRef  = useRef(1);
  const glowRafRef     = useRef(null);
  const drawPropsRef   = useRef({});

  drawPropsRef.current = { value, min, max, label, suffix, formatValue, hovered, vs };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawKnob(canvas, { ...drawPropsRef.current, glowIntensity: glowRef.current });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function pulseGlow() {
    if (glowRafRef.current) cancelAnimationFrame(glowRafRef.current);
    glowRef.current = 0;         // drop to zero instantly
    glowTargetRef.current = 1;   // animate back to full
    function tick() {
      const target = glowTargetRef.current;
      const next = glowRef.current + (target - glowRef.current) * 0.18;
      glowRef.current = Math.abs(next - target) < 0.005 ? target : next;
      redraw();
      if (glowRef.current !== target) glowRafRef.current = requestAnimationFrame(tick);
      else glowRafRef.current = null;
    }
    glowRafRef.current = requestAnimationFrame(tick);
  }

  // Redraw whenever value/hover/vs changes (outside animation)
  useEffect(() => { redraw(); }, [value, hovered, min, max, label, suffix, formatValue, vs, redraw]);

  // Cleanup RAF on unmount
  useEffect(() => () => { if (glowRafRef.current) cancelAnimationFrame(glowRafRef.current); }, []);
  // Redraw when theme changes
  useEffect(() => onThemeChange(() => redraw()), [redraw]);

  // Drag
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pulseGlow(); // eslint-disable-line react-hooks/exhaustive-deps
    onDragStart?.();
    const startY = e.clientY, startValue = value;
    function onMove(ev) {
      ev.preventDefault();
      const deltaY   = startY - ev.clientY;
      const deltaVal = (deltaY / DRAG_PX) * (max - min);
      let newVal = applySnap(startValue + deltaVal, snapPoints, snapDeadZone, min, max);
      onChange?.(clamp(newVal, min, max));
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      onRelease?.();
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [value, min, max, snapPoints, snapDeadZone, onChange, onDragStart, onRelease]);

  const handleDoubleClick = useCallback((e) => {
    e.preventDefault();
    onChange?.(defaultValue);
    onRelease?.();
  }, [defaultValue, onChange, onRelease]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    pulseGlow(); // eslint-disable-line react-hooks/exhaustive-deps
    const coarse = e.shiftKey ? 10 : 1;
    const delta  = e.deltaY < 0 ? step * coarse : -step * coarse;
    let newVal   = applySnap(value + delta, snapPoints, snapDeadZone, min, max);
    onChange?.(clamp(newVal, min, max));
    onRelease?.();
  }, [value, step, min, max, snapPoints, snapDeadZone, onChange, onRelease]);

  return (
    <div className="knob-root" title={`${label} — double-click to reset`}>
      <canvas
        ref={canvasRef}
        className={`knob-canvas${hovered ? ' knob-canvas--hovered' : ''}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
    </div>
  );
}
