# Cloud avatar demo (throwaway test build)

Status: **built, logic-tested in Node, and browser-tested in headless Chromium (not yet on a phone).** This single static page shows the approved white cloud avatar and its reactions. It replaced the orb on 2026-10-16. It is not the Tolesh app. Nothing is built or installed.

## Cloud replacement (2026-10-16, Request K)

The white cloud avatar replaced the orb on this page. This was a controlled, documented change.

- **Added:** `cloud-view.js` (adapter from the probe's modes and real audio levels to the cloud controller), `cloud/` (exact copies of `spikes/cloud-avatar/cloud-core.js` and `cloud-scene.js`), `tests/cloud-view.test.mjs` (6 tests, including a drift check on the copies).
- **Changed:** `index.html` (canvas replaced by an SVG with id `orb`, and page copy), `probe.js` (the cloud replaces the orb renderer; levels are real only; pause freezes the cloud; cursor and touch move its attention), `probe.css` (SVG sizing; the mode buttons fit their cards).
- **No longer loaded:** `orb.js` and `eye.js`. They remain in the repo, and `tests/demo.test.mjs` and `tests/eye.test.mjs` still test them.
- **Audio rules kept:** listening follows the microphone analyser. Speaking follows the output analyser of the test voice. With no real audio, the mouth stays closed. The cloud's built-in simulated voice is never used on this page.
- **Rollback:** revert the replacement commit with `git revert`, or restore `index.html`, `probe.js` and `probe.css` from commit `7d24f6b`. The orb is still served from an export of that commit on port 8080 for comparison.
- **Not wired:** the main app's conversation lifecycle, because the app has no code yet.

## Files (current)

| File | Purpose |
|---|---|
| `index.html` | Page layout and a strict Content Security Policy (no network, scripts only from this folder). |
| `probe.css` | Mobile-first layout and styles. |
| `probe.js` | Controls, microphone, simulated reply, pause, stop, reset, frame-rate check, results. |
| `cloud-view.js` | Adapter: probe modes and real levels to the cloud controller; pointer binding. |
| `cloud/` | Copies of the cloud prototype modules (`cloud-core.js`, `cloud-scene.js`). |
| `orb.js`, `eye.js` | Previous orb renderer and eye. Not loaded; kept for rollback. |
| `state.js` | Pure logic: modes and labels, speech envelope for the test voice, microphone level conversion. No DOM. |
| `meter-worklet.js` | AudioWorklet that computes a level (RMS) and posts numbers only. It outputs silence. |
| `tests/` | Node built-in tests: `demo.test.mjs` (17), `eye.test.mjs` (14, orb modules), `cloud-view.test.mjs` (6). |
| Browser tests | `spikes/cloud-avatar/e2e/probe.browser.test.mjs` (9) in headless Chromium with a fake microphone and test tone. |


## Run it (no installs)

Serve only this folder, never the repository root (the root contains `.git`).

```bash
cd spikes/phone-probe
python3 -m http.server 8083 --bind 0.0.0.0
```

Open the preview link for port 8083 (the orb is still on 8080 for comparison). Microphone access needs the secure `https://` preview link, not plain `http://`.

Logic tests (needs Node, no installs):

```bash
node --test tests/demo.test.mjs
```

## How to test each reaction

Tap a button in the **Reaction** card. Each one changes the cloud and its status text.

1. **Idle**: slow breathing, slow inner glow.
2. **Listening**: a teal rim and a brighter halo. Without the microphone, the glow pulses gently. With it on, the glow follows your voice.
3. **Processing** (thinking): the eyes drift up and to the side, with a slight head tilt. No audio is used.
4. **Speaking**: with no audio, the mouth stays closed. Use *Simulate reply* for a real-audio test.
5. **Acting**: the eyes narrow and look ahead.
6. **Error**: coral rim, calm shape, slightly dimmer. No flashing. Tap *Idle* to clear it.

### Microphone

1. Tap **Start microphone**. Your browser asks for permission. Nothing listens before this tap.
2. The level bar shows the input. Tapping **Stop microphone** stops the tracks and returns the cloud to Idle.
3. Optional: stay quiet and tap **Calibrate quiet**, then speak over a *Simulate reply*. Speech above the calibrated threshold stops the test voice and switches the cloud to Listening.

### Simulated reply

1. Tap **Simulate reply**. An 8-second quiet test voice plays. The mouth follows its real output level.
2. Tap **Stop reply** to cancel. The voice fades out over about 0.15 s.

### Stop, pause and reset

- **Pause**: freezes the cloud. Tap **Resume** to continue.
- **Stop all**: turns off the microphone and the test voice and returns to Idle.
- **Reset demo**: does the same and clears the results.
- The page also stops the microphone and the test voice, and freezes the cloud, when it is hidden or closed.

### Frame rate and results

- **Measure frame rate (20 s)** records the median frame rate and the share of slow frames.
- **Copy results** copies the JSON log. Nothing is uploaded or stored.

## Limits

- Logic tests run in Node. They do not check the GPU shader, WebGL, the microphone, or audio playback in a browser. Those need a browser run on the phone.
- The results show software timings only. They do not measure hardware audio latency, heat, or battery drain.
- Echo: the phone speaker can trigger the interruption check. Use earphones for a cleaner test.
- Reduced motion is honoured. The cloud then holds still: no float, blink or sway. State changes still show.
