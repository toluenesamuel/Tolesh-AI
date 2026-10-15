# Orb demo (throwaway test build)

Status: **built, logic-tested in Node, not yet run in a browser or on a phone.** This is a single static page used to review the companion orb and its reactions. It is not the Tolesh app. Nothing is built or installed.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page layout and a strict Content Security Policy (no network, scripts only from this folder). |
| `probe.css` | Mobile-first layout and styles. |
| `probe.js` | Controls, microphone, simulated reply, pause, stop, reset, frame-rate check, results. |
| `orb.js` | Orb renderer: WebGL2 "Liquid Core" shader, with a Canvas 2D fallback. |
| `state.js` | Pure logic: modes, colours, motion targets, easing, speech envelope. No DOM. |
| `meter-worklet.js` | AudioWorklet that computes a level (RMS) and posts numbers only. It outputs silence. |
| `tests/demo.test.mjs` | Node built-in tests (16). They check logic and wiring only. |

## Run it (no installs)

Serve only this folder, never the repository root (the root contains `.git`).

```bash
cd spikes/phone-probe
python3 -m http.server 8080 --bind 0.0.0.0
```

Open the preview link for port 8080. Microphone access needs the secure `https://` preview link, not plain `http://`.

Logic tests (needs Node, no installs):

```bash
node --test tests/demo.test.mjs
```

## How to test each reaction

Tap a button in the **Reaction** card. Each one changes the orb and its status text.

1. **Idle**: slow breathing, slow inner glow.
2. **Listening**: a teal rim and a brighter halo. Without the microphone, the glow pulses gently. With it on, the glow follows your voice.
3. **Processing**: amber tint, and colour circulates inside the orb. No audio is used.
4. **Speaking**: the orb pulses on its own with no audio. Use *Simulate reply* for a real-audio test.
5. **Acting**: a steady lime arc sweeps round the orb.
6. **Error**: coral rim, calm shape, slightly dimmer. No flashing. Tap *Idle* to clear it.

### Microphone

1. Tap **Start microphone**. Your browser asks for permission. Nothing listens before this tap.
2. The level bar shows the input. Tapping **Stop microphone** stops the tracks and returns the orb to Idle.
3. Optional: stay quiet and tap **Calibrate quiet**, then speak over a *Simulate reply*. Speech above the calibrated threshold stops the test voice and switches the orb to Listening.

### Simulated reply

1. Tap **Simulate reply**. An 8-second quiet test voice plays. The orb follows its real output level.
2. Tap **Stop reply** to cancel. The voice fades out over about 0.15 s.

### Stop, pause and reset

- **Pause**: freezes and dims the orb. Tap **Resume** to continue.
- **Stop all**: turns off the microphone and the test voice and returns to Idle.
- **Reset demo**: does the same and clears the results.
- The page also stops the microphone and the test voice, and pauses the orb, when it is hidden or closed.

### Frame rate and results

- **Measure frame rate (20 s)** records the median frame rate and the share of slow frames.
- **Copy results** copies the JSON log. Nothing is uploaded or stored.

## Limits

- Logic tests run in Node. They do not check the GPU shader, WebGL, the microphone, or audio playback in a browser. Those need a browser run on the phone.
- The results show software timings only. They do not measure hardware audio latency, heat, or battery drain.
- Echo: the phone speaker can trigger the interruption check. Use earphones for a cleaner test.
- Reduced motion is honoured. The orb then holds still and redraws only when its state or level changes.
