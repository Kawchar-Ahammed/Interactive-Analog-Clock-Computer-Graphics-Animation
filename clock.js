/* ==========================================================================
   Interactive Analog Clock
   State -> Input -> Transformation -> Rendering -> Canvas
   ========================================================================== */

const canvas = document.getElementById('clockCanvas');
const ctx = canvas.getContext('2d');
const digitalReadout = document.getElementById('digitalReadout');
const dateReadout = document.getElementById('dateReadout');
const viewportValue = document.getElementById('viewportValue');
const zoomSlider = document.getElementById('zoomSlider');
const resetBtn = document.getElementById('resetBtn');
const formatToggle = document.getElementById('formatToggle');
const smoothToggle = document.getElementById('smoothToggle');
const themeMidnightBtn = document.getElementById('themeMidnight');
const themePaperBtn = document.getElementById('themePaper');

const mathHourAngle = document.getElementById('mathHourAngle');
const mathMinAngle = document.getElementById('mathMinAngle');
const mathSecAngle = document.getElementById('mathSecAngle');
const mathScale = document.getElementById('mathScale');
const mathOffsetX = document.getElementById('mathOffsetX');
const mathOffsetY = document.getElementById('mathOffsetY');
const dotTranslation = document.getElementById('dotTranslation');
const dotScaling = document.getElementById('dotScaling');
const angleDiagram = document.getElementById('angleDiagram');
const diagramCtx = angleDiagram ? angleDiagram.getContext('2d') : null;

/* --------------------------------------------------------------------
   1. APPLICATION STATE
   -------------------------------------------------------------------- */
const state = {
  offsetX: 0,        // translation offset (drawing-space px), applied around canvas center
  offsetY: 0,
  scale: 1,           // uniform zoom factor
  minScale: 0.5,
  maxScale: 2.5,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragOffsetStartX: 0,
  dragOffsetStartY: 0,
  is24h: false,
  smoothSeconds: true,
  theme: 'dark',
  baseRadius: 200,    // logical clock radius before scale/DPR (in CSS px units)
  scaleActiveUntil: 0, // performance.now() timestamp until which the scaling indicator pulses
};

/* --------------------------------------------------------------------
   Canvas sizing (handles devicePixelRatio for crisp rendering)
   -------------------------------------------------------------------- */
let cssSize = 500;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  cssSize = rect.width;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 1 unit in ctx == 1 CSS px
  state.baseRadius = cssSize * 0.4;
}

window.addEventListener('resize', resizeCanvas);

/* --------------------------------------------------------------------
   2. INPUT HANDLING
   Handlers only mutate state; they never draw directly.
   -------------------------------------------------------------------- */

function getPointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const point = evt.touches ? evt.touches[0] : evt;
  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top,
  };
}

function onPointerDown(evt) {
  const pos = getPointerPos(evt);
  state.isDragging = true;
  state.dragStartX = pos.x;
  state.dragStartY = pos.y;
  state.dragOffsetStartX = state.offsetX;
  state.dragOffsetStartY = state.offsetY;
  canvas.style.cursor = 'grabbing';
}

function onPointerMove(evt) {
  if (!state.isDragging) return;
  evt.preventDefault();
  const pos = getPointerPos(evt);
  state.offsetX = state.dragOffsetStartX + (pos.x - state.dragStartX);
  state.offsetY = state.dragOffsetStartY + (pos.y - state.dragStartY);
}

function onPointerUp() {
  state.isDragging = false;
  canvas.style.cursor = 'grab';
}

function clampScale(value) {
  return Math.min(state.maxScale, Math.max(state.minScale, value));
}

function updateViewportStat() {
  viewportValue.textContent = `${Math.round(state.scale * 100)}%`;
}

function onWheel(evt) {
  evt.preventDefault();
  const zoomIntensity = 0.0015;
  const factor = 1 - evt.deltaY * zoomIntensity;
  state.scale = clampScale(state.scale * factor);
  zoomSlider.value = state.scale.toFixed(2);
  updateViewportStat();
  state.scaleActiveUntil = performance.now() + 500;
}

function onSliderInput(evt) {
  state.scale = clampScale(parseFloat(evt.target.value));
  updateViewportStat();
  state.scaleActiveUntil = performance.now() + 500;
}

function onReset() {
  state.offsetX = 0;
  state.offsetY = 0;
  state.scale = 1;
  zoomSlider.value = 1;
  updateViewportStat();
}

function onFormatToggle() {
  state.is24h = formatToggle.checked;
}

function onSmoothToggle() {
  state.smoothSeconds = smoothToggle.checked;
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  themeMidnightBtn.classList.toggle('is-active', theme === 'dark');
  themePaperBtn.classList.toggle('is-active', theme === 'light');
}

