// Orb demo (throwaway test build under spikes/phone-probe/ only).
// Privacy: the microphone is requested only after a tap on "Start microphone".
// Microphone audio is processed on this device. Nothing is uploaded, recorded or stored.
// The page's CSP sets connect-src 'none'.
import { createOrb, createOrb2D } from './orb.js';
import { MODES, LABELS, MOTION_TEXT, targetsFor, speechEnvelope, rmsToLevel, clamp } from './state.js';
import { createEye } from './eye.js';

const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const T0 = performance.now();
const rnd = (x, d = 2) => (x == null || !isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const pct = (a, p) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

const R = {
  note: 'Throwaway orb demo. Software timings only. Nothing is uploaded or stored. Microphone audio is processed on this device.',
  startedAt: new Date().toISOString(),
  caps: {},
  events: [],
  calibration: null,
  frameRate: null,
};

function renderResults() {
  $('results').textContent = JSON.stringify(R, null, 2);
}
function log(type, detail = {}) {
  R.events.push({ atMs: Math.round(performance.now() - T0), type, ...detail });
  if (R.events.length > 300) R.events.shift();
  renderResults();
}

// Unexpected JavaScript errors are written to the results, so they can be copied.
window.addEventListener('error', (e) => log('js-error', { message: String(e.message).slice(0, 200), line: e.lineno }));
window.addEventListener('unhandledrejection', (e) => log('js-error', { message: String(e.reason).slice(0, 200) }));

// ---------- capabilities
function checkCaps() {
  const probe = document.createElement('canvas');
  R.caps = {
    secureContext: window.isSecureContext,
    webgl2: !!probe.getContext('webgl2'),
    audioWorklet: typeof AudioWorkletNode === 'function',
    getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    audioContext: typeof (window.AudioContext || window.webkitAudioContext) === 'function',
    reducedMotion: reduced,
    devicePixelRatio: window.devicePixelRatio,
    viewport: `${innerWidth}x${innerHeight}`,
    userAgent: navigator.userAgent,
  };
}

// ---------- orb
const canvas = $('orb');
let orb = null;
try {
  orb = createOrb(canvas);
} catch (e) {
  log('renderer-error', { message: String(e).slice(0, 200) });
  orb = null;
}
if (!orb) orb = createOrb2D(canvas);
const rendererKind = orb ? orb.kind : 'none';

// ---------- state
let mode = 'idle';
let paused = false;
let micDenied = false;
let ctx = null;
let micStream = null, micSrc = null, meterNode = null, analyser = null, muteGain = null;
let micOnPerf = 0, meterMsgs = 0, lagSamples = [];
let micLevel = 0, lastRms = 0, meterUiT = 0;
let calibrating = false, calSamples = [], threshold = null, bargeCount = 0;
let sim = null;      // { osc, g, an, startPerf, timer }
let fps = null;      // { t0, ts }
let lastKey = '';
const eye = createEye();

const modeButtons = document.querySelectorAll('[data-mode]');

async function ensureCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state !== 'running') await ctx.resume();
  return ctx;
}

