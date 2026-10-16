// Behaviour for the Tolesh cloud prototype. Pure logic: no DOM, no network, no camera, no mic.
// Original work written for this project.
//
// Everything that changes over time is eased toward a target with a half-life, so state
// changes, cursor movement and blinks never jump. Timing is deterministic for a given seed
// and time, which keeps the animation deliberate and testable.

import { VIEW } from './cloud-scene.js';

export const STATE_NAMES = ['idle', 'listening', 'thinking', 'speaking', 'acting', 'error'];

// One entry per state. Values are targets; the controller eases to them.
export const STATES = {
  idle: {
    label: 'Idle',
    hint: 'Floating and ready. Move your cursor near me and I will notice.',
    open: 1.0, lidTilt: 0, raise: 0, worry: 0, smile: 0.35, tilt: 0, squash: 1,
    float: 1, breath: 1, glowCyan: 0.14, glowCoral: 0,
    gazeFollow: true, gaze: null, gazeDrift: false, mouth: 'smile',
  },
  listening: {
    label: 'Listening',
    hint: 'Attentive. Eyes on you and a little lift in the brows.',
    open: 1.06, lidTilt: 0, raise: 0.5, worry: 0, smile: 0.2, tilt: 2, squash: 1,
    float: 0.8, breath: 0.8, glowCyan: 0.22, glowCoral: 0,
    gazeFollow: true, gaze: [0, -0.05], gazeDrift: false, mouth: 'smile',
  },
  thinking: {
    label: 'Thinking',
    hint: 'Working it out. Gaze drifts up and to the side, with a slight head tilt.',
    open: 0.9, lidTilt: 0.3, raise: 0.15, worry: 0, smile: 0, tilt: -4, squash: 1,
    float: 0.5, breath: 0.6, glowCyan: 0.16, glowCoral: 0,
    gazeFollow: false, gaze: [-0.55, -0.45], gazeDrift: true, mouth: 'flat',
  },
  speaking: {
    label: 'Speaking',
    hint: 'Talking. The mouth follows the voice level and the cloud breathes with it.',
    open: 1.02, lidTilt: 0, raise: 0.2, worry: 0, smile: 0.4, tilt: 0, squash: 1,
    float: 0.9, breath: 1.2, glowCyan: 0.34, glowCoral: 0,
    gazeFollow: true, gaze: null, gazeDrift: false, mouth: 'speak',
  },
  acting: {
    label: 'Working on your task',
    hint: 'Focused on a task. Eyes narrow and look ahead. Stop is always available.',
    open: 0.82, lidTilt: 0, raise: -0.25, worry: 0, smile: 0.05, tilt: 0, squash: 1,
    float: 0.4, breath: 0.5, glowCyan: 0.26, glowCoral: 0,
    gazeFollow: false, gaze: [0, 0], gazeDrift: false, mouth: 'flat',
  },
  error: {
    label: 'Something went wrong',
    hint: 'Friendly and steady. Something failed. You can try again.',
    open: 0.9, lidTilt: 0.1, raise: 0.3, worry: 0.3, smile: 0.22, tilt: -2, squash: 0.975,
    float: 0.25, breath: 0.3, glowCyan: 0.08, glowCoral: 0.2,
    gazeFollow: false, gaze: [0, 0.4], gazeDrift: false, mouth: 'flat',
  },
};

const TAU = Math.PI * 2;
export const CENTER = { x: VIEW.cx, y: VIEW.cy };
const CLOUD_RADIUS = 140; // viewBox units, used for the cursor distance thresholds
export const NEAR_ENTER = 1.45 * CLOUD_RADIUS; // cursor counts as near inside this radius
export const NEAR_LEAVE = 1.7 * CLOUD_RADIUS; // hysteresis: stays near until this radius
export const LEAVE_DWELL = 1.2; // seconds the cursor must stay away before the cloud relaxes

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v) => clamp(v, 0, 1);

// Exponential ease with a half-life in seconds. Frame-rate independent.
export function easeToward(cur, target, dt, halfLife) {
  if (halfLife <= 0 || dt <= 0) return dt <= 0 ? cur : target;
  const a = 1 - Math.pow(2, -dt / halfLife);
  return cur + (target - cur) * a;
}

// Small deterministic PRNG (mulberry32). Same seed, same blinks.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Blink: 0.16 s, eyes close and reopen. Gaps are 2.4 to 5.2 s, drawn from the seed.
export const BLINK_DURATION = 0.16;
export function createBlinker(seed = 7) {
  const rng = mulberry32(seed);
  let next = 1.8 + rng() * 2.2;
  let start = -1;
  return {
    // Returns the openness multiplier: 1 = open, about 0.06 = closed.
    update(t) {
      if (start < 0 && t >= next) start = t;
      if (start < 0) return 1;
      const p = (t - start) / BLINK_DURATION;
      if (p >= 1) {
        start = -1;
        next = t + 2.4 + rng() * 2.8;
        return 1;
      }
      return 1 - 0.94 * Math.sin(Math.PI * p);
    },
  };
}

// Speech level for the simulated voice. Deterministic syllables with phrase shape.
export function simulatedSpeechLevel(t) {
  const syllable = 0.5 + 0.5 * Math.sin(TAU * 3.1 * t);
  const phrase = 0.6 + 0.4 * Math.sin(TAU * 0.45 * t + 1.3);
  return clamp01(syllable * phrase * 0.9 + 0.05);
}

// Level follower: fast attack, slower release, so the mouth does not flicker.
export function createLevel() {
  let v = 0;
  return {
    step(target, dt) {
      v = easeToward(v, clamp01(target), dt, target > v ? 0.035 : 0.12);
      return v;
    },
    get value() {
      return v;
    },
  };
}

