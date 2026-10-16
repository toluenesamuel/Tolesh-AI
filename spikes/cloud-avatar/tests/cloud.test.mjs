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
  OUTLINE_D,
  OUTLINE_POINTS,
  EYES,
  LENS,
  IRIS,
  GAZE_MAX,
  MOUTH,
  VIEW,
  cloudInnerMarkup,
  cloudStandaloneSvg,
  poseAttrs,
  outlineRadius,
  lidD,
  lidY,
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

// ---------- shape and markup (v2: one cohesive silhouette, glasses, clipped lids)

function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

test('the body is one closed outline, inside the viewBox and centred on the cloud centre', () => {
  assert.equal((OUTLINE_D.match(/M/g) ?? []).length, 1, 'one subpath');
  assert.equal((OUTLINE_D.match(/Z/g) ?? []).length, 1, 'closed');
  const xs = OUTLINE_POINTS.map((p) => p[0]);
  const ys = OUTLINE_POINTS.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  assert.ok(minX >= 0 && maxX <= VIEW.w, `x extent ${minX}..${maxX}`);
  assert.ok(minY >= 0 && maxY <= VIEW.h, `y extent ${minY}..${maxY}`);
  assert.ok(Math.abs((minX + maxX) / 2 - CENTER.x) < 6, 'horizontally centred');
  assert.ok(maxX - minX > maxY - minY, 'wider than tall (cloud, not a sphere)');
});

test('the outline is a single silhouette: no overlapping circles form the body', () => {
  const body = cloudInnerMarkup(poseAttrs(createCloudController().frame(0, 0)));
  // The body fill appears exactly once, on the outline path. Old circle lobes are gone.
  assert.equal(body.split('fill="url(#cl-body)"').length - 1, 1);
  // Circles are only iris, pupil and glints, all well inside the lenses (radius under 6).
  for (const m of body.matchAll(/<circle [^>]*r="([\d.]+)"/g)) assert.ok(Number(m[1]) < 6, `circle r=${m[1]}`);
});

test('the outline has no radius glitches: every sampled radius is positive and smooth', () => {
  let prev = null;
  for (let i = 0; i < 360; i++) {
    const r = outlineRadius((i / 360) * Math.PI * 2);
    assert.ok(r > 60 && r < 200, `radius ${r} at ${i}`);
    if (prev !== null) assert.ok(Math.abs(r - prev) < 6, `radius jump ${r - prev} at ${i}`);
    prev = r;
  }
});

test('both eyes sit inside their lenses, with full iris travel, and inside the body', () => {
  for (const side of ['L', 'R']) {
    const e = EYES[side];
    const halfW = LENS.w / 2;
    const halfH = LENS.h / 2;
    assert.ok(IRIS.rx + GAZE_MAX.x < halfW - 4, `iris x travel fits lens ${side}`);
    assert.ok(IRIS.ry + GAZE_MAX.y < halfH - 3, `iris y travel fits lens ${side}`);
    assert.ok(pointInPolygon(e.x, e.y, OUTLINE_POINTS), `eye ${side} centre inside body`);
    assert.ok(pointInPolygon(e.x - halfW, e.y - halfH, OUTLINE_POINTS), `lens ${side} corner inside body`);
    assert.ok(pointInPolygon(e.x + halfW, e.y + halfH, OUTLINE_POINTS), `lens ${side} far corner inside body`);
  }
});