canvas.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);

canvas.addEventListener('touchstart', onPointerDown, { passive: true });
window.addEventListener('touchmove', onPointerMove, { passive: false });
window.addEventListener('touchend', onPointerUp);

canvas.addEventListener('wheel', onWheel, { passive: false });
zoomSlider.addEventListener('input', onSliderInput);
resetBtn.addEventListener('click', onReset);
formatToggle.addEventListener('change', onFormatToggle);
smoothToggle.addEventListener('change', onSmoothToggle);
themeMidnightBtn.addEventListener('click', () => setTheme('dark'));
themePaperBtn.addEventListener('click', () => setTheme('light'));

/* --------------------------------------------------------------------
   3. TRANSFORMATION / COMPUTATION
   -------------------------------------------------------------------- */

// Angle convention: 0 = 12 o'clock, increasing clockwise (standard clock-face angle).
// Canvas rotate() is already clockwise-positive from the positive x-axis, so we
// offset by -90deg (i.e. -PI/2) to align "0" with 12 o'clock.
function faceAngleToCanvasRotation(faceAngleRad) {
  return faceAngleRad - Math.PI / 2;
}

function getHandAngles(now) {
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ms = now.getMilliseconds();

  // Second hand: smooth (sub-second) or discrete per-second tick, per user toggle.
  const secFraction = state.smoothSeconds ? seconds + ms / 1000 : seconds;
  const secAngle = (secFraction / 60) * 2 * Math.PI;

  // Minute hand advances smoothly across the minute (includes seconds).
  const minFraction = minutes + (seconds + ms / 1000) / 60;
  const minAngle = (minFraction / 60) * 2 * Math.PI;

  // Hour hand depends on minutes so it moves smoothly across the hour, not in jumps.
  const hourFraction = hours + minFraction / 60;
  const hourAngle = (hourFraction / 12) * 2 * Math.PI;

  return { hourAngle, minAngle, secAngle };
}

/* --------------------------------------------------------------------
   4. RENDERING
   Reads state only; never mutates it. Draw order: face -> ticks -> numerals -> hands -> center.
   -------------------------------------------------------------------- */

function getThemeColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function drawFace(radius) {
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = getThemeColor('--clock-face');
  ctx.fill();
  ctx.lineWidth = radius * 0.025;
  ctx.strokeStyle = getThemeColor('--clock-ring');
  ctx.stroke();
}

function drawTicks(radius) {
  for (let i = 0; i < 60; i++) {
    const isHourTick = i % 5 === 0;
    const angle = faceAngleToCanvasRotation((i / 60) * 2 * Math.PI);
    const outer = radius * 0.95;
    const inner = isHourTick ? radius * 0.82 : radius * 0.90;

    const x1 = Math.cos(angle) * outer;
    const y1 = Math.sin(angle) * outer;
    const x2 = Math.cos(angle) * inner;
    const y2 = Math.sin(angle) * inner;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = isHourTick ? radius * 0.02 : radius * 0.008;
    ctx.strokeStyle = isHourTick
      ? getThemeColor('--clock-tick-major')
      : getThemeColor('--clock-tick-minor');
    ctx.stroke();
  }
}

