// Tests for the cloud prototype. Logic and markup only: no browser is available here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  createCloudController,
  createBlinker,
  createAttention,
  createLevel,
  easeToward,
  gazeFromPoint,
  nudgePointer,
  simulatedSpeechLevel,
  STATES,
  STATE_NAMES,
  NEAR_ENTER,
  NEAR_LEAVE,
  LEAVE_DWELL,
  CENTER,
  describeState,
  mulberry32,
} from '../cloud-core.js';
import {
  LOBES,
  EYES,
  GAZE_MAX,
  VIEW,
  cloudInnerMarkup,
  cloudStandaloneSvg,
  poseAttrs,
  lidPathD,
  browD,
  smileD,
} from '../cloud-scene.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

// Run a controller for a span of time at 60 fps and return the last pose.
function run(ctrl, seconds, start = 0) {
  let pose = null;
  const steps = Math.round(seconds * 60);
  for (let i = 1; i <= steps; i++) pose = ctrl.frame(1 / 60, start + i / 60);
  return pose;
}

// ---------- shape and markup

test('lobes are inside the viewBox and roughly centred on the cloud centre', () => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const l of LOBES) {
    assert.ok(l.r > 0);
    minX = Math.min(minX, l.x - l.r);
    maxX = Math.max(maxX, l.x + l.r);
    minY = Math.min(minY, l.y - l.r);
    maxY = Math.max(maxY, l.y + l.r);
  }
  assert.ok(minX >= 0 && maxX <= VIEW.w, `x extent ${minX}..${maxX}`);
  assert.ok(minY >= 0 && maxY <= VIEW.h, `y extent ${minY}..${maxY}`);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  assert.ok(Math.abs(cx - CENTER.x) < 6, `cx ${cx}`);
  assert.ok(Math.abs(cy - CENTER.y) < 14, `cy ${cy}`);
  // The silhouette should be wider than it is tall (cloud, not a sphere).
  assert.ok(maxX - minX > maxY - minY);
});

test('both eyes sit fully inside the body', () => {
  for (const side of ['L', 'R']) {
    const e = EYES[side];
    const inside = LOBES.some((l) => Math.hypot(e.x - l.x, e.y - l.y) + 16 < l.r + 4);
    assert.ok(inside, `eye ${side} is not inside a lobe`);
  }
});