test('glasses: two lenses with electric-blue frames, a bridge and arms', () => {
  const markup = cloudInnerMarkup({});
  const lensRects = [...markup.matchAll(/<rect [^>]*rx="21"[^>]*stroke="url\(#cl-frame\)"/g)];
  assert.equal(lensRects.length, 2, 'two framed lenses');
  assert.match(markup, /<path d="M\d+(\.\d+)? \d+(\.\d+)? Q180 [\d.]+ \d+(\.\d+)? \d+(\.\d+)?" fill="none" stroke="url\(#cl-frame\)"/, 'bridge');
  assert.equal((markup.match(/stroke="url\(#cl-frame\)"[^>]*stroke-linecap="round" opacity="0\.9"/g) ?? []).length, 2, 'two arms');
  assert.match(markup, /#2FA6FF|#1A6FE8/, 'electric-blue accent present');
});

test('no SVG filters or blur: the design uses gradients only', () => {
  const markup = cloudInnerMarkup(poseAttrs(createCloudController().frame(0, 0)));
  assert.doesNotMatch(markup, /<filter|filter=|feGaussianBlur|feDrop/);
  assert.doesNotMatch(cloudStandaloneSvg(poseAttrs({ ...createCloudController().frame(0, 0), wink: 1 })), /<filter|filter=/);
});

test('every data-k key used by the browser exists in the markup, with no duplicate attributes', () => {
  const markup = cloudInnerMarkup(poseAttrs(createCloudController().frame(0, 0)));
  const keys = [...markup.matchAll(/data-k="([^"]+)"/g)].map((m) => m[1]);
  for (const k of ['body', 'ground', 'glowCyan', 'glowCoral', 'lidL', 'lidR', 'browL', 'browR', 'gazeL', 'gazeR', 'smile', 'mouthOpen']) {
    assert.ok(keys.includes(k), `missing data-k ${k}`);
  }
  assert.equal(new Set(keys).size, keys.length, 'data-k keys are unique');
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

// Helpers: the lid cover is a polygon, so read its vertices.
const pathYs = (d) => [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2]));
const pathXs = (d) => [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[1]));

test('closing the eye covers the lens; open eyes have no lid cover at all', () => {
  const closed = lidD('L', 0.06, 0);
  assert.ok(Math.max(...pathYs(closed)) > EYES.L.y + 20, 'closed lid reaches the bottom of the lens');
  assert.ok(Math.min(...pathYs(closed)) >= EYES.L.y - LENS.h / 2 - 0.5, 'cover stays inside the lens');
  assert.equal(lidD('L', 1, 0), 'M0 0', 'fully open: nothing to draw');
});

test('the lid cover is cut from the lens shape, so it never leaves the glasses', () => {
  for (const side of ['L', 'R']) for (const open of [0.2, 0.5, 0.8]) for (const tilt of [-0.8, 0, 0.8]) {
    const d = lidD(side, open, tilt);
    const e = EYES[side];
    for (const x of pathXs(d)) assert.ok(Math.abs(x - e.x) <= LENS.w / 2 + 0.5, `x ${x} outside lens ${side}`);
    for (const y of pathYs(d)) assert.ok(y >= e.y - LENS.h / 2 - 0.5 && y <= e.y + LENS.h / 2 + 0.5, `y ${y} outside lens ${side}`);
  }
});

test('lid tilt raises the inner corner of each eye, not the outer corner', () => {
  // Left eye: inner corner is on the right, so its edge should be higher there.
  const hw = LENS.w / 2;
  assert.ok(lidY('L', 0.5, 0.8, hw) < lidY('L', 0.5, 0.8, -hw), 'left eye: inner (right) end higher');
  // Right eye: inner corner is on the left.
  assert.ok(lidY('R', 0.5, 0.8, -hw) < lidY('R', 0.5, 0.8, hw), 'right eye: inner (left) end higher');
});

test('a wink covers only the right eye', () => {
  const base = { ...createCloudController().frame(0, 0), open: 1, lidTilt: 0 };
  const A = poseAttrs({ ...base, wink: 1 });
  assert.ok(Math.max(...pathYs(A.lidR.d)) > EYES.R.y + 20, 'right eye closed');
  assert.equal(A.lidL.d, 'M0 0', 'left eye still open');
});

