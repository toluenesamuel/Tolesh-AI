// Simulated eye for the orb: gaze, blink, lid openness and pupil size.
// There is NO camera here. The eye never tracks the user. Its movement is a schedule of drift,
// small saccades and blinks, shaped by the current reaction state. Pure logic, no DOM, testable in Node.
import { clamp } from './state.js';

// Per-state eye character. lookX/lookY: where the eye rests. wander: slow drift. saccade: size of small jumps.
// open: lid openness (1 = normal). pupil: 0 = small, 1 = large.
export const EYE_PARAMS = {
  idle:       { open: 1.00, pupil: 0.40, lookX: 0.00,  lookY: 0.00,  wander: 0.14, saccade: 0.08 },
  listening:  { open: 1.04, pupil: 0.50, lookX: 0.00,  lookY: 0.00,  wander: 0.02, saccade: 0.00 }, // centred, attentive
  processing: { open: 0.92, pupil: 0.45, lookX: -0.22, lookY: 0.20,  wander: 0.10, saccade: 0.00 }, // gently up and aside
  speaking:   { open: 1.08, pupil: 0.60, lookX: 0.00,  lookY: 0.00,  wander: 0.05, saccade: 0.05 },
  acting:     { open: 0.96, pupil: 0.20, lookX: 0.00,  lookY: 0.00,  wander: 0.00, saccade: 0.00 }, // focused forward
  error:      { open: 0.62, pupil: 0.35, lookX: 0.00,  lookY: -0.10, wander: 0.00, saccade: 0.00 }, // lids lowered, still
};

const BLINK_S = 0.18;     // one blink lasts about 180 ms
const GAZE_LIMIT = 0.4;   // gaze stays inside the lens

// Blink and saccade timing. `rand` is injected so the tests are deterministic.
export function createEye(rand = Math.random) {
  let nextBlink = 1.5 + rand() * 2;   // seconds of page time
  let blinkStart = null;
  let saccadeAt = 2 + rand() * 2;
  let saccadeX = 0, saccadeY = 0;

  return {
    // tSec: page time in seconds. mode: one of the six states. opts: { level, speak, reduced, paused }
    step(tSec, mode, opts = {}) {
      const P = EYE_PARAMS[mode];
      if (!P) throw new Error(`unknown eye mode: ${mode}`);
      const frozen = !!opts.reduced || !!opts.paused;
      const level = clamp(opts.level || 0);
      const speak = clamp(opts.speak || 0);

      let blink = 0;
      if (!frozen) {
        // Blinks are rarer when the eye is lowered (error) or focused (acting).
        const mult = mode === 'error' ? 1.6 : mode === 'acting' ? 1.4 : 1;
        if (blinkStart === null && tSec >= nextBlink) {
          blinkStart = tSec;
          nextBlink = tSec + (2.5 + rand() * 3) * mult;
        }
        if (blinkStart !== null) {
          const p = (tSec - blinkStart) / BLINK_S;
          if (p >= 1) blinkStart = null;
          else blink = Math.sin(Math.PI * p);            // 0 at the ends, 1 at the midpoint
        }
        if (P.saccade === 0) {
          saccadeX = 0; saccadeY = 0;
        } else if (tSec >= saccadeAt) {
          saccadeX = (rand() * 2 - 1) * P.saccade;
          saccadeY = (rand() * 2 - 1) * P.saccade * 0.6;
          saccadeAt = tSec + 2.5 + rand() * 2.5;
        }
      }

      const wob = frozen ? 0 : P.wander;
      const sx = frozen ? 0 : saccadeX;
      const sy = frozen ? 0 : saccadeY;
      const gx = clamp(P.lookX + wob * Math.sin(tSec * 0.37) * Math.cos(tSec * 0.23) + sx, -GAZE_LIMIT, GAZE_LIMIT);
      const gy = clamp(P.lookY + wob * Math.cos(tSec * 0.31) + sy, -GAZE_LIMIT, GAZE_LIMIT);

      // Listening widens the eye with the microphone level; speaking widens it with the output level.
      const lift = (mode === 'listening' ? 0.10 * level : 0) + (mode === 'speaking' ? 0.12 * speak : 0);
      const open = clamp((P.open + lift) * (1 - 0.95 * blink), 0, 1.2);
      const pupil = clamp(P.pupil + (mode === 'listening' ? 0.25 * level : 0) + (mode === 'speaking' ? 0.25 * speak : 0), 0, 1);
      return { gx, gy, open, pupil, blink };
    },
  };
}
