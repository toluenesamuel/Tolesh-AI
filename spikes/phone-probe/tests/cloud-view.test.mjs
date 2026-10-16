// Tests for the cloud avatar that replaced the orb in this probe. Run from spikes/phone-probe:
//   node --test tests/cloud-view.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const probeDir = join(here, '..');
const read = (p) => readFileSync(join(probeDir, p), 'utf8');
const readCloud = (p) => readFileSync(join(probeDir, '..', 'cloud-avatar', p), 'utf8');

test('the probe carries exact copies of the cloud prototype modules (no drift)', () => {
  for (const f of ['cloud-core.js', 'cloud-scene.js']) {
    assert.equal(read(join('cloud', f)), readCloud(f), `${f} differs from spikes/cloud-avatar/${f}; copy it again`);
  }
});

test('the probe loads the cloud and no longer loads the orb renderer', () => {
  const probe = read('probe.js');
  assert.ok(/from '\.\/cloud-view\.js'/.test(probe), 'probe.js imports the cloud view');
  assert.ok(!/from '\.\/orb\.js'/.test(probe), 'probe.js must not import orb.js');
  assert.ok(!/from '\.\/eye\.js'/.test(probe), 'probe.js must not import eye.js');
  assert.ok(existsSync(join(probeDir, 'orb.js')), 'orb.js is kept in the repo for rollback');
});

test('the page uses an SVG avatar, not a canvas, and keeps the strict CSP', () => {
  const html = read('index.html');
  assert.ok(/<svg id="orb"/.test(html), 'the avatar is an SVG with id orb');
  assert.ok(!/<canvas id="orb"/.test(html), 'no canvas for the avatar');
  assert.ok(/connect-src 'none'/.test(html), 'connect-src stays none');
  assert.ok(!/unsafe-inline|unsafe-eval/.test(html), 'no unsafe CSP sources');
  assert.ok(!/orb demo|Orb demo/i.test(html), 'no visible orb wording in the page title or tag');
});

test('every probe mode maps to a cloud state, and the mapping covers all six states', async () => {
  const { MODE_TO_STATE } = await import('../cloud-view.js');
  const { MODES } = await import('../state.js');
  assert.deepEqual(Object.keys(MODE_TO_STATE).sort(), [...MODES].sort());
  assert.deepEqual(
    Object.values(MODE_TO_STATE).sort(),
    ['acting', 'error', 'idle', 'listening', 'speaking', 'thinking'],
  );
});

test('speaking only moves the mouth with a real output level, never a simulated one', () => {
  const adapter = read('cloud-view.js');
  // The adapter must not pass null to the controller, because null selects the built-in simulated voice.
  assert.ok(!/setLevel\(null\)|setLevel\(undefined\)/.test(adapter), 'no null output level');
  assert.ok(/Number\.isFinite\(v\) \? v : 0/.test(adapter), 'missing levels become 0');
  const probe = read('probe.js');
  assert.ok(/setOutputLevel\(outLevel\)/.test(probe), 'the output level comes from the probe');
  assert.ok(/clamp\(rmsOf\(sim\.an\) \* 7\)/.test(probe), 'the output level is the test voice analyser');
  assert.ok(!/speechEnvelope\(now/.test(probe), 'no fake speech envelope drives the cloud');
});

test('listening uses the microphone analyser level, and pause freezes the cloud', () => {
  const probe = read('probe.js');
  assert.ok(/setInputLevel\(micStream \? micLevel : 0\)/.test(probe), 'mic level drives listening');
  assert.ok(/if \(paused\) return;\s*cloudView\.update\(now\);/.test(probe), 'paused skips the update');
});

test('the probe copies of the cloud core and scene match the prototype byte for byte', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  for (const f of ['cloud-core.js', 'cloud-scene.js']) {
    const copy = readFileSync(join(here, '..', 'cloud', f), 'utf8');
    const source = readFileSync(join(here, '..', '..', 'cloud-avatar', f), 'utf8');
    assert.equal(copy, source, `${f} is out of sync: copy it from spikes/cloud-avatar/`);
  }
});