test('the face has no clip paths on animated parts (clip groups were too slow to repaint)', () => {
  const markup = cloudInnerMarkup({});
  assert.doesNotMatch(markup, /clip-path="url\(#cl-lens/);
  assert.doesNotMatch(markup, /id="cl-lens/);
});

test('brows stay within the face and move with raise and worry', () => {
  for (const raise of [-1, 0, 1]) for (const worry of [0, 1]) {
    const d = browD('L', raise, worry);
    const ys = [...d.matchAll(/[\d.-]+ ([\d.-]+)/g)].map((m) => Number(m[1]));
    for (const y of ys) assert.ok(y > 100 && y < 140, `brow y ${y}`);
  }
  assert.ok(browD('L', 1, 0) !== browD('L', 0, 0), 'raise changes the brow');
  assert.ok(browD('L', 0, 1) !== browD('L', 0, 0), 'worry changes the brow');
});

test('smile curves up for positive values and down for negative, around the mouth centre', () => {
  assert.equal(smileD(1), `M166 ${MOUTH.y - 6} Q180 ${MOUTH.y + 19} 194 ${MOUTH.y - 6}`);
  assert.equal(smileD(-1), `M166 ${MOUTH.y - 6} Q180 ${MOUTH.y - 31} 194 ${MOUTH.y - 6}`);
});

test('thinking moves the brows over time; idle keeps them still', () => {
  const think = createCloudController({ seed: 7 });
  think.setState('thinking');
  const idle = createCloudController({ seed: 7 });
  const raises = [];
  const idleRaises = [];
  for (let i = 1; i <= 240; i++) {
    raises.push(think.frame(1 / 60, i / 60).raise);
    idleRaises.push(idle.frame(1 / 60, i / 60).raise);
  }
  const spread = (xs) => Math.max(...xs.slice(120)) - Math.min(...xs.slice(120));
  assert.ok(spread(raises) > 0.3, 'thinking brows move');
  assert.ok(spread(idleRaises) < 0.05, 'idle brows hold');
});

test('the approach edge fires once per approach, not on every frame near', () => {
  const att = createAttention();
  const edges = [];
  edges.push(att.update(1 / 60, null).justNear);
  edges.push(att.update(1 / 60, NEAR_ENTER - 10).justNear); // enters
  for (let i = 0; i < 30; i++) edges.push(att.update(1 / 60, NEAR_ENTER - 10).justNear); // stays near
  assert.equal(edges.filter(Boolean).length, 1, 'one edge');
});

test('the cloud winks on approach, but not with reduced motion or in error or acting', () => {
  const winkDuring = (state, reduced) => {
    const c = createCloudController({ seed: 7, reducedMotion: reduced });
    c.setState(state);
    run(c, 1); // settle without a cursor
    c.setPointer({ x: CENTER.x + 40, y: CENTER.y });
    let max = 0;
    for (let i = 1; i <= 60; i++) max = Math.max(max, c.frame(1 / 60, 1 + i / 60).wink);
    return max;
  };
  assert.ok(winkDuring('idle', false) > 0.5, 'idle winks on approach');
  assert.equal(winkDuring('idle', true), 0, 'reduced motion: no wink');
  assert.equal(winkDuring('error', false), 0, 'error: no wink');
  assert.equal(winkDuring('acting', false), 0, 'acting: no wink');
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

test('error is warm and reassuring: eyes open, gentle smile, no frown or worried brows', () => {
  const e = STATES.error;
  assert.ok(e.open >= 0.95, 'eyes stay open');
  assert.ok(e.smile >= 0.4, 'a gentle smile');
  assert.ok(e.worry <= 0.12, 'brows are not worried');
  assert.ok(e.lidTilt <= 0.02, 'lids are not drooped');
  assert.ok(e.glowCoral > 0 && e.glowCoral <= 0.2, 'only a faint coral accent');
  assert.ok(e.gaze[1] >= 0, 'gaze is toward the person, not away');
  assert.ok(e.hint.length > 20 && !/failed|error|fault/i.test(e.hint), 'the hint is calm and does not blame the user');
});

test('speaking has pauses between phrases and irregular syllables, not one fixed rhythm', () => {
  const ctrl = createCloudController({ seed: 7 });
  ctrl.setState('speaking');
  const levels = [];
  for (let i = 1; i <= 60 * 12; i++) levels.push(ctrl.frame(1 / 60, i / 60).mouthOpen);
  // A pause: the mouth nearly closes for at least 0.15 s somewhere in each phrase.
  const quiet = levels.filter((v) => v < 0.12).length;
  assert.ok(quiet > 60 * 12 * 0.05, `should pause between phrases, quiet frames ${quiet}`);
  // Syllable gaps differ: intervals between peaks are not all equal.
  const peaks = [];
  for (let i = 2; i < levels.length - 1; i++) if (levels[i] > 0.35 && levels[i] >= levels[i - 1] && levels[i] > levels[i + 1]) peaks.push(i);
  // Only gaps inside a phrase count: anything longer than 0.7 s is a pause between phrases.
  const gaps = peaks.slice(1).map((p, i) => p - peaks[i]).filter((g) => g < 42);
  const spread = Math.max(...gaps) - Math.min(...gaps);
  assert.ok(gaps.length > 20 && spread >= 3, `syllable gaps vary, spread ${spread} frames`);
});

test('speaking moves the head a little and changes mouth width; idle does neither', () => {
  const talk = createCloudController({ seed: 7 });
  talk.setState('speaking');
  const t = [];
  for (let i = 1; i <= 60 * 6; i++) t.push(talk.frame(1 / 60, i / 60));
  const tiltRange = Math.max(...t.slice(120).map((p) => p.tilt)) - Math.min(...t.slice(120).map((p) => p.tilt));
  const widths = t.map((p) => p.mouthWide);
  assert.ok(tiltRange > 1.5, `head sways while speaking, range ${tiltRange}`);
  assert.ok(Math.max(...widths) - Math.min(...widths) > 0.8, 'mouth width varies');

  const idle = createCloudController({ seed: 7 });
  const q = [];
  for (let i = 1; i <= 60 * 6; i++) q.push(idle.frame(1 / 60, i / 60));
  assert.ok(Math.max(...q.map((p) => Math.abs(p.mouthWide))) === 0, 'no mouth width when idle');
  const idleTilt = Math.max(...q.slice(120).map((p) => p.tilt)) - Math.min(...q.slice(120).map((p) => p.tilt));
  assert.ok(idleTilt < 0.01, `no sway when idle, range ${idleTilt}`);
});

test('reduced motion removes the speech sway and width changes', () => {
  const ctrl = createCloudController({ seed: 7, reducedMotion: true });
  ctrl.setState('speaking');
  const p = run(ctrl, 4, 0);
  assert.ok(Math.abs(p.mouthWide) < 1e-9, 'no width change');
  assert.ok(Math.abs(p.raise - STATES.speaking.raise) < 1e-3, 'no emphasis lift');
});

test('listening follows the microphone level, and speaking ignores it', () => {
  const quiet = createCloudController({ seed: 7 });
  quiet.setState('listening');
  quiet.setInputLevel(0);
  const a = run(quiet, 1);
  const loud = createCloudController({ seed: 7 });
  loud.setState('listening');
  loud.setInputLevel(0.9);
  const b = run(loud, 1);
  assert.ok(b.glowCyan > a.glowCyan + 0.1, `loud mic brightens the glow: ${a.glowCyan} vs ${b.glowCyan}`);
  assert.ok(b.mouthOpen < 0.01, 'listening never opens the mouth');

  const speak = createCloudController({ seed: 7 });
  speak.setState('speaking');
  speak.setInputLevel(0.9);
  speak.setLevel(0);
  const s = run(speak, 1);
  assert.ok(s.mouthOpen < 0.02, 'the microphone does not drive the speaking mouth');
});
