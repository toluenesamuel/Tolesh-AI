// Adapter: drives the Tolesh cloud avatar from the probe's modes and real audio levels.
// Original work. No network, camera, or microphone access in this file.
//
// Rules this adapter keeps:
// - Speaking takes its level only from the caller (the real output analyser). It never passes
//   null to the controller, because null would switch the cloud to its built-in simulated voice.
// - Listening takes its level only from the caller (the real microphone analyser).
// - Paused means the caller stops calling update(), so the cloud freezes.
import { createCloudController, describeState } from './cloud/cloud-core.js';
import { cloudInnerMarkup, poseAttrs, VIEW } from './cloud/cloud-scene.js';

// Probe modes to cloud states. "processing" is the probe's name for thinking.
export const MODE_TO_STATE = {
  idle: 'idle',
  listening: 'listening',
  processing: 'thinking',
  speaking: 'speaking',
  acting: 'acting',
  error: 'error',
};

export function createCloudView(svg, { reducedMotion = false, seed = 7 } = {}) {
  const ctrl = createCloudController({ seed, reducedMotion });
  svg.setAttribute('viewBox', `0 0 ${VIEW.w} ${VIEW.h}`);
  svg.innerHTML = cloudInnerMarkup(poseAttrs(ctrl.frame(0, 0)));
  const els = {};
  svg.querySelectorAll('[data-k]').forEach((n) => {
    els[n.dataset.k] = n;
  });

  let mode = 'idle';
  let t0 = null;
  let last = null;
  ctrl.setState('idle');

  function apply(pose) {
    const A = poseAttrs(pose);
    for (const key in A) {
      const node = els[key];
      if (!node) continue;
      for (const attr in A[key]) node.setAttribute(attr, A[key][attr]);
    }
  }

  return {
    kind: 'svg-cloud',
    setMode(m) {
      if (!Object.prototype.hasOwnProperty.call(MODE_TO_STATE, m)) throw new Error(`unknown mode: ${m}`);
      if (m === mode) return;
      mode = m;
      ctrl.setState(MODE_TO_STATE[m]);
    },
    getMode: () => mode,
    // Numbers only. 0 means "no real audio": the mouth stays closed.
    setInputLevel(v) {
      ctrl.setInputLevel(Number.isFinite(v) ? v : 0);
    },
    setOutputLevel(v) {
      ctrl.setLevel(Number.isFinite(v) ? v : 0);
    },
    setPointer(p) {
      ctrl.setPointer(p);
    },
    setReducedMotion(on) {
      ctrl.setReducedMotion(on);
    },
    // Advance to time now (ms) and draw. Returns the pose that was drawn.
    update(now) {
      if (t0 === null) t0 = now;
      const t = (now - t0) / 1000;
      const dt = last === null ? 0 : (now - last) / 1000;
      last = now;
      const pose = ctrl.frame(dt, t);
      apply(pose);
      return pose;
    },
    // Hint for a probe mode. Takes the mode explicitly, so text is right before the next frame.
    hintFor: (m) => describeState(MODE_TO_STATE[m] ?? 'idle').hint,
  };
}

// Pointer and touch: coordinates are mapped into the cloud's viewBox. Touch releases on lift.
export function bindPointer(svg, stage, view) {
  const toView = (e) => {
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * VIEW.w, y: ((e.clientY - r.top) / r.height) * VIEW.h };
  };
  stage.addEventListener('pointermove', (e) => view.setPointer(toView(e)));
  stage.addEventListener('pointerdown', (e) => view.setPointer(toView(e)));
  stage.addEventListener('pointerleave', () => view.setPointer(null));
  stage.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') view.setPointer(null);
  });
  stage.addEventListener('pointercancel', () => view.setPointer(null));
}
