import { useRef, useEffect, useState, useCallback } from 'react';
import { onThemeChange } from '../../utils/themeColors';
import './SliderControl.css';

// ── Default bevel parameters (PyQt6 SliderWidget) ─────────────────────────────
const VERT = {
  handleW: 22, handleH: 40, bevelX: 4, bevelY: 7,
  paddingY: 22, labelH: 14, valueH: 14,
  lTop: 155, lBottom: 83, lLeft: 130, lRight: 108, lFace: 85,
};
const HORIZ = {
  handleW: 40, handleH: 20, bevelX: 7, bevelY: 4,
  paddingX: 22, labelH: 12,
  lTop: 130, lBottom: 108, lLeft: 83, lRight: 155, lFace: 85,
};
const DEF_TICK_COUNT = 11;

// ── Color helpers ─────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (h.length === 6) return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  return [45, 45, 68];
}
function adjustColor(rgb, l) {
  let [r, g, b] = rgb;
  if (l >= 100) {
    const f = l / 100;
    r = Math.min(255, r * f); g = Math.min(255, g * f); b = Math.min(255, b * f);
  } else {
    const df = (200 - l) / 100;
    r /= df; g /= df; b /= df;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
function multToLight(m) {
  if (m >= 1) return m * 100;
  return 200 - 100 / m;
}
function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function cssVarRgba(name, alpha) {
  const hex = cssVar(name, '#888888');
  if (!hex.startsWith('#') || hex.length < 7) return `rgba(136,136,170,${alpha})`;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function getPanelRgb() {
  const raw = cssVar('--bg-panel-light', '#2d2d44');
  return raw.startsWith('#') ? hexToRgb(raw) : [45, 45, 68];
}

// ── Draw helpers ──────────────────────────────────────────────────────────────
function fillPoly(ctx, pts, color) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawBevelHandle(ctx, hx, hy, hw, hh, bx, by, panelRgb, lTop, lBottom, lLeft, lRight, lFace, accent, hovered, isHoriz, vs) {
  const v = vs || {};
  const borderR = v.handleBorderRadius ?? 0;

  // Shadow
  if (v.handleDropShadow !== false) {
    ctx.save();
    if (vs) {
      ctx.shadowColor   = v.handleShadowColor ?? 'rgba(0,0,0,0.4)';
      ctx.shadowBlur    = v.handleShadowBlur ?? 6;
      ctx.shadowOffsetY = v.handleShadowOffsetY ?? 2;
    }
    ctx.fillStyle = v.handleShadowColor ?? 'rgba(0,0,0,0.42)';
    if (borderR > 0 && ctx.roundRect) {
      ctx.beginPath(); ctx.roundRect(hx + 2, hy + 3, hw, hh, borderR); ctx.fill();
    } else {
      ctx.fillRect(hx + 2, hy + 3, hw, hh);
    }
    ctx.restore();
  }

  // Clip to rounded rect if needed
  if (borderR > 0 && ctx.roundRect) {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(hx, hy, hw, hh, borderR); ctx.clip();
  }

  // 5 bevel faces
  const otl = [hx, hy],         otr = [hx+hw, hy];
  const obl = [hx, hy+hh],      obr = [hx+hw, hy+hh];
  const itl = [hx+bx, hy+by],   itr = [hx+hw-bx, hy+by];
  const ibl = [hx+bx, hy+hh-by],ibr = [hx+hw-bx, hy+hh-by];

  fillPoly(ctx, [otl, otr, itr, itl], adjustColor(panelRgb, lTop));
  fillPoly(ctx, [ibl, ibr, obr, obl], adjustColor(panelRgb, lBottom));
  fillPoly(ctx, [otl, itl, ibl, obl], adjustColor(panelRgb, lLeft));
  fillPoly(ctx, [itr, otr, obr, ibr], adjustColor(panelRgb, lRight));
  fillPoly(ctx, [itl, itr, ibr, ibl], adjustColor(panelRgb, lFace));

  // Grooves on front face
  const grooveCount = v.handleGrooveCount ?? 0;
  if (grooveCount > 0) {
    const fL = hx + bx + 1, fR = hx + hw - bx - 1;
    const fT = hy + by + 1, fB = hy + hh - by - 1;
    const fH = fB - fT;
    ctx.strokeStyle = v.handleGrooveColor ?? 'rgba(0,0,0,0.3)';
    ctx.lineWidth   = v.handleGrooveWidth ?? 1;
    for (let i = 1; i <= grooveCount; i++) {
      const gy = fT + (i / (grooveCount + 1)) * fH;
      ctx.beginPath(); ctx.moveTo(fL, gy); ctx.lineTo(fR, gy); ctx.stroke();
    }
  }

  // Indicator line (accent, centered on face)
  const indW = v.handleIndicatorWidth ?? 1;
  if (indW > 0) {
    ctx.fillStyle = v.handleIndicatorColor || accent;
    if (isHoriz) {
      ctx.fillRect(hx + hw/2 - indW/2, hy + by, indW, hh - by*2);
    } else {
      ctx.fillRect(hx + bx, hy + hh/2 - indW/2, hw - bx*2, indW);
    }
  }

  if (borderR > 0 && ctx.roundRect) ctx.restore();

  // Hover rim
  if (hovered) {
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth   = 1;
    if (borderR > 0 && ctx.roundRect) {
      ctx.beginPath(); ctx.roundRect(hx + 0.5, hy + 0.5, hw - 1, hh - 1, borderR); ctx.stroke();
    } else {
      ctx.strokeRect(hx + 0.5, hy + 0.5, hw - 1, hh - 1);
    }
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtDefault(value, suffix) {
  const v = Number.isFinite(value) ? value : 0;
  const str = Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (!suffix) return str;
  return (suffix === '%' || suffix === 'x' || suffix === 'ct') ? str + suffix : str + ' ' + suffix;
}

// ── Draw: horizontal ──────────────────────────────────────────────────────────
function drawHorizontal(ctx, W, H, { value, min, max, label, suffix, formatValue, showTicks, hovered, glowIntensity = 0, vs }) {
  const v  = vs || {};
  const hv = !!vs;

  // All colors: read CSS var as default, allow vs override only if explicitly set (non-null)
  const accent    = v.activeTrackColor     || cssVar('--accent', '#33CED6');
  const indClr    = v.handleIndicatorColor || cssVar('--accent', '#33CED6');
  const border    = v.trackColor           || cssVar('--border', '#3d3d5c');
  const panelRgb  = hexToRgb(v.handleBaseColor || cssVar('--bg-panel-light', '#2d2d44'));
  const labelClr  = v.labelColor   ?? cssVarRgba('--text-secondary', 0.85);
  const valueClr  = v.valueColor   ?? cssVar('--text-primary', '#e0e0e0');
  const tickClr   = v.tickColor    ?? cssVarRgba('--text-dim', 0.3);

  const hw  = hv ? (v.handleWidth  ?? 14) : HORIZ.handleW;
  const hh  = hv ? (v.handleHeight ?? 24) : HORIZ.handleH;
  const bd  = hv ? (v.handleBevelDepth ?? 2.5) : HORIZ.bevelX;
  const bx  = bd;
  const by  = Math.round(bd * 0.57);
  const padX = Math.round(hw / 2) + 2;
  const labH = hv ? (v.labelSize ?? 10) + 2 : HORIZ.labelH;
  const trackThick = hv ? (v.trackThickness ?? 2) : 2;
  const tickCount  = hv ? (v.tickCount ?? 10) + 1 : (showTicks ? DEF_TICK_COUNT : 0);
  const tickLen    = hv ? (v.tickLength ?? 5) : 5;
  const tickW      = hv ? (v.tickWidth ?? 1) : 1;

  // Face lightness
  let lTop, lBottom, lLeft, lRight;
  if (hv) {
    lTop    = multToLight(v.handleTopFaceBrightness    ?? 1.25);
    lBottom = multToLight(v.handleBottomFaceBrightness ?? 0.65);
    lLeft   = multToLight(v.handleLeftFaceBrightness   ?? 1.15);
    lRight  = multToLight(v.handleRightFaceBrightness  ?? 0.8);
  } else {
    lTop = HORIZ.lTop; lBottom = HORIZ.lBottom; lLeft = HORIZ.lLeft; lRight = HORIZ.lRight;
  }
  const lFace = hv ? multToLight(0.85) : HORIZ.lFace;

  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const cy = labH + (H - labH) / 2;
  const trackL = padX, trackR = W - padX, trackW = trackR - trackL;
  const handleCX = trackL + t * trackW;

  // Label + value row
  const labSz = hv ? (v.labelSize ?? 10) : 10;
  const valSz = hv ? (v.valueSize ?? 12) : 11;
  ctx.textBaseline = 'middle';
  ctx.font      = `${labSz}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = labelClr;
  ctx.textAlign = 'left';
  ctx.fillText(label.toUpperCase(), padX, labH / 2);
  ctx.font      = `${valSz}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = valueClr;
  ctx.textAlign = 'right';
  ctx.fillText(formatValue ? formatValue(value) : fmtDefault(value, suffix), W - padX, labH / 2);

  // Ticks
  if (tickCount > 1) {
    ctx.strokeStyle = tickClr;
    ctx.lineWidth   = tickW;
    for (let i = 0; i < tickCount; i++) {
      const x = Math.round(trackL + (i / (tickCount - 1)) * trackW) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, cy - tickLen); ctx.lineTo(x, cy + tickLen); ctx.stroke();
    }
  }

  // Track groove
  ctx.fillStyle = border;
  ctx.fillRect(trackL, Math.round(cy) - trackThick / 2, trackW, trackThick);

  // Active fill (bipolar: fill from zero, else from left)
  const isBipolar   = min < 0 && max > 0;
  const fillOriginX = isBipolar ? trackL + (-min / (max - min)) * trackW : trackL;
  const fillL = Math.min(fillOriginX, handleCX);
  const fillR = Math.max(fillOriginX, handleCX);
  ctx.save();
  if (glowIntensity > 0.01) {
    ctx.shadowColor = accent;
    ctx.shadowBlur  = (hv ? (v.activeTrackGlowBlur ?? 8) : 8) * glowIntensity;
  }
  ctx.fillStyle = accent;
  ctx.fillRect(fillL, Math.round(cy) - trackThick / 2, fillR - fillL, trackThick);
  ctx.restore();

  // Handle bevel
  drawBevelHandle(ctx, handleCX - hw/2, Math.round(cy) - hh/2, hw, hh, bx, by,
    panelRgb, lTop, lBottom, lLeft, lRight, lFace, accent, hovered, true, vs);
}

// ── Draw: vertical ────────────────────────────────────────────────────────────
function drawVertical(ctx, W, H, { value, min, max, label, suffix, formatValue, showTicks, hovered, glowIntensity = 0, vs }) {
  const v  = vs || {};
  const hv = !!vs;

  // All colors: read CSS var as default, allow vs override only if explicitly set (non-null)
  const accent    = v.activeTrackColor     || cssVar('--accent', '#33CED6');
  const indClr    = v.handleIndicatorColor || cssVar('--accent', '#33CED6');
  const border    = v.trackColor           || cssVar('--border', '#3d3d5c');
  const panelRgb  = hexToRgb(v.handleBaseColor || cssVar('--bg-panel-light', '#2d2d44'));
  const labelClr  = v.labelColor   ?? cssVarRgba('--text-secondary', 0.85);
  const valueClr  = v.valueColor   ?? cssVar('--text-primary', '#e0e0e0');
  const tickClr   = v.tickColor    ?? cssVarRgba('--text-dim', 0.3);

  // For vertical: swap handle W/H from the vs (or use VERT defaults)
  const hw  = hv ? (v.handleHeight ?? 24) : VERT.handleW;
  const hh  = hv ? (v.handleWidth  ?? 14) : VERT.handleH;
  const bd  = hv ? (v.handleBevelDepth ?? 2.5) : VERT.bevelY;
  const bx  = Math.round(bd * 0.57);
  const by  = bd;
  const padY = Math.round(hh / 2) + 2;
  const labH = hv ? (v.labelSize ?? 10) + 4 : VERT.labelH;
  const valH = hv ? (v.valueSize ?? 12) + 2 : VERT.valueH;
  const trackThick = hv ? (v.trackThickness ?? 2) : 2;
  const tickCount  = hv ? (v.tickCount ?? 10) + 1 : (showTicks ? DEF_TICK_COUNT : 0);
  const tickLen    = hv ? (v.tickLength ?? 5) : 5;
  const tickW      = hv ? (v.tickWidth ?? 1) : 1;

  // Face lightness — rotated for vertical
  let lTop, lBottom, lLeft, lRight;
  if (hv) {
    lTop    = multToLight(v.handleRightFaceBrightness  ?? 0.8);
    lBottom = multToLight(v.handleLeftFaceBrightness    ?? 1.15);
    lLeft   = multToLight(v.handleTopFaceBrightness     ?? 1.25);
    lRight  = multToLight(v.handleBottomFaceBrightness  ?? 0.65);
  } else {
    lTop = VERT.lTop; lBottom = VERT.lBottom; lLeft = VERT.lLeft; lRight = VERT.lRight;
  }
  const lFace = hv ? multToLight(0.85) : VERT.lFace;

  const t  = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const cx = W / 2;
  const trackT = labH + padY, trackB = H - valH - padY, trackH = trackB - trackT;
  const handleCY = trackB - t * trackH;

  // Label (top)
  const labSz = hv ? (v.labelSize ?? 10) : 9;
  const valSz = hv ? (v.valueSize ?? 12) : 10;
  ctx.textBaseline = 'middle';
  ctx.font      = `${labSz}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = labelClr;
  ctx.textAlign = 'center';
  ctx.fillText(label.toUpperCase(), cx, labH / 2);

  // Value (bottom)
  ctx.font      = `${valSz}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = valueClr;
  ctx.fillText(formatValue ? formatValue(value) : fmtDefault(value, suffix), cx, H - valH / 2);

  // Ticks
  if (tickCount > 1) {
    ctx.strokeStyle = tickClr;
    ctx.lineWidth   = tickW;
    for (let i = 0; i < tickCount; i++) {
      const y = Math.round(trackB - (i / (tickCount - 1)) * trackH) + 0.5;
      ctx.beginPath(); ctx.moveTo(cx - tickLen * 1.6, y); ctx.lineTo(cx + tickLen * 1.6, y); ctx.stroke();
    }
  }

  // Track groove
  ctx.fillStyle = border;
  ctx.fillRect(Math.round(cx) - trackThick / 2, trackT, trackThick, trackH);

  // Active fill
  const isBipolar   = min < 0 && max > 0;
  const fillOriginY = isBipolar ? trackB - (-min / (max - min)) * trackH : trackB;
  const fillT = Math.min(fillOriginY, handleCY);
  const fillB = Math.max(fillOriginY, handleCY);
  ctx.save();
  if (glowIntensity > 0.01) {
    ctx.shadowColor = accent;
    ctx.shadowBlur  = (hv ? (v.activeTrackGlowBlur ?? 8) : 8) * glowIntensity;
  }
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx) - trackThick / 2, fillT, trackThick, fillB - fillT);
  ctx.restore();

  // Handle bevel
  drawBevelHandle(ctx, Math.round(cx) - hw/2, handleCY - hh/2, hw, hh, bx, by,
    panelRgb, lTop, lBottom, lLeft, lRight, lFace, accent, hovered, false, vs);
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function applySnap(v, snapPoints, snapDeadZone) {
  if (!snapPoints?.length || !snapDeadZone) return v;
  for (const sp of snapPoints) { if (Math.abs(v - sp) <= snapDeadZone) return sp; }
  return v;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SliderControl({
  label = '', value = 0, min = 0, max = 1, defaultValue = 0, step = 1,
  suffix = '', orientation = 'horizontal', snapPoints = [], snapDeadZone = 0,
  onChange, onRelease, onDragStart, formatValue, showTicks = true, vs,
}) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const [hovered, setHovered]   = useState(false);
  const [dragging, setDragging] = useState(false);
  const isVert = orientation === 'vertical';
  const glowRef       = useRef(1);   // permanent — starts at full glow
  const glowTargetRef = useRef(1);
  const glowRafRef    = useRef(null);

  // Always-fresh draw ref
  const drawRef = useRef(null);
  drawRef.current = () => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    const dpr  = window.devicePixelRatio || 1;
    const logW = container.offsetWidth  || (isVert ? 40 : 200);
    const logH = container.offsetHeight || (isVert ? 160 : 40);
    if (logW === 0 || logH === 0) return;
    const needW = Math.round(logW * dpr), needH = Math.round(logH * dpr);
    if (canvas.width !== needW || canvas.height !== needH) {
      canvas.width = needW; canvas.height = needH;
      canvas.style.width = `${logW}px`; canvas.style.height = `${logH}px`;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const drawProps = { value, min, max, label, suffix, formatValue, showTicks, hovered, glowIntensity: glowRef.current, vs };
    if (isVert) drawVertical(ctx, logW, logH, drawProps);
    else        drawHorizontal(ctx, logW, logH, drawProps);
  };

  function pulseGlow() {
    if (glowRafRef.current) cancelAnimationFrame(glowRafRef.current);
    glowRef.current = 0;
    glowTargetRef.current = 1;
    function tick() {
      const target = glowTargetRef.current;
      const next = glowRef.current + (target - glowRef.current) * 0.18;
      glowRef.current = Math.abs(next - target) < 0.005 ? target : next;
      drawRef.current?.();
      if (glowRef.current !== target) glowRafRef.current = requestAnimationFrame(tick);
      else glowRafRef.current = null;
    }
    glowRafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => { drawRef.current?.(); }, [value, hovered, min, max, label, suffix, showTicks, vs]);
  useEffect(() => () => { if (glowRafRef.current) cancelAnimationFrame(glowRafRef.current); }, []);
  // Redraw when theme changes
  useEffect(() => onThemeChange(() => drawRef.current?.()), []);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => drawRef.current?.());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Drag
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pulseGlow(); // eslint-disable-line react-hooks/exhaustive-deps
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    const rect = canvas.getBoundingClientRect();
    const logW = container.offsetWidth, logH = container.offsetHeight;
    const v = vs || {};
    const hv = !!vs;

    let startVal;
    if (!isVert) {
      const hw  = hv ? (v.handleWidth ?? 14) : HORIZ.handleW;
      const padX = Math.round(hw / 2) + 2;
      const trackW = logW - padX * 2;
      const clickT = clamp((e.clientX - rect.left - padX) / trackW, 0, 1);
      startVal = min + clickT * (max - min);
    } else {
      const hh  = hv ? (v.handleWidth ?? 14) : VERT.handleH;
      const labH = hv ? (v.labelSize ?? 10) + 4 : VERT.labelH;
      const valH = hv ? (v.valueSize ?? 12) + 2 : VERT.valueH;
      const padY = Math.round(hh / 2) + 2;
      const trackT = labH + padY;
      const trackH = logH - valH - padY - trackT;
      const clickT = clamp(1 - (e.clientY - rect.top - trackT) / trackH, 0, 1);
      startVal = min + clickT * (max - min);
    }
    startVal = clamp(applySnap(startVal, snapPoints, snapDeadZone), min, max);
    onChange?.(startVal);
    onDragStart?.();
    setDragging(true);
    document.body.style.cursor = 'grabbing';
    const startMouseX = e.clientX, startMouseY = e.clientY;

    function onMove(ev) {
      ev.preventDefault();
      const logW2 = container.offsetWidth, logH2 = container.offsetHeight;
      let delta;
      if (!isVert) {
        const hw  = hv ? (v.handleWidth ?? 14) : HORIZ.handleW;
        const trackW = logW2 - (Math.round(hw / 2) + 2) * 2;
        delta = ((ev.clientX - startMouseX) / trackW) * (max - min);
      } else {
        const hh  = hv ? (v.handleWidth ?? 14) : VERT.handleH;
        const labH = hv ? (v.labelSize ?? 10) + 4 : VERT.labelH;
        const valH = hv ? (v.valueSize ?? 12) + 2 : VERT.valueH;
        const padY = Math.round(hh / 2) + 2;
        const trackH = logH2 - valH - padY * 2 - labH;
        delta = ((startMouseY - ev.clientY) / trackH) * (max - min);
      }
      onChange?.(clamp(applySnap(startVal + delta, snapPoints, snapDeadZone), min, max));
    }
    function onUp() {
      setDragging(false);
      document.body.style.cursor = '';
      onRelease?.();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [isVert, min, max, snapPoints, snapDeadZone, onChange, onRelease, onDragStart, vs]);

  const handleDoubleClick = useCallback((e) => {
    e.preventDefault(); onChange?.(defaultValue); onRelease?.();
  }, [defaultValue, onChange, onRelease]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    pulseGlow(); // eslint-disable-line react-hooks/exhaustive-deps
    const coarse = e.shiftKey ? 10 : 1;
    const dir    = e.deltaY < 0 ? 1 : -1;
    onChange?.(clamp(applySnap(value + dir * step * coarse, snapPoints, snapDeadZone), min, max));
    onRelease?.();
  }, [value, step, min, max, snapPoints, snapDeadZone, onChange, onRelease]);

  // Container size overrides from vs
  const containerStyle = vs ? {
    height: isVert ? (vs.verticalHeight ?? 170) : (vs.horizontalHeight ?? 38),
    width:  isVert ? (vs.verticalWidth ?? 42)   : undefined,
    minHeight: isVert ? (vs.verticalHeight ?? 170) : undefined,
  } : {};

  return (
    <div ref={containerRef} className={`slider-root slider-root--${orientation}`} style={containerStyle}>
      <canvas
        ref={canvasRef} className="slider-canvas"
        style={{ cursor: dragging ? 'grabbing' : hovered ? 'grab' : 'default' }}
        onMouseDown={handleMouseDown} onDoubleClick={handleDoubleClick} onWheel={handleWheel}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      />
    </div>
  );
}
