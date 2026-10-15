// Browser glue for the Tolesh cloud prototype. Original work. No network, camera, or mic.
import { createCloudController, describeState, nudgePointer } from './cloud-core.js';
import { cloudInnerMarkup, poseAttrs, VIEW } from './cloud-scene.js';

const svg = document.getElementById('cloud');
const stage = document.getElementById('stage');
const labelEl = document.getElementById('state-label');
const hintEl = document.getElementById('state-hint');
const reduceBtn = document.getElementById('toggle-reduce');
const voiceBtn = document.getElementById('toggle-voice');
const stateButtons = [...document.querySelectorAll('[data-state]')];

const reducedByOs = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ctrl = createCloudController({ seed: 7, reducedMotion: reducedByOs });

// Build the markup once, then update attributes per frame.
svg.innerHTML = cloudInnerMarkup(poseAttrs(ctrl.frame(0, 0)));
const els = {};
svg.querySelectorAll('[data-k]').forEach((n) => {
  els[n.dataset.k] = n;
});

function apply(pose) {
  const A = poseAttrs(pose);
  for (const key in A) {
    const node = els[key];
    if (!node) continue;
    for (const attr in A[key]) node.setAttribute(attr, A[key][attr]);
  }
}

// Frame loop. dt is clamped in the controller, so a hidden tab cannot cause a jump.
let t0 = null;
let last = null;
function tick(now) {
  if (t0 === null) t0 = now;
  const t = (now - t0) / 1000;
  const dt = last === null ? 0 : (now - last) / 1000;
  last = now;
  apply(ctrl.frame(dt, t));
  requestAnimationFrame(tick);
}

// Cursor, touch, and pen. Coordinates are mapped into viewBox units.
function toView(e) {
  const r = svg.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * VIEW.w, y: ((e.clientY - r.top) / r.height) * VIEW.h };
}
stage.addEventListener('pointermove', (e) => ctrl.setPointer(toView(e)));
stage.addEventListener('pointerdown', (e) => ctrl.setPointer(toView(e)));
stage.addEventListener('pointerleave', () => ctrl.setPointer(null));
stage.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'touch') ctrl.setPointer(null);
});
stage.addEventListener('pointercancel', () => ctrl.setPointer(null));

// Keyboard: when the cloud has focus, arrows move a virtual cursor and Escape releases it.
svg.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) return;
  e.preventDefault();
  ctrl.setPointer(nudgePointer(ctrl.getPointer(), e.key));
});
svg.addEventListener('blur', () => ctrl.setPointer(null));

function setState(name) {
  ctrl.setState(name);
  const { label, hint } = describeState(name);
  labelEl.textContent = label;
  hintEl.textContent = hint;
  for (const b of stateButtons) b.setAttribute('aria-pressed', String(b.dataset.state === name));
}

for (const b of stateButtons) {
  b.addEventListener('click', () => setState(b.dataset.state));
}

function setReduced(on) {
  ctrl.setReducedMotion(on);
  reduceBtn.setAttribute('aria-pressed', String(on));
}
reduceBtn.addEventListener('click', () => setReduced(!ctrl.getReducedMotion()));
setReduced(reducedByOs);

// Voice level: simulated (default) or silent. A real audio level can be passed later.
voiceBtn.addEventListener('click', () => {
  const on = voiceBtn.getAttribute('aria-pressed') !== 'true';
  voiceBtn.setAttribute('aria-pressed', String(on));
  ctrl.setLevel(on ? null : 0);
});

setState('idle');
requestAnimationFrame(tick);
