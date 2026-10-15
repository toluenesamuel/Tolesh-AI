// Pure logic for the orb demo: modes, targets, easing and a test speech envelope.
// No DOM and no audio here, so it can be tested with Node's built-in test runner.

export const MODES = ['idle', 'listening', 'processing', 'speaking', 'acting', 'error'];

export const LABELS = {
  idle: 'Idle',
  listening: 'Listening',
  processing: 'Processing',
  speaking: 'Speaking',
  acting: 'Acting',
  error: 'Error',
};

// Electric blue is the body colour in every state (proposed Tolesh identity: #3D9BFF).
export const BASE = [0.239, 0.608, 1.0];
// Deep blue for the shaded side of the body (#1A3FA8).
export const DEEP = [0.102, 0.247, 0.659];

// Each state adds its own accent to the rim, halo and internal glow. Values match the FRONTEND plan palette.
export const ACCENT = {
  idle: [0.561, 0.639, 0.761],       // slate   #8FA3C2
  listening: [0.310, 0.890, 0.784],  // teal    #4FE3C8
  processing: [0.961, 0.725, 0.306], // amber   #F5B94E
  speaking: [0.435, 0.827, 1.0],     // sky     #6FD3FF
  acting: [0.710, 0.949, 0.420],     // lime    #B5F26B
  error: [1.0, 0.541, 0.541],        // coral   #FF8A8A
};

// Motion per state. speed scales the internal clock; circ makes the inner colour circulate;
// active shows the acting arc; err calms the shape and dims the glow.
// tint: how much the state accent mixes into the body and halo (0 = pure electric blue, 1 = pure accent).
// dim: body brightness multiplier (error dims slightly, without flashing).
export const MOTION = {
  idle:       { speed: 0.5, flowAmp: 0.6, circ: 0, active: 0, err: 0, tint: 0.00, dim: 1 },
  listening:  { speed: 0.9, flowAmp: 0.8, circ: 0, active: 0, err: 0, tint: 0.25, dim: 1 },
  processing: { speed: 1.5, flowAmp: 1.0, circ: 1, active: 0, err: 0, tint: 0.35, dim: 1 },
  speaking:   { speed: 1.1, flowAmp: 0.9, circ: 0, active: 0, err: 0, tint: 0.45, dim: 1 },
  acting:     { speed: 0.9, flowAmp: 0.7, circ: 0, active: 1, err: 0, tint: 0.25, dim: 1 },
  error:      { speed: 0.15, flowAmp: 0.4, circ: 0, active: 0, err: 1, tint: 0.85, dim: 0.82 },
};

export const MOTION_TEXT = {
  idle: 'Resting. Slow breathing and a slow inner glow.',
  listening: 'Listening. The rim and glow follow the microphone level.',
  processing: 'Processing. Colour circulates inside the orb. No audio is used.',
  speaking: 'Speaking. Pulses follow the voice output.',
  acting: 'Acting. A steady arc sweeps round the orb.',
  error: 'Something went wrong. Calm rim, no flashing. Tap Idle to clear it.',
};

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

// Exponential approach: rises at `rise` per second and falls at `fall` per second.
export function approach(cur, target, dt, rise, fall) {
  const k = target > cur ? rise : fall;
  return cur + (target - cur) * (1 - Math.exp(-dt * k));
}

// Microphone RMS to a 0..1 display and orb level.
export const rmsToLevel = (rms) => clamp(rms * 6);

// Deterministic, speech-like envelope for the simulated reply: syllable bursts with short phrase pauses.
// Returns 0..1. Used for the test tone and for the Speaking pulse when no audio is playing.
export function speechEnvelope(t) {
  const phrase = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 3.2);
  if (phrase < 0.18) return 0.04;                       // short pause between phrases
  const s = (t * 4.2) % 1;                              // about 4 syllables per second
  const burst = Math.pow(Math.sin(Math.PI * s), 2);
  return clamp((0.15 + 0.85 * burst) * (0.55 + 0.45 * phrase));
}

// Everything the renderer needs for one frame, from the mode and the live inputs.
// opts: { level, speak, paused, reduced }
export function targetsFor(mode, opts = {}) {
  const m = MOTION[mode];
  if (!m) throw new Error(`unknown mode: ${mode}`);
  const paused = !!opts.paused;
  return {
    accent: ACCENT[mode].slice(),
    speed: paused ? 0 : m.speed,
    flowAmp: m.flowAmp,
    circ: m.circ,
    active: m.active,
    err: m.err,
    tint: m.tint,
    level: mode === 'listening' ? clamp(opts.level || 0) : 0,
    speak: mode === 'speaking' ? clamp(opts.speak || 0) : 0,
    bright: paused ? 0.6 * m.dim : m.dim,
    reduced: !!opts.reduced,
  };
}
