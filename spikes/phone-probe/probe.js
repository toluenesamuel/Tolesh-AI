// Throwaway Android probe for the orb and basic audio (docs/F1_SPIKE_PLAN.md WS-A and WS-B).
// Privacy: microphone access is requested only after a tap. Audio is processed on this device,
// is never uploaded (connect-src is 'none' in the page CSP), and is never stored. Only numbers
// are kept, and they stay on the page until you copy them.
import { createOrb, createOrb2D, STATES } from './orb.js';

const $ = (id) => document.getElementById(id);
const RUN_MS = 5 * 60 * 1000;          // 5-minute orb run
const STATE_EVERY_MS = 10 * 1000;      // state change interval during a run
const RUN_ORDER = ['idle', 'listening', 'thinking', 'speaking', 'acting', 'error'];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const R = {
  note: 'Throwaway F1 phone probe. Software timings only. Hardware latency, thermal state and GPU time are not measured.',
  startedAt: new Date().toISOString(),
  caps: {}, orb: null, mic: { events: [] }, tone: { plays: 0, stops: [] },
};

// ---------- helpers
const pct = (a, p) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const rnd = (x, d = 2) => (x == null || !isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const sinceStart = () => Math.round(performance.now());

function showResults() {
  $('results').textContent = JSON.stringify(R, null, 2);
}

// ---------- 1. browser check
function checkCaps() {
  const probe = document.createElement('canvas');
  R.caps = {
    secureContext: window.isSecureContext,
    webgl2: !!probe.getContext('webgl2'),
    audioWorklet: typeof AudioWorkletNode === 'function',
    getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    audioContext: typeof (window.AudioContext || window.webkitAudioContext) === 'function',
    reducedMotionOS: reduceMotion,
    viewportCss: `${innerWidth}x${innerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemoryGB: navigator.deviceMemory ?? null,
    userAgent: navigator.userAgent,
  };
  const ul = $('caps');
  ul.innerHTML = '';
  for (const [k, v] of Object.entries(R.caps)) {
    const li = document.createElement('li');
    li.textContent = `${k}: ${v}`;
    ul.appendChild(li);
  }
}

// ---------- 2. orb
const canvas = $('orb');
let orb = null;
try {
  orb = createOrb(canvas);
  if (!orb) orb = createOrb2D(canvas);
} catch (e) {
  R.orb = { rendererError: String(e).slice(0, 300) };
  orb = createOrb2D(canvas);
}
if (!orb) {
  $('state').textContent = 'No WebGL2 or 2D canvas: orb cannot draw';
}

let run = null;          // active 5-minute run
let manualState = 'idle';
let micLevel = 0;        // smoothed, 0..1
let lastRms = 0;
let lastDrawKey = '';
let lastLevelUiT = 0;

function setStateLabel(name) {
  $('state').textContent = `State: ${name}${run ? ' (run)' : ''}`;
}

function startRun() {
  if (run || !orb) return;
  const now = performance.now();
  run = {
    t0: now, wall: new Date().toISOString(), scale: Number($('scale').value),
    raf: [], draws: 0, hiddenViolations: 0,
    state: RUN_ORDER[0], stateSince: now, stateMs: {},
  };
  $('runBtn').disabled = true;
  $('stopRunBtn').disabled = false;
  setStateLabel(run.state);
  showResults();
}

function stopRun(reason) {
  if (!run) return;
  const now = performance.now();
  run.stateMs[run.state] = (run.stateMs[run.state] || 0) + (now - run.stateSince);
  const ts = run.raf;
  const iv = [];
  for (let i = 1; i < ts.length; i++) iv.push(ts[i] - ts[i - 1]);
  const valid = iv.filter((x) => x < 1000);     // gaps of 1 s or more are pauses, not frames
  const med = pct(valid, 0.5);
  R.orb = {
    startedAt: run.wall,
    endReason: reason,
    durationS: rnd((now - run.t0) / 1000, 1),
    renderer: orb ? orb.kind : 'none',
    resolutionScale: run.scale,
    reducedMotionOS: reduceMotion,
    refreshEstimateHz: med ? rnd(1000 / med, 1) : null,
    frames: ts.length,
    draws: run.draws,
    meanFps: valid.length ? rnd(1000 / mean(valid), 1) : null,
    medianFps: med ? rnd(1000 / med, 1) : null,
    p95IntervalMs: rnd(pct(valid, 0.95)),
    maxIntervalMs: valid.length ? rnd(Math.max(...valid)) : null,
    droppedPct: med && valid.length ? rnd((100 * valid.filter((x) => x > 1.5 * med).length) / valid.length, 2) : null,
    pausesOver1s: iv.length - valid.length,
    stateSeconds: Object.fromEntries(Object.entries(run.stateMs).map(([k, v]) => [k, rnd(v / 1000, 1)])),
    framesWhileHiddenViolations: run.hiddenViolations,
    rendererErrorBeforeRun: R.orb && R.orb.rendererError ? R.orb.rendererError : undefined,
  };
  run = null;
  $('runBtn').disabled = false;
  $('stopRunBtn').disabled = true;
  setStateLabel(manualState);
  showResults();
}

function changeRunState(want, now) {
  run.stateMs[run.state] = (run.stateMs[run.state] || 0) + (now - run.stateSince);
  run.state = want;
  run.stateSince = now;
  setStateLabel(want);
}

function levelFor(name, now) {
  if (name === 'listening') return micStream ? micLevel : 0.3 + 0.2 * Math.sin(now / 500);
  if (name === 'thinking' || name === 'acting') return 0.05;
  return 0;
}

function frame(now) {
  requestAnimationFrame(frame);
  if (run) {
    if (document.hidden) run.hiddenViolations++;
    run.raf.push(now);
    const el = now - run.t0;
    if (el >= RUN_MS) {
      stopRun('completed 5 minutes');
    } else {
      const want = RUN_ORDER[Math.floor(el / STATE_EVERY_MS) % RUN_ORDER.length];
      if (want !== run.state) changeRunState(want, now);
    }
  }

  // Microphone level for the orb and the meter (no DOM work more than 10 times per second).
  if (micStream) {
    if (analyser) lastRms = rmsFromAnalyser();
    micLevel = micLevel * 0.8 + Math.min(1, lastRms * 6) * 0.2;
    if (now - lastLevelUiT > 100) {
      lastLevelUiT = now;
      $('levelBar').style.width = `${Math.round(micLevel * 100)}%`;
      $('levelText').textContent = `Level: ${lastRms.toFixed(3)} (rms)`;
    }
  }

  if (!orb) return;
  const name = run ? run.state : manualState;
  const S = STATES[name];
  const level = levelFor(name, now);
  const speak = name === 'speaking'
    ? 0.5 + 0.5 * Math.sin((now / 1000) * 6) * Math.sin((now / 1000) * 1.7)
    : 0;
  const p = {
    t: now / 1000,
    speed: reduceMotion ? 0 : S.speed,
    level, speak, active: S.active, error: S.error, color: S.color,
  };
  // With reduced motion on, draw only when the visible state changes (no continuous animation).
  const key = `${name}|${reduceMotion ? 'static' : 'anim'}|${Math.round(level * 50)}|${Math.round(speak * 50)}`;
  if (!reduceMotion || key !== lastDrawKey) {
    orb.draw(p);
    lastDrawKey = key;
    if (run) run.draws++;
  }
}

// ---------- 3. microphone (only after an explicit tap)
let ctx = null;
let micStream = null;
let micSrc = null;
let meterNode = null;
let analyser = null;
let muteGain = null;
let micOnPerf = 0;
let meterMsgs = 0;
let lagSamples = [];
let calibrating = false;
let calSamples = [];
let threshold = null;
let bargeCount = 0;
let micPath = null;

async function ensureCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state !== 'running') await ctx.resume();
  return ctx;
}

function setLevelText(t) { $('levelText').textContent = t; }

function rmsFromAnalyser() {
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
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
  bargeCheck(rms);
}

async function micOn() {
  if (micStream) return;
  if (!window.isSecureContext) {
    setLevelText('Microphone needs a secure (HTTPS) page.');
    return;
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
  } catch (e) {
    R.mic.error = `${e.name}`;
    R.mic.events.push({ event: 'denied-or-failed', name: e.name, atMs: sinceStart() });
    setLevelText(`Microphone not allowed (${e.name}). The orb and tone tests still work.`);
    showResults();
    return;
  }
  await ensureCtx();
  micOnPerf = performance.now();
  meterMsgs = 0;
  lagSamples = [];
  const track = micStream.getAudioTracks()[0];
  const s = track.getSettings();
  delete s.deviceId;
  delete s.groupId;
  R.mic.settingsGranted = s;                       // which constraints the browser honoured
  R.mic.sampleRate = ctx.sampleRate;
  micSrc = ctx.createMediaStreamSource(micStream);
  muteGain = ctx.createGain();
  muteGain.gain.value = 0;                         // silent sink: keeps the graph running, never plays mic audio
  muteGain.connect(ctx.destination);
  try {
    await ctx.audioWorklet.addModule('meter-worklet.js');
    meterNode = new AudioWorkletNode(ctx, 'level-meter');
    meterNode.port.onmessage = onMeter;
    micSrc.connect(meterNode).connect(muteGain);
    micPath = 'AudioWorklet';
  } catch (e) {
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    micSrc.connect(analyser).connect(muteGain);
    micPath = 'AnalyserNode fallback';
    R.mic.workletError = String(e).slice(0, 200);
  }
  R.mic.path = micPath;
  R.mic.events.push({ event: 'on', atMs: sinceStart() });
  $('micOn').disabled = true;
  $('micOff').disabled = false;
  $('calBtn').disabled = false;
  setLevelText('Level: listening');
  showResults();
}

function micOff(reason = 'user') {
  if (!micStream) return;
  if (toneNodes) toneStop(`mic off (${reason})`);
  const secs = (performance.now() - micOnPerf) / 1000;
  micStream.getTracks().forEach((t) => t.stop());
  for (const n of [micSrc, meterNode, analyser, muteGain]) {
    try { if (n) n.disconnect(); } catch (_) { /* already disconnected */ }
  }
  R.mic.meterMessagesPerSec = secs > 0 ? rnd(meterMsgs / secs, 1) : null;
  R.mic.captureToMainThreadMs = lagSamples.length
    ? { p50: rnd(pct(lagSamples, 0.5)), p95: rnd(pct(lagSamples, 0.95)), max: rnd(Math.max(...lagSamples)), samples: lagSamples.length }
    : null;
  R.mic.events.push({ event: 'off', reason, atMs: sinceStart() });
  micStream = null; micSrc = null; meterNode = null; analyser = null; muteGain = null;
  micLevel = 0; lastRms = 0; calibrating = false; threshold = null; bargeCount = 0;
  $('micOn').disabled = false;
  $('micOff').disabled = true;
  $('calBtn').disabled = true;
  $('levelBar').style.width = '0%';
  setLevelText('Level: off');
  showResults();
}

function startCalibration() {
  if (!micStream || calibrating || toneNodes) return;
  calibrating = true;
  calSamples = [];
  setLevelText('Calibrating: stay quiet for 2 seconds');
  setTimeout(() => {
    calibrating = false;
    if (!micStream) return;
    const p95 = pct(calSamples, 0.95);
    threshold = Math.max(0.02, (p95 || 0) * 3);
    R.mic.calibration = {
      samples: calSamples.length,
      meanRms: rnd(mean(calSamples), 4),
      p95Rms: rnd(p95, 4),
      thresholdRms: rnd(threshold, 4),
    };
    setLevelText(`Calibrated. Threshold ${threshold.toFixed(3)} (rms)`);
    showResults();
  }, 2000);
}

// ---------- 4. test tone and barge-in
let toneNodes = null;
let toneTimer = null;
let toneStartPerf = 0;
let bargeArmed = false;

async function toneStart() {
  if (toneNodes) return;
  await ensureCtx();
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 440;
  const g = ctx.createGain();
  g.gain.value = 0;
  osc.connect(g).connect(ctx.destination);
  const t0 = ctx.currentTime + 0.05;
  for (let i = 0; i < 7; i++) {               // 1 s on, 0.5 s off, for about 10 s
    const s = t0 + i * 1.5;
    g.gain.setValueAtTime(0.2, s);
    g.gain.setValueAtTime(0, s + 1.0);
  }
  osc.start(t0);
  osc.stop(t0 + 10.5);
  toneNodes = { osc, g };
  toneStartPerf = performance.now();
  bargeArmed = !!micStream && threshold !== null;
  R.tone.plays++;
  R.tone.lastPlay = { bargeInArmed: bargeArmed, micOn: !!micStream, calibrated: threshold !== null };
  $('toneBtn').disabled = true;
  $('toneStop').disabled = false;
  toneTimer = setTimeout(() => toneStop('finished 10 s'), 10500);
  showResults();
}

function toneStop(reason, extra = {}) {
  if (!toneNodes) return;
  const t0 = performance.now();
  const { osc, g } = toneNodes;
  g.gain.cancelScheduledValues(ctx.currentTime);
  g.gain.setValueAtTime(0, ctx.currentTime);
  try { osc.stop(); } catch (_) { /* already stopped */ }
  osc.disconnect();
  g.disconnect();
  clearTimeout(toneTimer);
  toneNodes = null;
  bargeArmed = false;
  R.tone.stops.push({
    reason,
    msSinceToneStart: Math.round(t0 - toneStartPerf),
    scheduleMs: rnd(performance.now() - t0, 2),   // software only: time to schedule silence
    ...extra,
  });
  $('toneBtn').disabled = false;
  $('toneStop').disabled = true;
  showResults();
}

function bargeCheck(rms) {
  if (!toneNodes || !bargeArmed || threshold === null) return;
  if (rms > threshold) {
    bargeCount++;
    if (bargeCount >= 3) {                       // about 30 ms above threshold
      bargeCount = 0;
      toneStop('mic trigger (your voice or echo)', { rms: rnd(rms, 4), thresholdRms: rnd(threshold, 4) });
    }
  } else {
    bargeCount = 0;
  }
}

// ---------- wiring
$('runBtn').addEventListener('click', startRun);
$('stopRunBtn').addEventListener('click', () => stopRun('stopped by user'));
$('scale').addEventListener('change', () => {
  const s = Number($('scale').value);
  if (orb) orb.setScale(s);
  if (run) R.orb = { ...(R.orb || {}), scaleChangedDuringRun: true };
});
$('micOn').addEventListener('click', micOn);
$('micOff').addEventListener('click', () => micOff('user'));
$('calBtn').addEventListener('click', startCalibration);
$('toneBtn').addEventListener('click', toneStart);
$('toneStop').addEventListener('click', () => toneStop('stopped by user'));
$('copyBtn').addEventListener('click', async () => {
  const txt = JSON.stringify(R, null, 2);
  $('results').textContent = txt;
  try {
    await navigator.clipboard.writeText(txt);
    $('copyBtn').textContent = 'Copied';
  } catch (_) {
    const range = document.createRange();
    range.selectNodeContents($('results'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    $('copyBtn').textContent = 'Copy blocked: text selected, copy manually';
  }
  setTimeout(() => { $('copyBtn').textContent = 'Copy results'; }, 4000);
});

// Privacy and safety: stop the orb run, the mic and the tone as soon as the page is hidden or closed.
function stopEverything(reason) {
  if (run) stopRun(`page hidden or closed (${reason})`);
  if (micStream) micOff(reason);
  if (toneNodes) toneStop(`page hidden or closed (${reason})`);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) stopEverything('visibilitychange'); });
addEventListener('pagehide', () => stopEverything('pagehide'));

checkCaps();
showResults();
requestAnimationFrame(frame);