function rmsOf(an) {
  const buf = new Float32Array(an.fftSize);
  an.getFloatTimeDomainData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

function setMicMsg(text) { $('micMsg').textContent = text; }

// ---------- modes
function setMode(next, reason) {
  if (next === mode) { updateUi(); return; }
  if (mode === 'speaking' && next !== 'speaking' && sim) simStop(`mode changed to ${next}`, null);
  const prev = mode;
  mode = next;
  log('mode', { from: prev, to: next, reason });
  updateUi();
}

// ---------- microphone (only after a tap)
async function micStart() {
  if (micStream) return;
  if (!window.isSecureContext) {
    setMicMsg('The microphone needs a secure (HTTPS) page. Open the preview link, not a plain http address.');
    log('mic-blocked', { reason: 'not secure context' });
    return;
  }
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
    setMicMsg('This browser cannot use the microphone. Simulate reply still works.');
    log('mic-blocked', { reason: 'no getUserMedia' });
    return;
  }
  setMicMsg('Waiting for microphone permission…');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
  } catch (e) {
    micDenied = true;
    log('mic-denied', { name: e.name });
    setMicMsg(`Microphone not allowed (${e.name}). Simulate reply still works.`);
    updateUi();
    return;
  }
  micDenied = false;
  micStream = stream;                       // assigned first, so a later failure still stops the tracks
  try {
    await ensureCtx();
    const track = stream.getAudioTracks()[0];
    const settings = track.getSettings();
    delete settings.deviceId;
    delete settings.groupId;
    micSrc = ctx.createMediaStreamSource(stream);
    muteGain = ctx.createGain();
    muteGain.gain.value = 0;                 // silent sink: keeps the graph running without playing the mic
    muteGain.connect(ctx.destination);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    micSrc.connect(analyser);
    analyser.connect(muteGain);
    let path = 'AnalyserNode';
    try {
      await ctx.audioWorklet.addModule('meter-worklet.js');
      meterNode = new AudioWorkletNode(ctx, 'level-meter');
      meterNode.port.onmessage = onMeter;
      micSrc.connect(meterNode);
      meterNode.connect(muteGain);
      path = 'AudioWorklet';
    } catch (e) {
      log('worklet-unavailable', { message: String(e).slice(0, 160) });
    }
    micOnPerf = performance.now();
    meterMsgs = 0;
    lagSamples = [];
    log('mic-on', { path, settings });
  } catch (e) {
    log('mic-error', { message: String(e).slice(0, 160) });
    micStop('setup failed');
    setMicMsg('The microphone could not start. Simulate reply still works.');
    return;
  }
  setMicMsg('Microphone on. Speak or make a noise to see the orb react.');
  setMode('listening', 'microphone on');
  updateUi();
}

function micStop(reason = 'user') {
  if (!micStream) return;
  micStream.getTracks().forEach((t) => t.stop());
  for (const n of [micSrc, meterNode, analyser, muteGain]) {
    try { if (n) n.disconnect(); } catch (_) { /* already disconnected */ }
  }
  const secs = (performance.now() - micOnPerf) / 1000;
  log('mic-off', {
    reason,
    meterMessagesPerSec: secs > 0 ? rnd(meterMsgs / secs, 1) : null,
    captureLagMs: lagSamples.length
      ? { p50: rnd(pct(lagSamples, 0.5)), p95: rnd(pct(lagSamples, 0.95)), samples: lagSamples.length }
      : null,
  });
  micStream = null; micSrc = null; meterNode = null; analyser = null; muteGain = null;
  micLevel = 0; lastRms = 0; calibrating = false; threshold = null; bargeCount = 0;
  $('levelBar').style.width = '0%';
  $('levelText').textContent = 'Level: off';
  setMicMsg('Microphone off.');
  if (mode === 'listening') setMode('idle', `microphone stopped (${reason})`);
  updateUi();
}

function onMeter(e) {
  const { rms, t } = e.data;
  lastRms = rms;
  meterMsgs++;
  if (ctx) {
    lagSamples.push((ctx.currentTime - t) * 1000);
    if (lagSamples.length > 5000) lagSamples.shift();
  }
  if (calibrating) calSamples.push(rms);
  // Interruption: sustained speech above the calibrated threshold stops the test voice.
  if (sim && threshold !== null) {
    if (rms > threshold) {
      bargeCount++;
      if (bargeCount >= 3) {
        bargeCount = 0;
        log('barge-in', {
          msIntoReply: Math.round(performance.now() - sim.startPerf),
          rms: rnd(rms, 4),
          thresholdRms: rnd(threshold, 4),
        });
        simStop('barge-in: sound above threshold', 'listening');
      }
    } else {
      bargeCount = 0;
    }
  }
}

function calibrate() {
  if (!micStream || calibrating) return;
  calibrating = true;
  calSamples = [];
  setMicMsg('Calibrating: stay quiet for 2 seconds…');
  updateUi();
  setTimeout(() => {
    calibrating = false;
    if (!micStream) return;
    const p95 = pct(calSamples, 0.95) || 0;
    threshold = Math.max(0.02, p95 * 3);
    R.calibration = {
      samples: calSamples.length,
      meanRms: rnd(mean(calSamples), 4),
      p95Rms: rnd(p95, 4),
      thresholdRms: rnd(threshold, 4),
    };
    log('calibrated', R.calibration);
    setMicMsg(`Calibrated. Interrupt threshold ${threshold.toFixed(3)}. Speak over a Simulate reply to test interruption.`);
    updateUi();
  }, 2000);
}