function drawNumerals(radius) {
  ctx.fillStyle = getThemeColor('--clock-numeral');
  ctx.font = `600 ${radius * 0.16}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let hour = 1; hour <= 12; hour++) {
    const angle = faceAngleToCanvasRotation((hour / 12) * 2 * Math.PI);
    const r = radius * 0.68;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    ctx.fillText(String(hour), x, y);
  }
}

// Draws a single hand as a rotated shape. Rotation is applied via the
// Canvas transform stack (save/rotate/restore), not manual per-point trig.
function drawHand(angleRad, length, width, color) {
  ctx.save();
  ctx.rotate(faceAngleToCanvasRotation(angleRad));
  ctx.beginPath();
  ctx.moveTo(-length * 0.15, 0); // small tail behind the pivot
  ctx.lineTo(length, 0);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

function drawHands(radius, angles) {
  drawHand(angles.hourAngle, radius * 0.5, radius * 0.045, getThemeColor('--clock-hour-hand'));
  drawHand(angles.minAngle, radius * 0.72, radius * 0.03, getThemeColor('--clock-minute-hand'));
  drawHand(angles.secAngle, radius * 0.8, radius * 0.012, getThemeColor('--clock-second-hand'));
}

function drawCenter(radius) {
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.03, 0, Math.PI * 2);
  ctx.fillStyle = getThemeColor('--clock-center');
  ctx.fill();
}

function updateDigitalReadout(now) {
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  let suffix = '';

  if (!state.is24h) {
    suffix = hours >= 12 ? ' PM' : ' AM';
    hours = hours % 12 || 12;
  }

  digitalReadout.textContent = `${String(hours).padStart(2, '0')}:${minutes}:${seconds}${suffix}`;
  dateReadout.textContent = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// --- Live math readout + rubric-concept indicators (info panel) ---
function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

function updateInfoPanel(angles) {
  if (mathHourAngle) mathHourAngle.textContent = `${radToDeg(angles.hourAngle).toFixed(1)}°`;
  if (mathMinAngle) mathMinAngle.textContent = `${radToDeg(angles.minAngle).toFixed(1)}°`;
  if (mathSecAngle) mathSecAngle.textContent = `${radToDeg(angles.secAngle).toFixed(1)}°`;
  if (mathScale) mathScale.textContent = `${Math.round(state.scale * 100)}%`;
  if (mathOffsetX) mathOffsetX.textContent = `${Math.round(state.offsetX)}px`;
  if (mathOffsetY) mathOffsetY.textContent = `${Math.round(state.offsetY)}px`;

  if (dotTranslation) dotTranslation.classList.toggle('is-active', state.isDragging);
  if (dotScaling) dotScaling.classList.toggle('is-active', performance.now() < state.scaleActiveUntil);
}

// Small live unit-circle diagram: draws the same three hand angles used on
// the main clock, so the underlying angle math is visible at a glance.
function drawAngleDiagram(angles) {
  if (!diagramCtx) return;
  const size = angleDiagram.width;
  const r = size / 2 - 6;

  diagramCtx.clearRect(0, 0, size, size);
  diagramCtx.save();
  diagramCtx.translate(size / 2, size / 2);

  // outer circle
  diagramCtx.beginPath();
  diagramCtx.arc(0, 0, r, 0, Math.PI * 2);
  diagramCtx.strokeStyle = getThemeColor('--panel-border');
  diagramCtx.lineWidth = 1;
  diagramCtx.stroke();

  // 12 o'clock reference tick
  diagramCtx.beginPath();
  diagramCtx.moveTo(0, -r);
  diagramCtx.lineTo(0, -r + 6);
  diagramCtx.strokeStyle = getThemeColor('--muted');
  diagramCtx.stroke();

  const arrows = [
    { angle: angles.hourAngle, len: r * 0.55, color: getThemeColor('--diagram-hour'), width: 2.5 },
    { angle: angles.minAngle, len: r * 0.8, color: getThemeColor('--diagram-min'), width: 2 },
    { angle: angles.secAngle, len: r * 0.92, color: getThemeColor('--diagram-sec'), width: 1.4 },
  ];

  arrows.forEach(({ angle, len, color, width }) => {
    diagramCtx.save();
    diagramCtx.rotate(faceAngleToCanvasRotation(angle));
    diagramCtx.beginPath();
    diagramCtx.moveTo(0, 0);
    diagramCtx.lineTo(len, 0);
    diagramCtx.strokeStyle = color;
    diagramCtx.lineWidth = width;
    diagramCtx.lineCap = 'round';
    diagramCtx.stroke();
    diagramCtx.restore();
  });

  diagramCtx.beginPath();
  diagramCtx.arc(0, 0, 2.5, 0, Math.PI * 2);
  diagramCtx.fillStyle = getThemeColor('--text');
  diagramCtx.fill();

  diagramCtx.restore();
}

function render(now) {
  ctx.clearRect(0, 0, cssSize, cssSize);

  const angles = getHandAngles(now);

  // --- TRANSFORMATION STACK ---
  // Order: move to canvas center -> apply translation offset -> apply scale.
  // Everything drawn after this point is in clock-local coordinates (0,0 = clock center).
  ctx.save();
  ctx.translate(cssSize / 2, cssSize / 2); // base center
  ctx.translate(state.offsetX, state.offsetY); // user translation
  ctx.scale(state.scale, state.scale);         // user zoom

  const radius = state.baseRadius;

  drawFace(radius);
  drawTicks(radius);
  drawNumerals(radius);
  drawHands(radius, angles);
  drawCenter(radius);

  ctx.restore();

  updateDigitalReadout(now);
  updateInfoPanel(angles);
  drawAngleDiagram(angles);
}

/* --------------------------------------------------------------------
   5. ANIMATION LOOP
   -------------------------------------------------------------------- */
function loop() {
  render(new Date());
  requestAnimationFrame(loop);
}

/* --------------------------------------------------------------------
   Init
   -------------------------------------------------------------------- */
resizeCanvas();
updateViewportStat();
requestAnimationFrame(loop);