// Cursor attention with hysteresis. Near when inside NEAR_ENTER, stays near until NEAR_LEAVE,
// then relaxes after LEAVE_DWELL seconds away.
export function createAttention() {
  let near = false;
  let away = 0;
  let amount = 0;
  return {
    update(dt, dist) {
      const inside = dist !== null && (near ? dist <= NEAR_LEAVE : dist < NEAR_ENTER);
      if (inside) {
        near = true;
        away = 0;
      } else if (near) {
        away += dt;
        if (away >= LEAVE_DWELL) near = false;
      }
      amount = easeToward(amount, near ? 1 : 0, dt, 0.25);
      return { near, amount };
    },
  };
}

// Gaze from a cursor point in viewBox units. tanh gives natural limits: the eyes never
// leave their socket, and they ease toward the edge instead of stopping hard.
export function gazeFromPoint(p) {
  return { gx: Math.tanh((p.x - CENTER.x) / 110), gy: Math.tanh((p.y - CENTER.y) / 110) };
}

// Keyboard support: arrows move a virtual cursor, Escape releases it.
export function nudgePointer(p, key) {
  if (key === 'Escape') return null;
  const step = 24;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (!moves[key]) return p;
  const cur = p ?? CENTER;
  return { x: clamp(cur.x + moves[key][0], -60, VIEW.w + 60), y: clamp(cur.y + moves[key][1], -60, VIEW.h + 60) };
}

const CHANNELS = ['open', 'lidTilt', 'raise', 'worry', 'smile', 'tilt', 'squash', 'float', 'breath', 'glowCyan', 'glowCoral'];

export function createCloudController({ seed = 7, reducedMotion = false } = {}) {
  let state = 'idle';
  let reduced = !!reducedMotion;
  let pointer = null;
  let externalLevel = null;
  const blinker = createBlinker(seed);
  const level = createLevel();
  const attention = createAttention();
  const ch = {};
  for (const k of CHANNELS) ch[k] = STATES.idle[k];
  ch.gx = 0;
  ch.gy = 0;

  return {
    setState(name) {
      if (!Object.prototype.hasOwnProperty.call(STATES, name)) throw new Error(`unknown state: ${name}`);
      state = name;
    },
    getState: () => state,
    setPointer(p) {
      pointer = p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
    },
    getPointer: () => pointer,
    setReducedMotion(v) {
      reduced = !!v;
    },
    getReducedMotion: () => reduced,
    // Optional real audio level (0..1) for speaking. Without it, the simulated voice is used.
    setLevel(v) {
      externalLevel = v == null || !Number.isFinite(v) ? null : clamp01(v);
    },

    frame(dt, t) {
      dt = clamp(dt, 0, 0.1); // at most 100 ms per step, so slow frames do not slow the animation much
      const S = STATES[state];
      const m = reduced ? 0 : 1;

      const blink = m ? blinker.update(t) : 1;
      const att = attention.update(dt, pointer ? Math.hypot(pointer.x - CENTER.x, pointer.y - CENTER.y) : null);

      const lvlTarget = state === 'speaking' ? (externalLevel ?? simulatedSpeechLevel(t)) : 0;
      const lvl = level.step(lvlTarget, dt);

      // Gaze target: the cursor when the state follows it, otherwise the state's own gaze.
      let g = { gx: 0, gy: 0 };
      if (S.gazeFollow && pointer) g = gazeFromPoint(pointer);
      else if (S.gaze) {
        g = { gx: S.gaze[0], gy: S.gaze[1] };
        if (S.gazeDrift && m) {
          g.gx += 0.12 * Math.sin((TAU * t) / 6);
          g.gy += 0.06 * Math.sin((TAU * t) / 4.3);
        }
      }
      const gazeHL = pointer && S.gazeFollow ? (reduced ? 0.22 : 0.12) : 0.35;
      ch.gx = easeToward(ch.gx, g.gx, dt, gazeHL);
      ch.gy = easeToward(ch.gy, g.gy, dt, gazeHL);

      // Noticing the cursor: a small lean toward it and slightly wider eyes.
      const leanSign = pointer ? Math.sign(pointer.x - CENTER.x) : 0;
      const targets = {
        open: S.open + 0.04 * att.amount,
        lidTilt: S.lidTilt,
        raise: S.raise,
        worry: S.worry,
        smile: S.smile,
        tilt: S.tilt + m * 3.5 * att.amount * leanSign,
        squash: S.squash,
        float: S.float,
        breath: S.breath,
        glowCyan: S.glowCyan + 0.2 * lvl,
        glowCoral: S.glowCoral,
      };
      for (const k of CHANNELS) ch[k] = easeToward(ch[k], targets[k], dt, 0.3);

      const floatY = m * ch.float * 4.5 * Math.sin((TAU * t) / 4.2);
      const breath = m * ch.breath * 0.012 * Math.sin((TAU * t) / 3.6);
      const bounce = m * 0.01 * lvl;

      return {
        state,
        tilt: ch.tilt,
        floatY,
        scaleX: ch.squash * (1 + breath * 0.6),
        scaleY: ch.squash * (1 + breath + bounce),
        open: clamp(ch.open * blink, 0.06, 1.12),
        lidTilt: ch.lidTilt,
        raise: ch.raise,
        worry: ch.worry,
        smile: ch.smile,
        gx: clamp(ch.gx, -1, 1),
        gy: clamp(ch.gy, -1, 1),
        mouthOpen: S.mouth === 'speak' ? lvl : 0,
        glowCyan: clamp01(ch.glowCyan),
        glowCoral: clamp01(ch.glowCoral),
        near: att.near,
      };
    },
  };
}

export function describeState(name) {
  const S = STATES[name];
  if (!S) throw new Error(`unknown state: ${name}`);
  return { label: S.label, hint: S.hint };
}