// ---------- simulated reply (test voice, real audio output)
async function simStart() {
  if (sim) return;
  await ensureCtx();
  const dur = 8;
  const t0 = ctx.currentTime + 0.05;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 196;
  const g = ctx.createGain();
  g.gain.value = 0;
  const N = dur * 100;
  const curve = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) curve[i] = 0.2 * speechEnvelope(i / 100);
  g.gain.setValueCurveAtTime(curve, t0, dur);
  const an = ctx.createAnalyser();
  an.fftSize = 512;
  osc.connect(g);
  g.connect(ctx.destination);
  g.connect(an);
  osc.start(t0);
  osc.stop(t0 + dur + 0.1);
  sim = {
    osc, g, an,
    startPerf: performance.now(),
    timer: setTimeout(() => simStop('finished 8 s', 'idle'), (dur + 0.3) * 1000),
  };
  log('voice-start', { micOn: !!micStream, calibrated: threshold !== null });
  setMode('speaking', 'simulated reply');
  updateUi();
}

function simStop(reason, nextMode = 'idle') {
  if (!sim) return;
  const s = sim;
  sim = null;
  clearTimeout(s.timer);
  const now = ctx.currentTime;
  s.g.gain.cancelScheduledValues(now);
  s.g.gain.setTargetAtTime(0, now, 0.02);      // quick fade, so the cut is not a click
  try { s.osc.stop(now + 0.15); } catch (_) { /* already stopped */ }
  setTimeout(() => {
    for (const n of [s.osc, s.g, s.an]) { try { n.disconnect(); } catch (_) { /* ignore */ } }
  }, 250);
  log('voice-stop', { reason, ms: Math.round(performance.now() - s.startPerf) });
  if (nextMode && mode === 'speaking') setMode(nextMode, reason);
  updateUi();
}

// ---------- controls
function stopAll() {
  simStop('stop all', null);
  micStop('stop all');
  paused = false;
  setMode('idle', 'stop all');
  log('stop-all', {});
  updateUi();
}

function resetDemo() {
  stopAll();
  R.events = [];
  R.calibration = null;
  R.frameRate = null;
  threshold = null;
  log('reset', {});
  updateUi();
}

function togglePause() {
  paused = !paused;
  log('pause', { paused });
  updateUi();
}

function hideStop(reason) {
  if (sim) simStop(reason, null);
  if (micStream) micStop(reason);
  if (!paused) { paused = true; log('paused-by-page', { reason }); }
  updateUi();
}

function fpsStart() {
  if (fps) return;
  fps = { t0: null, ts: [] };
  log('frame-rate-start', {});
  updateUi();
}

function fpsFinish() {
  const ts = fps.ts;
  const iv = [];
  for (let i = 1; i < ts.length; i++) iv.push(ts[i] - ts[i - 1]);
  const valid = iv.filter((x) => x < 1000);
  const med = pct(valid, 0.5);
  R.frameRate = {
    seconds: 20,
    frames: ts.length,
    medianFps: med ? rnd(1000 / med, 1) : null,
    meanFps: valid.length ? rnd(1000 / mean(valid), 1) : null,
    droppedPct: med && valid.length ? rnd((100 * valid.filter((x) => x > 1.5 * med).length) / valid.length, 1) : null,
    renderer: rendererKind,
    devicePixelRatio: window.devicePixelRatio,
  };
  fps = null;
  log('frame-rate', R.frameRate);
  updateUi();
}

// ---------- UI
function detailText() {
  if (mode === 'listening') return micStream ? 'Listening. The rim and glow follow the microphone level.' : 'Attentive pulse. Start the microphone to react to your voice.';
  if (mode === 'speaking') return sim ? 'Speaking. Reacting to the test voice playing from this phone.' : 'Speaking pulse, with no audio. Use Simulate reply to react to real sound.';
  return MOTION_TEXT[mode];
}