test('every data-k key used by the browser exists in the markup', () => {
  const markup = cloudInnerMarkup(poseAttrs(createCloudController().frame(0, 0)));
  const keys = [...markup.matchAll(/data-k="([^"]+)"/g)].map((m) => m[1]);
  for (const k of ['body', 'ground', 'glowCyan', 'glowCoral', 'lidL', 'lidR', 'lidEdgeL', 'lidEdgeR', 'browL', 'browR', 'gazeL', 'gazeR', 'smile', 'mouthOpen']) {
    assert.ok(keys.includes(k), `missing data-k ${k}`);
  }
  // No duplicate attributes in one element (invalid XML), which would break the markup.
  for (const tag of markup.match(/<[a-zA-Z][^>]*>/g) ?? []) {
    const names = [...tag.matchAll(/ ([a-zA-Z:-]+)="/g)].map((m) => m[1]);
    assert.equal(new Set(names).size, names.length, `duplicate attribute in ${tag.slice(0, 80)}`);
  }
});

test('standalone stills are well-formed SVG for every state pose', () => {
  for (const name of STATE_NAMES) {
    const ctrl = createCloudController({ seed: 7 });
    ctrl.setState(name);
    const svg = cloudStandaloneSvg(poseAttrs(run(ctrl, 2)));
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 360 320"/);
    assert.equal((svg.match(/<g[ >]/g) ?? []).length, (svg.match(/<\/g>/g) ?? []).length, `unbalanced <g> in ${name}`);
    assert.equal((svg.match(/<clipPath/g) ?? []).length, (svg.match(/<\/clipPath>/g) ?? []).length);
  }
});

// ---------- eyes, brows, mouth geometry

test('closing the eye collapses the lid region to the centre line', () => {
  const open = lidPathD('L', 1, 0);
  const closed = lidPathD('L', 0.06, 0);
  const yOf = (d) => Number(d.match(/^M[\d.-]+ ([\d.-]+)/)[1]);
  assert.ok(yOf(closed) > yOf(open), 'closed lid must sit lower than open lid');
  assert.ok(yOf(closed) > EYES.L.y - 3, 'closed lid is near the eye centre line');
});

test('lid tilt raises the inner corner of each eye, not the outer corner', () => {
  // Left eye: inner corner is on the right. Positive tilt should lift the right end of the edge.
  const dl = lidPathD('L', 1, 0.8).match(/M([\d.-]+) ([\d.-]+) L([\d.-]+) ([\d.-]+)/);
  assert.ok(Number(dl[4]) < Number(dl[2]), 'left eye: inner (right) end should be higher');
  // Right eye: inner corner is on the left. The left end should be higher.
  const dr = lidPathD('R', 1, 0.8).match(/M([\d.-]+) ([\d.-]+) L([\d.-]+) ([\d.-]+)/);
  assert.ok(Number(dr[2]) < Number(dr[4]), 'right eye: inner (left) end should be higher');
});

test('brows and smile stay within the body', () => {
  for (const raise of [-1, 0, 1]) for (const worry of [0, 1]) {
    const d = browD('L', raise, worry);
    const ys = [...d.matchAll(/[\d.-]+ ([\d.-]+)/g)].map((m) => Number(m[1]));
    for (const y of ys) assert.ok(y > 110 && y < 150, `brow y ${y}`);
  }
  assert.equal(smileD(1), 'M166 204 Q180 216 194 204');
  assert.equal(smileD(-1), 'M166 204 Q180 192 194 204');
});

// ---------- controller behaviour

test('gaze follows the cursor direction and stays inside natural limits', () => {
  const far = gazeFromPoint({ x: 2000, y: -2000 });
  assert.ok(Math.abs(far.gx) <= 1 && Math.abs(far.gy) <= 1, 'gaze must stay within 1 in magnitude');
  assert.ok(Math.abs(gazeFromPoint({ x: 220, y: 160 }).gx) < 0.95, 'near the edge the gaze eases, it does not pin');
  assert.ok(gazeFromPoint({ x: 300, y: 160 }).gx > 0, 'cursor to the right looks right');
  assert.ok(gazeFromPoint({ x: 60, y: 160 }).gx < 0, 'cursor to the left looks left');
  assert.deepEqual(gazeFromPoint(CENTER), { gx: 0, gy: 0 });
  assert.ok(GAZE_MAX.x + 8 < EYES.R.x - EYES.L.x, 'pupils stay clear of each other');
});

test('the eyes ease toward the cursor, not snap to it', () => {
  const ctrl = createCloudController({ seed: 7 });
  ctrl.setPointer({ x: 340, y: 160 });
  const first = ctrl.frame(1 / 60, 0.0167);
  assert.ok(first.gx > 0 && first.gx < 0.2, `first frame gx ${first.gx}`);
  const later = run(ctrl, 1, 0.0167);
  assert.ok(later.gx > 0.5, `after 1 s gx ${later.gx}`);
});

test('cursor approaching sets near, cursor leaving relaxes after a dwell', () => {
  const att = createAttention();
  assert.equal(att.update(0.016, NEAR_ENTER - 1).near, true);
  // Inside the hysteresis band the state stays near.
  assert.equal(att.update(0.016, (NEAR_ENTER + NEAR_LEAVE) / 2).near, true);
  // Leaving: still near during the dwell.
  let near = true;
  for (let t = 0; t < LEAVE_DWELL - 0.1; t += 0.05) near = att.update(0.05, null).near;
  assert.equal(near, true, 'must stay near during the dwell');
  for (let t = 0; t < 0.5; t += 0.05) near = att.update(0.05, null).near;
  assert.equal(near, false, 'must relax after the dwell');
});

test('attention changes gradually and never jumps', () => {
  const att = createAttention();
  let prev = 0;
  let maxJump = 0;
  for (let i = 0; i < 120; i++) {
    const dist = i < 60 ? NEAR_ENTER - 5 : null;
    const a = att.update(1 / 60, dist).amount;
    maxJump = Math.max(maxJump, Math.abs(a - prev));
    prev = a;
  }
  assert.ok(maxJump < 0.1, `largest per-frame change ${maxJump}`);
});

test('every state change eases over time, with no jump in any channel', () => {
  const ctrl = createCloudController({ seed: 7, reducedMotion: true });
  run(ctrl, 2);
  const keys = ['open', 'raise', 'smile', 'tilt', 'glowCoral', 'scaleY'];
  for (const from of STATE_NAMES) {
    for (const to of STATE_NAMES) {
      if (from === to) continue;
      ctrl.setState(from);
      let prev = run(ctrl, 2, 2);
      ctrl.setState(to);
      let worst = {};
      for (let i = 1; i <= 90; i++) {
        const cur = ctrl.frame(1 / 60, 4 + i / 60);
        for (const k of keys) worst[k] = Math.max(worst[k] ?? 0, Math.abs(cur[k] - prev[k]));
        prev = cur;
      }
      // Largest allowed change per frame. Tilt is in degrees: the biggest state move is 6 degrees
      // (listening to thinking), which over a 0.3 s half-life is about 0.23 degrees per frame.
      const limit = { open: 0.08, raise: 0.08, smile: 0.08, tilt: 0.25, glowCoral: 0.08, scaleY: 0.08 };
      for (const k of keys) assert.ok(worst[k] < limit[k], `${from}->${to} ${k} per-frame change ${worst[k]}`);
    }
  }
});

test('each state has a distinct, readable pose', () => {
  const sig = new Map();
  for (const name of STATE_NAMES) {
    const ctrl = createCloudController({ seed: 7, reducedMotion: true });
    ctrl.setState(name);
    const p = run(ctrl, 3);
    const key = [p.open, p.lidTilt, p.raise, p.worry, p.smile, p.tilt].map((n) => n.toFixed(2)).join('|');
    sig.set(name, key);
  }
  assert.equal(new Set(sig.values()).size, STATE_NAMES.length, 'two states share a pose');
});

test('state poses stay within safe ranges', () => {
  for (const name of STATE_NAMES) {
    const ctrl = createCloudController({ seed: 11 });
    ctrl.setState(name);
    for (let i = 1; i <= 60 * 12; i++) {
      const p = ctrl.frame(1 / 60, i / 60);
      assert.ok(p.open >= 0.06 && p.open <= 1.12, `${name} open ${p.open}`);
      assert.ok(Math.abs(p.tilt) <= 6, `${name} tilt ${p.tilt}`);
      assert.ok(Math.abs(p.floatY) <= 5, `${name} floatY ${p.floatY}`);
      assert.ok(p.scaleX > 0.9 && p.scaleX < 1.1 && p.scaleY > 0.9 && p.scaleY < 1.1, `${name} scale`);
      assert.ok(p.mouthOpen >= 0 && p.mouthOpen <= 1);
      assert.ok(p.glowCyan >= 0 && p.glowCyan <= 1 && p.glowCoral >= 0 && p.glowCoral <= 1);
    }
  }
});

test('idle floats and breathes, and blinks occasionally', () => {
  const ctrl = createCloudController({ seed: 7 });
  let minY = 0, maxY = 0, minOpen = 1, blinks = 0, wasOpen = true;
  for (let i = 1; i <= 60 * 20; i++) {
    const p = ctrl.frame(1 / 60, i / 60);
    minY = Math.min(minY, p.floatY);
    maxY = Math.max(maxY, p.floatY);
    minOpen = Math.min(minOpen, p.open);
    const isOpen = p.open > 0.5;
    if (wasOpen && !isOpen) blinks++;
    wasOpen = isOpen;
  }
  assert.ok(maxY - minY > 6, 'idle should float by a visible amount');
  assert.ok(minOpen < 0.2, 'idle should blink');
  assert.ok(blinks >= 4 && blinks <= 12, `blinks in 20 s: ${blinks}`);
});

test('blinks are deterministic for a seed and never overlap', () => {
  const a = createBlinker(42);
  const b = createBlinker(42);
  const seqA = [], seqB = [];
  for (let i = 0; i < 60 * 30; i++) {
    seqA.push(a.update(i / 60));
    seqB.push(b.update(i / 60));
  }
  assert.deepEqual(seqA, seqB);
  // Blink start times: first frame where openness dips below 0.5 after an open period.
  const starts = [];
  for (let i = 1; i < seqA.length; i++) if (seqA[i - 1] >= 0.5 && seqA[i] < 0.5) starts.push(i / 60);
  for (let i = 1; i < starts.length; i++) {
    const gap = starts[i] - starts[i - 1];
    assert.ok(gap >= 2.3 && gap <= 5.6, `gap ${gap}`);
  }
});

test('speaking follows the voice level: mouth opens and closes', () => {
  const ctrl = createCloudController({ seed: 7 });
  ctrl.setState('speaking');
  let max = 0, min = 1;
  for (let i = 1; i <= 60 * 6; i++) {
    const p = ctrl.frame(1 / 60, i / 60);
    max = Math.max(max, p.mouthOpen);
    min = Math.min(min, p.mouthOpen);
  }
  assert.ok(max > 0.6, `mouth should open, max ${max}`);
  assert.ok(min < 0.3, `mouth should close between syllables, min ${min}`);
});

test('a real voice level drives the mouth, and silence keeps it closed', () => {
  const ctrl = createCloudController({ seed: 7 });
  ctrl.setState('speaking');
  ctrl.setLevel(0);
  const silent = run(ctrl, 1);
  assert.ok(silent.mouthOpen < 0.02, `silent mouth ${silent.mouthOpen}`);
  ctrl.setLevel(0.9);
  const loud = run(ctrl, 1, 1);
  assert.ok(loud.mouthOpen > 0.8, `loud mouth ${loud.mouthOpen}`);
});

test('reduced motion stops float, breathing and blinking, but keeps gaze and state', () => {
  const ctrl = createCloudController({ seed: 7, reducedMotion: true });
  let maxFloat = 0, minOpen = 1;
  for (let i = 1; i <= 60 * 12; i++) {
    const p = ctrl.frame(1 / 60, i / 60);
    maxFloat = Math.max(maxFloat, Math.abs(p.floatY));
    minOpen = Math.min(minOpen, p.open);
  }
  assert.equal(maxFloat, 0);
  assert.equal(minOpen, 1, 'no blinks with reduced motion');
  ctrl.setPointer({ x: 330, y: 160 });
  assert.ok(run(ctrl, 1, 12).gx > 0.4, 'gaze still follows the cursor');
});

test('reduced motion can be toggled at runtime', () => {
  const ctrl = createCloudController({ seed: 7, reducedMotion: false });
  ctrl.setReducedMotion(true);
  assert.equal(ctrl.getReducedMotion(), true);
  let maxFloat = 0;
  for (let i = 1; i <= 120; i++) maxFloat = Math.max(maxFloat, Math.abs(ctrl.frame(1 / 60, i / 60).floatY));
  assert.equal(maxFloat, 0);
});

test('keyboard nudges move a virtual cursor and Escape releases it', () => {
  let p = nudgePointer(null, 'ArrowRight');
  assert.ok(p.x > CENTER.x);
  p = nudgePointer(p, 'ArrowDown');
  assert.ok(p.y > CENTER.y);
  assert.equal(nudgePointer(p, 'Escape'), null);
  assert.equal(nudgePointer(p, 'a'), p, 'other keys do nothing');
  const far = nudgePointer({ x: 400, y: 400 }, 'ArrowRight');
  assert.ok(far.x <= VIEW.w + 60 && far.y <= VIEW.h + 60, 'virtual cursor stays bounded');
});

test('an unknown state is rejected', () => {
  const ctrl = createCloudController();
  assert.throws(() => ctrl.setState('sleeping'), /unknown state/);
  assert.throws(() => describeState('sleeping'), /unknown state/);
});

test('every state has a label, a hint, and a distinct voice-free description', () => {
  const labels = new Set();
  for (const name of STATE_NAMES) {
    const { label, hint } = describeState(name);
    assert.ok(label.length > 0 && hint.length > 10);
    labels.add(label);
  }
  assert.equal(labels.size, STATE_NAMES.length);
});

test('easing is frame-rate independent', () => {
  const a = easeToward(0, 1, 0.1, 0.3);
  const b = easeToward(easeToward(0, 1, 0.05, 0.3), 1, 0.05, 0.3);
  assert.ok(Math.abs(a - b) < 1e-9);
});

test('the simulated speech level stays in 0..1 and varies', () => {
  let min = 1, max = 0;
  for (let i = 0; i < 600; i++) {
    const v = simulatedSpeechLevel(i / 60);
    assert.ok(v >= 0 && v <= 1);
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  assert.ok(max - min > 0.5);
});

test('level follower rises faster than it falls and stays bounded', () => {
  const l = createLevel();
  const up = l.step(1, 0.05);
  const l2 = createLevel();
  l2.step(1, 1);
  const down = l2.step(0, 0.05);
  assert.ok(up > 0 && up <= 1);
  assert.ok(1 - down < up, 'attack should be faster than release');
});

test('the seeded generator returns values in 0..1', () => {
  const r = mulberry32(3);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});

test('the state table covers all six states with ranges that match the brief', () => {
  assert.deepEqual(STATE_NAMES, ['idle', 'listening', 'thinking', 'speaking', 'acting', 'error']);
  assert.ok(STATES.error.glowCoral > 0 && STATES.error.glowCyan < STATES.idle.glowCyan, 'error is calm and not bright');
  assert.ok(STATES.speaking.glowCyan > STATES.idle.glowCyan, 'speaking is brighter than idle');
  assert.equal(STATES.speaking.mouth, 'speak');
});

// ---------- privacy and safety

test('no camera, microphone, network, storage or remote code in the prototype', () => {
  const files = ['cloud-core.js', 'cloud-scene.js', 'cloud.js', 'index.html', 'cloud.css'];
  const banned = [
    /getUserMedia/, /mediaDevices/, /getDisplayMedia/, /AudioContext/, /fetch\s*\(/, /XMLHttpRequest/,
    /WebSocket/, /EventSource/, /sendBeacon/, /localStorage/, /sessionStorage/, /indexedDB/,
    /document\.cookie/, /eval\s*\(/, /new Function/, /import\s*\(/, /<script(?![^>]*src="cloud\.js")/,
    /https?:\/\/(?!www\.w3\.org)/,
  ];
  for (const f of files) {
    const text = read(f);
    for (const re of banned) assert.ok(!re.test(text), `${f} matches ${re}`);
  }
});

test('the page declares a strict Content Security Policy with no network access', () => {
  const html = read('index.html');
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-/);
  assert.doesNotMatch(html, / style="/, 'inline style attributes would be blocked by the CSP');
});

test('the controller and scene have no DOM or global side effects at import', () => {
  // Importing must not touch the window or the document. Node has neither, so importing
  // succeeding here is the check.
  assert.equal(typeof createCloudController, 'function');
  assert.equal(typeof cloudStandaloneSvg, 'function');
});
