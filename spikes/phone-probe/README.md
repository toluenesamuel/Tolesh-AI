# Phone probe: orb and basic audio (throwaway)

Status: **not run yet**. Written for the F1 spike plan (`docs/F1_SPIKE_PLAN.md`) and the Android-only workflow (`docs/ANDROID_ONLY_WORKFLOW.md`). This is not the Tolesh app. It is a single static page used to check, on one Android phone, whether the animated orb draws at a usable frame rate and whether the browser can capture the microphone and stop playback when the user speaks.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page and strict Content Security Policy (no network, scripts only from this folder). |
| `probe.css` | Layout. |
| `probe.js` | Capability check, 5-minute orb run, microphone (only after a tap), test tone with barge-in, results. |
| `orb.js` | Orb renderer: WebGL2 (`createOrb`) and a 2D canvas fallback (`createOrb2D`). |
| `meter-worklet.js` | AudioWorklet that computes a level (RMS) and posts numbers only. It outputs silence. |

## What it does not do

- It does not upload, record, or store audio, and it does not store results. The page's CSP sets `connect-src 'none'`.
- It does not start the microphone on page load. The microphone starts only after the user taps "Turn on microphone" and allows the browser prompt.
- It does not install anything, use a build step, or load code from any other site.
- It is not a Tauri or Capacitor test. Those need their own runs (see `docs/F1_SPIKE_PLAN.md`).

## Run it (no installs)

Serve only this folder, never the repository root (the root contains `.git`).

```bash
cd spikes/phone-probe
python3 -m http.server 8080 --bind 0.0.0.0
```

Open the preview link shown by the sandbox (an `https://` address). Microphone access needs a secure context, so use the HTTPS preview link, not plain `http://`.

## Test steps (about 15 minutes)

1. Read section 1 (browser check). Note `webgl2`, `audioWorklet`, and `getUserMedia`.
2. Note the battery percentage. Tap **Start 5-minute orb run**. Keep the screen on. The state changes every 10 s. Let it finish, or tap **Stop run**. Note the battery again.
3. Tap **Turn on microphone** and allow access. If denied, record the error name and continue; the tone test still runs.
4. Stay quiet and tap **Calibrate noise**. Wait 2 s.
5. Tap **Play test tone**, then speak loudly or hold the phone near the speaker. Record whether the tone stops and after how long (`msSinceToneStart`).
6. Repeat step 5 with earphones, if available. Record that as a separate note.
7. Tap **Copy results** and paste the JSON into the chat. Delete the user-agent line first if you prefer.

Stopping: the orb run, the microphone, and the tone all stop as soon as the page is hidden or closed.

## Limits

- Software timings only (`requestAnimationFrame` intervals, AudioWorklet message lag). Hardware audio latency, thermal throttling, GPU time, and battery drain over time are not measured. Those need `adb` or a physical measurement, not this page.
- The barge-in trigger measures the microphone level. A speaker's own sound can trigger it (echo). The result records whether this happened; it does not separate echo from speech.
- The results depend on the browser. Record the Chrome or WebView version shown in the user-agent line.