function updateUi() {
  for (const b of modeButtons) {
    const on = b.dataset.mode === mode;
    b.setAttribute('aria-pressed', String(on));
  }
  $('stage').dataset.mode = mode;
  $('status').textContent = LABELS[mode] + (paused ? ' (paused)' : '');
  $('statusDetail').textContent = detailText();
  $('micState').textContent = micStream ? 'on' : micDenied ? 'blocked' : 'off';
  $('voiceState').textContent = sim ? 'playing' : 'idle';
  $('pauseBtn').textContent = paused ? 'Resume' : 'Pause';
  $('pauseBtn').setAttribute('aria-pressed', String(paused));
  $('micOn').disabled = !!micStream;
  $('micOff').disabled = !micStream;
  $('calBtn').disabled = !micStream || calibrating;
  $('simBtn').disabled = !!sim;
  $('simStop').disabled = !sim;
  $('fpsBtn').disabled = !!fps;
  $('fpsResult').textContent = fps ? 'measuring…' : R.frameRate
    ? `${R.frameRate.medianFps} fps median, ${R.frameRate.droppedPct}% slow frames (${R.frameRate.renderer})`
    : 'not run yet';
}

// ---------- frame loop
function frame(now) {
  requestAnimationFrame(frame);

  if (fps) {
    if (fps.t0 === null) fps.t0 = now;
    fps.ts.push(now);
    if (now - fps.t0 >= 20000) fpsFinish();
  }

  if (micStream) {
    if (analyser) lastRms = rmsOf(analyser);
    micLevel = micLevel * 0.8 + rmsToLevel(lastRms) * 0.2;
    if (now - meterUiT > 100) {
      meterUiT = now;
      $('levelBar').style.width = `${Math.round(micLevel * 100)}%`;
      $('levelText').textContent = `Level: ${lastRms.toFixed(3)} (rms)`;
    }
  }

  let speak = 0;
  if (sim) speak = clamp(rmsOf(sim.an) * 7);
  else if (mode === 'speaking') speak = reduced ? 0.35 : speechEnvelope(now / 1000) * 0.7;

  const level = micStream ? micLevel : (reduced ? 0.15 : 0.22 + 0.05 * Math.sin(now / 600));
  const tgt = targetsFor(mode, { level, speak, paused, reduced });
  // Simulated eye: gaze, blink, lid openness and pupil. No camera is used.
  const e = eye.step(now / 1000, mode, { level, speak, reduced, paused });
  tgt.gx = e.gx;
  tgt.gy = e.gy;
  tgt.open = e.open;
  tgt.pupil = e.pupil;
  tgt.now = now;

  if (!orb) return;
  if (reduced) {
    // Reduced motion: draw only when the visible values change, not every frame.
    const key = [mode, paused, Math.round(tgt.level * 40), Math.round(tgt.speak * 40)].join('|');
    if (key === lastKey) return;
    lastKey = key;
  }
  orb.draw(tgt);
}

// ---------- wiring
for (const b of modeButtons) {
  b.addEventListener('click', () => setMode(b.dataset.mode, 'button'));
}
$('micOn').addEventListener('click', micStart);
$('micOff').addEventListener('click', () => micStop('user'));
$('calBtn').addEventListener('click', calibrate);
$('simBtn').addEventListener('click', () => { simStart().catch((e) => log('voice-error', { message: String(e).slice(0, 160) })); });
$('simStop').addEventListener('click', () => simStop('stop reply', 'idle'));
$('pauseBtn').addEventListener('click', togglePause);
$('stopAllBtn').addEventListener('click', stopAll);
$('resetBtn').addEventListener('click', resetDemo);
$('fpsBtn').addEventListener('click', fpsStart);
$('copyBtn').addEventListener('click', async () => {
  const txt = JSON.stringify(R, null, 2);
  renderResults();
  try {
    await navigator.clipboard.writeText(txt);
    $('copyBtn').textContent = 'Copied';
  } catch (_) {
    const range = document.createRange();
    range.selectNodeContents($('results'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    $('copyBtn').textContent = 'Copy blocked: text selected';
  }
  setTimeout(() => { $('copyBtn').textContent = 'Copy results'; }, 3000);
});

// Hidden or closed page: stop the microphone and the test voice, and pause the orb.
document.addEventListener('visibilitychange', () => { if (document.hidden) hideStop('page hidden'); });
addEventListener('pagehide', () => hideStop('page closed'));

checkCaps();
log('ready', { renderer: rendererKind, reducedMotion: reduced });
updateUi();
requestAnimationFrame(frame);
