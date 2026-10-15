// Node built-in tests (no dependencies). Run from spikes/phone-probe:  node --test tests/
// These check logic and wiring only. They do not run a browser, a microphone or WebGL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as S from '../state.js';
import * as O from '../orb.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

test('six modes with labels and motion, in the required order', () => {
  assert.deepEqual(S.MODES, ['idle', 'listening', 'processing', 'speaking', 'acting', 'error']);
  for (const m of S.MODES) {
    assert.ok(S.LABELS[m], `label for ${m}`);
    assert.ok(S.MOTION[m], `motion for ${m}`);
    assert.ok(S.MOTION_TEXT[m], `text for ${m}`);
    assert.ok(S.ACCENT[m], `accent for ${m}`);
  }
});

test('every state has a visibly different accent colour', () => {
  for (let i = 0; i < S.MODES.length; i++) {
    for (let j = i + 1; j < S.MODES.length; j++) {
      const a = S.ACCENT[S.MODES[i]], b = S.ACCENT[S.MODES[j]];
      const dist = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
      assert.ok(dist > 0.1, `${S.MODES[i]} and ${S.MODES[j]} are too similar`);
    }
  }
});

test('mode-specific behaviour', () => {
  const idle = S.targetsFor('idle');
  assert.equal(idle.circ, 0); assert.equal(idle.active, 0); assert.equal(idle.err, 0);
  assert.equal(S.targetsFor('processing').circ, 1, 'processing circulates');
  assert.equal(S.targetsFor('acting').active, 1, 'acting shows the arc');
  const err = S.targetsFor('error');
  assert.equal(err.err, 1, 'error sets the calm rim');
  assert.ok(err.speed < idle.speed, 'error slows motion');
  assert.equal(err.flowAmp < idle.flowAmp, true, 'error reduces inner contrast');
});

test('level is used only in listening, speak only in speaking', () => {
  assert.equal(S.targetsFor('listening', { level: 0.6 }).level, 0.6);
  assert.equal(S.targetsFor('idle', { level: 0.6 }).level, 0, 'idle ignores mic level');
  assert.equal(S.targetsFor('speaking', { speak: 0.5 }).speak, 0.5);
  assert.equal(S.targetsFor('listening', { speak: 0.5 }).speak, 0, 'listening ignores output level');
});

test('inputs are clamped to 0..1', () => {
  assert.equal(S.targetsFor('listening', { level: 5 }).level, 1);
  assert.equal(S.targetsFor('speaking', { speak: -2 }).speak, 0);
});

test('paused stops motion and dims; reduced flag passes through', () => {
  const p = S.targetsFor('processing', { paused: true });
  assert.equal(p.speed, 0);
  assert.ok(p.bright < 1);
  const r = S.targetsFor('idle', { reduced: true });
  assert.equal(r.reduced, true);
  assert.equal(S.targetsFor('idle').bright, 1);
});

test('unknown mode is rejected', () => {
  assert.throws(() => S.targetsFor('dancing'));
});

test('speech envelope is bounded, varied, deterministic and has pauses', () => {
  let min = Infinity, max = -Infinity, pauses = 0;
  for (let i = 0; i <= 6000; i++) {
    const v = S.speechEnvelope(i / 100);
    assert.ok(v >= 0 && v <= 1, `out of range at ${i}`);
    min = Math.min(min, v); max = Math.max(max, v);
    if (v <= 0.04) pauses++;
  }
  assert.ok(max - min > 0.5, 'envelope varies');
  assert.ok(pauses > 0 && pauses < 6000, 'has some pauses but is not silent');
  assert.equal(S.speechEnvelope(1.234), S.speechEnvelope(1.234), 'deterministic');
});

test('approach eases toward the target and rises faster than it falls when asked', () => {
  let v = 0;
  for (let i = 0; i < 300; i++) v = S.approach(v, 1, 1 / 60, 10, 10);
  assert.ok(Math.abs(v - 1) < 1e-3, 'converges');
  assert.equal(S.approach(0.5, 0.5, 1 / 60, 10, 2), 0.5, 'holds at target');
  assert.equal(S.approach(0.5, 1, 0, 10, 2), 0.5, 'no change with zero time step');
  const rise = S.approach(0, 1, 0.1, 18, 5) - 0;
  const fall = 1 - S.approach(1, 0, 0.1, 18, 5);
  assert.ok(rise > fall, 'attack is faster than release');
});

test('rms to level is clamped', () => {
  assert.equal(S.rmsToLevel(0), 0);
  assert.equal(S.rmsToLevel(10), 1);
  assert.ok(S.rmsToLevel(0.1) > 0 && S.rmsToLevel(0.1) < 1);
});

test('orb module exports the renderers', () => {
  assert.equal(typeof O.createOrb, 'function');
  assert.equal(typeof O.createOrb2D, 'function');
});

test('every element id used by probe.js exists in index.html', () => {
  const html = read('index.html');
  const js = read('probe.js');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const used = new Set([...js.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
  used.add('stage');
  const missing = [...used].filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], `missing ids in index.html: ${missing.join(', ')}`);
});

test('every data-mode button in the page matches a real mode', () => {
  const html = read('index.html');
  const modes = [...html.matchAll(/data-mode="([^"]+)"/g)].map((m) => m[1]);
  const unique = [...new Set(modes)];
  assert.deepEqual(unique.sort(), [...S.MODES].sort());
});

test('every shader uniform is declared and set from JavaScript', () => {
  const src = read('orb.js');
  const uniforms = [...src.matchAll(/uniform (?:float|vec2|vec3) (u_\w+);/g)].map((m) => m[1]);
  const list = [...src.matchAll(/'(u_\w+)'/g)].map((m) => m[1]);
  const missing = uniforms.filter((u) => !list.includes(u));
  assert.deepEqual(missing, [], `uniforms not looked up in JS: ${missing.join(', ')}`);
});

test('page enforces no network and only same-folder scripts', () => {
  const html = read('index.html');
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.doesNotMatch(html, /https?:\/\//, 'no external URLs in the page');
});

test('no obvious secrets or network calls in the demo code', () => {
  for (const f of ['probe.js', 'orb.js', 'state.js', 'index.html']) {
    const s = read(f);
    assert.doesNotMatch(s, /api[_-]?key|secret|password|bearer/i, `${f} mentions a secret-like word`);
    assert.doesNotMatch(s, /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/, `${f} makes network calls`);
  }
});
