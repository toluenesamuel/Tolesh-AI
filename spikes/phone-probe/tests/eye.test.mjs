// Node built-in tests for the simulated eye (no camera, no dependencies).
// Run from spikes/phone-probe:  node --test tests/eye.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createEye, EYE_PARAMS } from '../eye.js';
import { MODES } from '../state.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(here, '..', f), 'utf8');

// Deterministic random source for repeatable blink and saccade timing.
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function run(mode, seconds, opts = {}, seed = 7) {
  const eye = createEye(seeded(seed));
  const out = [];
  for (let t = 0; t <= seconds; t += 1 / 60) out.push({ t, ...eye.step(t, mode, opts) });
  return out;
}

test('every reaction state has eye parameters', () => {
  for (const m of MODES) assert.ok(EYE_PARAMS[m], `eye params for ${m}`);
});

test('gaze stays inside the lens in every state', () => {
  for (const m of MODES) {
    for (const f of run(m, 30)) {
      assert.ok(Math.abs(f.gx) <= 0.4 + 1e-9 && Math.abs(f.gy) <= 0.4 + 1e-9, `${m} gaze out of range`);
    }
  }
});

test('openness and pupil stay in range', () => {
  for (const m of MODES) {
    for (const f of run(m, 30, { level: 1, speak: 1 })) {
      assert.ok(f.open >= 0 && f.open <= 1.2, `${m} open ${f.open}`);
      assert.ok(f.pupil >= 0 && f.pupil <= 1, `${m} pupil ${f.pupil}`);
    }
  }
});

test('idle blinks naturally: at least one blink in 12 s, and each blink is short', () => {
  const frames = run('idle', 12);
  const blinking = frames.filter((f) => f.blink > 0.05);
  assert.ok(blinking.length > 0, 'expected a blink');
  const episodes = frames.reduce((n, f, i) => (f.blink > 0.05 && (i === 0 || frames[i - 1].blink <= 0.05) ? n + 1 : n), 0);
  assert.ok(episodes >= 2, `expected at least 2 blinks in 12 s, got ${episodes}`);
  assert.ok(blinking.length / frames.length < 0.1, 'eye should be open most of the time');
});

test('blink closes the lids and then reopens them', () => {
  const frames = run('idle', 12);
  const closed = frames.filter((f) => f.blink > 0.9);
  assert.ok(closed.length > 0, 'expected a near-closed frame');
  assert.ok(Math.min(...closed.map((f) => f.open)) < 0.2, 'lids should close');
  assert.ok(frames[frames.length - 1].open > 0.9, 'eye reopens');
});

test('listening: looks at the user (centred) and widens with the microphone level', () => {
  const quiet = run('listening', 10, { level: 0 });
  const loud = run('listening', 10, { level: 1 });
  const maxAbsGaze = Math.max(...quiet.map((f) => Math.max(Math.abs(f.gx), Math.abs(f.gy))));
  assert.ok(maxAbsGaze < 0.05, `listening gaze should stay centred, got ${maxAbsGaze}`);
  const avg = (a, k) => a.reduce((s, f) => s + f[k], 0) / a.length;
  assert.ok(avg(loud, 'open') > avg(quiet, 'open'), 'eye widens with voice level');
  assert.ok(avg(loud, 'pupil') > avg(quiet, 'pupil'), 'pupil grows with voice level');
});

test('processing: gaze drifts up and to one side, not centred', () => {
  const f = run('processing', 10);
  const avgX = f.reduce((s, x) => s + x.gx, 0) / f.length;
  const avgY = f.reduce((s, x) => s + x.gy, 0) / f.length;
  assert.ok(avgX < -0.1 && avgY > 0.1, `expected up and aside, got ${avgX.toFixed(2)}, ${avgY.toFixed(2)}`);
});

test('speaking: eye widens with the output level', () => {
  const quiet = run('speaking', 10, { speak: 0 });
  const loud = run('speaking', 10, { speak: 1 });
  const avg = (a, k) => a.reduce((s, f) => s + f[k], 0) / a.length;
  assert.ok(avg(loud, 'open') > avg(quiet, 'open'));
  assert.ok(avg(loud, 'pupil') > avg(quiet, 'pupil'));
});

test('acting: focused forward with a small pupil and no wandering', () => {
  const f = run('acting', 10);
  assert.ok(Math.max(...f.map((x) => Math.max(Math.abs(x.gx), Math.abs(x.gy)))) < 0.01, 'acting gaze is fixed forward');
  const avgPupil = f.reduce((s, x) => s + x.pupil, 0) / f.length;
  assert.ok(avgPupil < 0.3, 'focused pupil is small');
});

test('error: lids lowered and steady, distinct from idle', () => {
  const err = run('error', 10);
  const idle = run('idle', 10);
  const avg = (a, k) => a.reduce((s, f) => s + f[k], 0) / a.length;
  assert.ok(avg(err, 'open') < avg(idle, 'open') - 0.2, 'error eye is lowered');
  assert.ok(err.every((x) => x.gx === err[0].gx && x.gy === err[0].gy), 'error gaze is steady, not drifting');
});

test('reduced motion: no blinks, no drift, no saccades', () => {
  for (const m of MODES) {
    const f = run(m, 20, { reduced: true, level: 0.5, speak: 0.5 });
    assert.ok(f.every((x) => x.blink === 0), `${m} must not blink under reduced motion`);
    const first = f[0];
    assert.ok(f.every((x) => x.gx === first.gx && x.gy === first.gy), `${m} gaze must not drift`);
  }
});

test('paused: gaze and blink freeze', () => {
  const f = run('idle', 10, { paused: true });
  assert.ok(f.every((x) => x.blink === 0));
  assert.ok(f.every((x) => x.gx === f[0].gx && x.gy === f[0].gy));
});

test('states look different from each other', () => {
  const sig = (m) => {
    const f = run(m, 10, { level: 0.5, speak: 0.5 });
    const avg = (k) => f.reduce((s, x) => s + x[k], 0) / f.length;
    return [avg('open'), avg('pupil'), avg('gx'), avg('gy')];
  };
  for (let i = 0; i < MODES.length; i++) {
    for (let j = i + 1; j < MODES.length; j++) {
      const a = sig(MODES[i]), b = sig(MODES[j]);
      const d = a.reduce((s, v, k) => s + Math.abs(v - b[k]), 0);
      assert.ok(d > 0.05, `${MODES[i]} and ${MODES[j]} eyes are too similar`);
    }
  }
});

test('eye code has no camera access and no network calls', () => {
  const s = read('eye.js');
  assert.doesNotMatch(s, /getUserMedia|mediaDevices|enumerateDevices|MediaStream|<video|srcObject/, 'eye.js must not touch the camera');
  assert.doesNotMatch(s, /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/, 'eye.js must not make network calls');
});
