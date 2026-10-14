# F1 Technical Spike Plan

Status: **plan only. No spike has been executed. Execution requires your approval (§12).**
Date: 2026-10-14. Phase: roadmap Phase 0 (decisions and evaluation, no product UI).
Depends on: docs/FRONTEND_IMPLEMENTATION_PLAN.md (F1 in §10), OPEN_DECISIONS.md (approval record), docs/NIGERIAN_LANGUAGE_AND_SPEECH_RESEARCH.md, docs/NIGERIAN_LANGUAGE_EVALUATION_PLAN.md, ARCHITECTURE_PLAN.md §3.9–3.10 and §7.

Targets in this plan are **proposed starting values**, marked *(proposed)*. Each one needs your confirmation before the spike runs, and each is then locked in the ADR. A target that is not met is recorded as a result, not quietly relaxed.

---

## 1. Purpose

The spike answers six questions. Each answer leads to a recorded decision. It is not product work, and nothing from it ships.

| # | Question | Decision it informs |
|---|---|---|
| Q1 | Can a WebGL2 shader orb hold smooth animation on a mid-range Android phone and a desktop, within power and thermal limits? | D-19 orb renderer; §3.7 of the frontend plan |
| Q2 | Can the mic, VAD and barge-in run with latency and echo behaviour that a voice companion needs? | Phase 2 design; D-22 |
| Q3 | Can Tauri 2 deliver mic, WebGL2 and AudioWorklet on Windows and on the actual Zorin OS release? | D-24 (Tauri, with Electron fallback) |
| Q4 | Can Capacitor 8 deliver mic, WebGL2 and AudioWorklet in the Android WebView, with a minimal permission set? | D-25 (Capacitor, or reassess) |
| Q5 | Which Nigerian English, Pidgin and Yoruba speech paths are worth testing, and what label can each honestly get? | Phase 2 and Phase 3 scope; the support matrix |
| Q6 | What does the measurement harness need, so later phases can reuse it? | Phase 0 evaluation foundation |

Q5 is the only question that depends on third parties and on native speakers. It runs as a separate, gated track (WS-C). It does not block the orb, audio and shell results.

## 2. Scope and non-scope

**In scope:** WS-A orb; WS-B mic, VAD, streaming, playback and barge-in; WS-C language feasibility, planning and gated trials; WS-D Tauri on Windows and Zorin OS; WS-E Capacitor on Android; WS-F the measurement harness used by all workstreams.

**Out of scope (not in the spike, under any approval given so far):**
- Persona, LLM replies, the Situation Gate, memory, tasks.
- Screen awareness and computer control (D-23: no implementation until the security review is approved).
- Real provider API calls, unless §8 approvals are given and provider terms are reviewed.
- Floating overlay, Android overlay service, notifications, and any packaging for distribution (signing, stores).
- Final visual design. The spike uses a neutral test scene, not the approved visual language.
- Any claim about voice quality or language quality beyond what the gated tests measure.

## 3. Code and artifact policy

- **Location of spike code:** proposed as `spikes/` on `arena/fae714f3-tolesh-ai`, with a README stating it is throwaway. The alternative is to keep it outside the repository and commit only results. **Your choice (§12, item 6).** No other branch will be used.
- **No application scaffold.** The spike folder is not the product `src/`.
- **Dependencies:** pinned in the spike's own lockfile, only after approval. Versions are checked again at install time (the versions in the frontend plan are from 2026-10-14).
- **Results:** summary tables and conclusions in docs/spikes/F1-results.md (created by the spike). Raw logs are kept outside Git unless small.
- **Audio:** no recording of people is committed. Test speech from native speakers is stored only with written consent, outside Git, and deleted after the spike unless consent covers retention (ties to SECURITY_AND_PRIVACY_PLAN §4).

## 4. Environment and devices

Android-only adaptation (no Windows or Zorin PC, phone as the only device): see docs/ANDROID_ONLY_WORKFLOW.md. It separates tests that run now, on the phone, in CI, in Firebase Test Lab, and on physical Windows or Zorin machines.

### 4.1 Hardware needed (you to provide or confirm)

| Target | Minimum needed | Why |
|---|---|---|
| **Reference Android phone (mid-range)** | Named model, Android version, RAM, GPU, WebView version, and that it can be put in developer mode and connected by USB | Orb and Capacitor gates (Q1, Q4). The reference device sets the budgets. |
| Low-end Android phone (optional) | Same details | Shows the fallback path; not a gate |
| Windows 10 or 11 PC | Version, GPU, WebView2 runtime version | Tauri gate (Q3) |
| **Zorin OS PC** | Exact Zorin release (for example 17 or 18, with point version), GPU vendor and driver, session type (X11 and Wayland both if available) | Tauri gate (Q3). The Zorin test is a condition of D-24 |
| Audio | Headset with mic; laptop or phone speakers; a quiet room and a noisy room (fan or traffic recording) | Q2 barge-in and echo tests |

### 4.2 Sandbox constraints (checked 2026-10-14)

From this sandbox, `github.com` responds. `crates.io`, `static.crates.io`, `dl.google.com`, `maven.google.com`, `cdn.playwright.dev` and `archive.ubuntu.com` did **not** respond. Therefore:
- Rust and Tauri builds cannot run here (no crates.io).
- Android Gradle and Capacitor Android builds cannot run here (no Google Maven).
- Playwright browser downloads cannot run here (no Playwright CDN).
- Linux system packages (WebKitGTK, GStreamer) cannot be installed here (no Ubuntu archive).

These steps must run on your machines, or in a CI runner you approve (for example GitHub Actions, which needs a workflow file and a decision about runner cost and access). The spike plan does not assume any of them run in this sandbox.

## 5. Workstreams

### WS-A Orb animation and performance (Q1)

**Variants**
- A1: WebGL2 fragment shader, one full-screen quad, one canvas.
- A2: Canvas 2D radial gradient with the same state logic (fallback).
- A3: static SVG with the state label (last-resort fallback).

**Scenarios** (each run 5 minutes, three repeats, cold and warm start):
- S-idle (breathing); S-listen (mic level, real and synthetic); S-speak (synthetic speech envelope); S-act (segmented ring, progress); S-error (steady ring); S-reduced (OS reduced-motion on); S-hidden (page or window hidden for 60 seconds, then visible); S-affect (cycling warm, amused, concerned, playful-annoyed, calm-serious).

**Parameters to vary:** canvas resolution scale 1.0, 0.75 and 0.5; device pixel ratio capped at 2.

**Measurements**
- Frame intervals: `requestAnimationFrame` timestamps, giving mean fps, p95 frame interval, and dropped-frame percentage.
- GPU time, where the platform exposes it (`EXT_disjoint_timer_query_webgl2`). Mark as unavailable if not supported.
- JS heap over time (Chromium), and memory of the WebView process (Android: `dumpsys meminfo`).
- CPU percentage of the renderer process (Linux `pidstat`; Windows Performance Monitor; Android `top` or Perfetto).
- Thermal status (Android: `PowerManager.getCurrentThermalStatus()` through a debug build, or `dumpsys thermalservice`).
- Battery change over a 15-minute run compared with an idle-screen baseline (Android `dumpsys batterystats`, or the battery percentage at start and end with the same brightness).
- React commits during the orb loop (React Profiler; expected zero). The spike may use a plain page without React for A1 and A2 if the React path is tested separately.

**Pass criteria: §6.1.**

**Known limits:** frame timing from `requestAnimationFrame` does not capture compositor delay; GPU time may be unavailable on mobile WebViews. Report those as "not measured", not as passed.

### WS-B Microphone, speech and interruption (Q2)

**B1 Capture.** `getUserMedia` with `echoCancellation`, `noiseSuppression` and `autoGainControl` enabled; record the requested and actual sample rate and channel count. Feed an AudioWorklet that emits 20 ms frames. Record worklet underrun count.

**B2 Voice activity.** Compare `@ricky0123/vad-web` (ISC, runs in the browser) with a simple energy-threshold baseline on the same recordings. The VAD model is loaded from the app's own origin, not a CDN (R-5).

**B3 Streaming.** Send 16 kHz mono PCM chunks to a local mock ASR endpoint that returns timestamps. This tests transport, chunking and timing. It does not test any provider.

**B4 Playback.** Play a pre-recorded TTS-like clip as 100 ms chunks through a Web Audio queue. Verify that cancelling the queue stops output at once (gain set to zero, sources stopped, queue drained).

**B5 Barge-in.** While the clip plays, a person speaks. Measure from VAD speech-onset to playback silence. Repeat with speakers at a fixed volume (echo test) and with a headset.

**B6 Interruptions by the OS.** Android: incoming call and another app taking audio focus. Windows and Linux: unplugging a headset mid-capture and changing the default input device.

**B7 Permission flows.** Deny, then allow, the microphone prompt. Confirm that a denial gives a visible explanation rather than a silent failure. On Linux, reproduce the WebKitGTK denial reported by third parties (§9), and confirm which settings and handlers change it.

**Pass criteria: §6.2.**

### WS-C Nigerian English, Pidgin and Yoruba feasibility (Q5)

WS-C is gated. It does not start until §8 approvals are given.

**C1 Gold set.** Written fresh by native speakers, kept private (eval plan §4 and research §5.5). Monolingual sets for Nigerian English, Pidgin and Yoruba, plus a code-switched set. Yoruba sets include tone-marked and unmarked versions.

**C2 Raters.** At least three native raters per language (D-06). Raters are paid and consent in writing to their audio being processed by any third-party provider.

**C3 Candidate paths.** Each candidate is run through the same adapter interface, and only if its terms are reviewed:
- ASR: Whisper large-v3 (open weights; GPU hosting needed), NaijaVox-2.0 (open weights; behavioural restrictions apply), Azure Speech en-NG, Spitch (Yorùbá listed; Pidgin and voices unverified).
- TTS: Azure `en-NG-AbeoNeural` (male, English) and `en-NG-EzinneNeural`; `mms-tts-yor`; YarnGPT (product and local; local model card says it ignores intonation); ElevenLabs Eleven v3 or v4 (Yoruba listed; Pidgin not found); Spitch.
- Not in the shortlist unless new evidence appears: Gemini TTS (Yoruba and Pidgin not found in its listed languages).

**C4 Frontend-relevant checks.** Whether each candidate accepts 16 kHz PCM; whether it accepts a language hint; time-to-first-partial; whether diacritised Yoruba text is needed for TTS and how the diacritisation step is supplied.

**C5 Metrics.** As defined in the evaluation plan §6, dialect-aware (research §5.2). Tone-error metric for Yoruba.

**Pass criteria: §6.4. Thresholds are the placeholders in the evaluation plan §7 until you sign them off (D-17).**

**Expected outcome, to be stated honestly in the results:** Nigerian English voice may reach "Beta" at most; Yoruba voice and Pidgin voice are likely "Not supported" unless a provider clears both ASR and TTS gates. The product UI is already designed for that outcome (frontend plan §5).

### WS-D Tauri 2 on Windows and Zorin OS (Q3)

**D1 Minimal shell.** Tauri 2 with the version pinned at install time. The shell loads the test scene from the app origin. Built on the user's machine or in an approved CI runner (§4.2).

**D2 Web features.** In the shell: `getUserMedia` success, `AudioWorklet` availability, WebGL2 availability and version, `enumerateDevices` output. Run the same checks in a plain browser as a control.

**D3 Linux microphone path.** Run with Tauri's default permission handling first, then with a permission handler that allows the microphone and leaves other request kinds to WebKit's default. Third-party reports (§9) say WebKitGTK denies `getUserMedia` by default and needs `enable-media-stream` and `enable-webaudio` plus a permission-request handler. Confirm or refute this for the pinned Tauri version.

**D4 GStreamer and PipeWire.** Record which GStreamer plugin packages are present (base, good, pipewire). Confirm that `enumerateDevices` returns an audio input before and after installing them. Third-party reports say an empty device list means the plugins are missing.

**D5 Desktop behaviour.** Always-on-top window; hide to tray; global shortcut for Stop; system notification. Record which work on X11 and on Wayland.

**D6 Cost.** Installer size, idle RAM and idle CPU with the orb running in state idle at 30 fps.

**Pass criteria: §6.3.**

**Note on WebKitGTK:** WebKitGTK 2.40.0 (March 2023) enabled WebGL2 through ANGLE. The WebKitGTK version on the actual Zorin release is not known and must be read on the device (`apt-cache policy libwebkit2gtk-4.1-0`).

### WS-E Capacitor 8 on Android (Q4)

**E1 Minimal app.** Capacitor 8 wrapping the same test-scene web build as WS-D. Built on the user's machine (Gradle needs Google Maven).

**E2 Manifest variants.** (a) `RECORD_AUDIO` only; (b) `RECORD_AUDIO` plus `MODIFY_AUDIO_SETTINGS`. A third-party report (tc-mobile PR #334, September 2026) says Capacitor 8.5.1 requests both from Android for the WebView's audio capture and denies the WebView when `MODIFY_AUDIO_SETTINGS` is not declared. Record whether variant (a) fails on the reference device. Both variants are reviewed for Play-policy and privacy impact before any choice.

**E3 Web features in the WebView.** `getUserMedia`, `AudioWorklet`, WebGL2, with the WebView version recorded.

**E4 Audio focus and background.** Incoming call, another app's audio, screen off with capture active (expected: capture stops or pauses, and the state shows it).

**E5 Orb on device.** WS-A on the reference phone.

**E6 Power.** WS-A battery and thermal measurements.

**Pass criteria: §6.3.** If E2 variant (a) fails and (b) passes, the choice of manifest is recorded with its reason, and the permission is listed in the privacy notes.

### WS-F Measurement harness (Q6)

One harness used by all workstreams: a timestamped event log (CSV), a fixed scenario script, a device and build identifier, and a summary script that computes percentiles. The harness's own output is checked by a known-answer test: a synthetic 60 fps timeline must produce the expected numbers.

## 6. Measurable success criteria

Each criterion has an ID so the results can refer to it. Targets are proposed; confirm or change them in §12 before the spike.

### 6.1 Orb (WS-A)

| ID | Criterion | Target (proposed) | How measured |
|---|---|---|---|
| O-1 | Mid-range Android, WebGL2 at scale 1.0, S-speak and S-listen for 5 min | Mean ≥ 58 fps; p95 frame interval ≤ 20 ms; dropped frames ≤ 3% | rAF timestamps |
| O-2 | Same device, after 15 min | Thermal status stays at or below MODERATE; no frame stall over 100 ms | Thermal API and frame log |
| O-3 | Desktop reference (Windows and Zorin), 1080p window | Mean ≥ 59 fps; p95 ≤ 18 ms; renderer CPU ≤ 10% of one logical core at S-idle and ≤ 15% at S-speak | rAF and `pidstat` or Performance Monitor |
| O-4 | Acceptance floor on the mid-range Android device | If O-1 fails, the floor is mean ≥ 45 fps and p95 ≤ 30 ms with resolution scaling on. Below the floor, the Canvas 2D path becomes the default on that device class | rAF with scale 0.75 and 0.5 |
| O-5 | Idle | At S-idle, mean ≥ 28 fps (30 fps target) on all devices | rAF |
| O-6 | Hidden | Zero animation frames while hidden (after 2 seconds) | rAF count |
| O-7 | Battery, mid-range Android | Battery drop over 15 min is at most 4 percentage points above the idle-screen baseline measured on the same day (proposed) | Battery stats |
| O-8 | Memory | JS heap or WebView memory slope ≤ 1 MB per 10 min after a 2-minute warm-up | Heap and meminfo |
| O-9 | Reduced motion | No continuous animation frames under S-reduced; state still shown in text | rAF count and visual check |
| O-10 | React isolation | Zero React commits during the orb loop | React Profiler (if React is used in the test page) |
| O-11 | Fallbacks | Canvas 2D on the low-end device meets mean ≥ 30 fps at S-speak. SVG path has no per-frame work | rAF |

### 6.2 Audio, speech and interruption (WS-B)

| ID | Criterion | Target (proposed) | How measured |
|---|---|---|---|
| A-1 | Capture to level-meter update, software path | p95 ≤ 100 ms | Worklet frame timestamp to rAF draw. This excludes hardware and driver latency, which is stated as a limit |
| A-2 | Speech-onset detection (clean speech, quiet room, 50 scripted utterances per device) | p95 onset-to-detect ≤ 250 ms; missed onsets ≤ 2% | Timestamps against the script |
| A-3 | False triggers with no speech | ≤ 1 per 10 min in the quiet room; ≤ 3 per 10 min in the noisy room | 10-min silent and fan-noise recordings |
| A-4 | Barge-in stop, headset | p95 from VAD onset to playback silence ≤ 150 ms; target ≤ 100 ms | Timestamps from the playback queue |
| A-5 | Barge-in stop, speakers (echo) | p95 ≤ 200 ms; self-interruptions ≤ 1 per 10 min at fixed volume with echo cancellation on | Playback and VAD logs |
| A-6 | Long capture | 30 min without AudioWorklet underruns or unrecovered capture loss | Worklet and track-state logs |
| A-7 | Permission denial | Visible explanation within 1 s in at least 95% of denial runs; zero silent failures | Visual check plus log |
| A-8 | Android audio focus | Capture stops or pauses within 1 s of focus loss; resumes only on user action | Logs and visual check |
| A-9 | Device switch (Windows and Linux) | Capture recovers on the new device, or shows a clear state, within 3 s | Logs and visual check |

If A-5 fails on speakers, the product rule for v1 is: barge-in is headset-first, and speaker mode is labelled as such in the UI. That is a product decision, and it needs your approval (§12).

### 6.3 Shells and device compatibility (WS-D, WS-E)

| ID | Criterion | Target | Gate |
|---|---|---|---|
| T-W-1 | Windows: `getUserMedia` audio succeeds on first prompt; `enumerateDevices` lists an input | Pass | D-24 |
| T-W-2 | Windows: WebGL2 and AudioWorklet available | Pass | D-24 |
| T-W-3 | Windows: idle RAM with orb at S-idle | Recorded; proposed ≤ 300 MB | D-24 |
| T-Z-1 | Zorin: the exact release and WebKitGTK version are recorded | Recorded | D-24 |
| T-Z-2 | Zorin: `getUserMedia` audio succeeds with the permission handler (D3), and the default behaviour is recorded | Pass with the handler | **D-24 condition (your approval)** |
| T-Z-3 | Zorin: WebGL2 and AudioWorklet available | Pass | **D-24 condition** |
| T-Z-4 | Zorin: GStreamer and PipeWire plugin list recorded; device list non-empty | Pass | **D-24 condition** |
| T-Z-5 | Zorin: orb meets O-3 | Pass | **D-24 condition** |
| T-Z-6 | Zorin: always-on-top, tray and Stop shortcut work on X11 and on Wayland (both recorded) | Recorded; a Wayland gap is a documented limit for F7 | D-24 |
| T-A-1 | Android: `getUserMedia` audio succeeds in the WebView with variant (a) and with variant (b) (E2) | At least one variant passes with a documented manifest | **D-25 condition** |
| T-A-2 | Android: WebGL2 and AudioWorklet available in the WebView | Pass | **D-25 condition** |
| T-A-3 | Android: audio focus and background behaviour (A-8 and E4) | Pass | **D-25 condition** |
| T-A-4 | Android: orb meets O-1, O-2 and O-7 | Pass or floor (O-4) recorded | **D-25 condition** |

### 6.4 Language feasibility (WS-C)

These criteria are only meaningful after D-17 is signed off, and they apply per language and mode.

| ID | Criterion | Source |
|---|---|---|
| L-1 | Nigerian English TTS intelligibility ≥ 95%; naturalness mean ≥ 3.5 for "Beta" | Eval plan §7 (placeholder until D-17) |
| L-2 | Nigerian English ASR WER target set after baseline; reported with dialect-aware scoring | Eval plan §7 |
| L-3 | Pidgin text comprehension ≥ 90%, naturalness ≥ 3.5, zero hard fails, for "Experimental" | Eval plan §7 |
| L-4 | Yoruba text comprehension ≥ 85%, tone-mark handling documented, zero hard fails, for "Experimental" | Eval plan §7 |
| L-5 | Yoruba and Pidgin voice: both ASR and TTS clear their bars (incl. tone correctness for Yoruba) or the label is "Not supported" | Eval plan §7 |
| L-6 | Code-switching meaning preserved ≥ 85%, reported separately | Eval plan §7 |
| L-7 | Time-to-first-partial for ASR (p95) recorded per provider; a conversation target is set after baseline | Proposed; no current figure exists (research §5.6) |
| L-8 | Every provider's terms, retention and transfer posture reviewed before any audio is sent | SECURITY_AND_PRIVACY_PLAN §3–5 |

## 7. Test plan (summary)

| Test group | Runs | Repeats | Output |
|---|---|---|---|
| Orb scenarios (WS-A) | 8 scenarios × 3 scale settings × 3 devices | 3 each | Frame and power table |
| Audio capture and VAD (WS-B1–B2) | 50 utterances per device × 2 rooms; 10-min silence and noise | 3 | Latency and false-trigger tables |
| Barge-in and echo (WS-B4–B5) | Headset and speakers × 2 devices | 20 interruptions each | Stop-time distribution |
| OS interruptions (WS-B6) | Scripted per platform | 3 | Pass or fail with logs |
| Permission flows (WS-B7) | Deny, then allow, on each platform | 5 each | Behaviour log |
| Desktop shells (WS-D) | Windows and Zorin (X11 and Wayland) | 3 | Checklist and resource table |
| Android shell (WS-E) | Reference and low-end devices | 3 | Checklist, power and thermal table |
| Language (WS-C) | Per §5 WS-C | Per eval plan §8 | Support matrix entries |

Also: an accessibility check on the test scene (axe in Chromium on the user's machine) and a keyboard-only pass of the Stop control. These are small and run for each shell.

## 8. Dependencies and approvals before execution

The spike does not start until each item here has your answer.

| Dependency | Why | Status |
|---|---|---|
| Hardware access (§4.1) | No device can be tested without it | **Needed from you** |
| Toolchains on your machines (Rust, Tauri CLI, Android SDK and Gradle, Node, pnpm) | The sandbox cannot reach crates.io or Google Maven | **Your approval; you run the installs** (§12) |
| Linux packages (WebKitGTK, GStreamer, PipeWire) on Zorin | Sandbox cannot reach the Ubuntu archive | **Your machine** |
| Playwright browsers | Sandbox cannot reach the Playwright CDN | **Your machine or approved CI** |
| D-06 native raters, with written consent | WS-C | **Needed before WS-C** |
| D-05 provider shortlist and trial budget | WS-C; sending audio to providers | **Needed before WS-C** |
| D-17 release thresholds, signed off | WS-C pass criteria | **Needed before WS-C** |
| Provider terms and DPAs reviewed | L-8 | **Before any provider audio** |
| Confirmation of §6 targets | Make pass criteria binding | **Needed before WS-A/B** |

Without the hardware, WS-A through WS-E cannot produce results. WS-F can be built and checked in the sandbox if you approve that, since it uses only the sandbox's own tools.

## 9. Known risks from prior research (to confirm in the spike)

These come from third-party reports and from our research. None has been verified by us.

| Risk | Source | How the spike addresses it |
|---|---|---|
| WebKitGTK refuses `getUserMedia` unless media streams are enabled and a permission-request handler allows the microphone | Community reports on Tauri 2 Linux apps (Utsuwa issue #273, October 2026; Buzz issue #7892, September 2026; fastled-wasm PR #228) | D3, T-Z-2 |
| GStreamer plugins missing, so `enumerateDevices` is empty on WebKitGTK | Community report (zackees/kernal-api issue #154) | D4 |
| Capacitor 8.5.x denies the WebView microphone if `MODIFY_AUDIO_SETTINGS` is not declared | tc-mobile PR #334 (September 2026, one device) | E2 |
| Tauri Android WebView microphone problems | GitHub tauri-apps/tauri discussion #12732 (April 2026) | Relevant to D-25 comparison; reassess only if Capacitor fails |
| WebGL2 on WebKitGTK depends on the version | WebKitGTK 2.40.0 release notes | T-Z-3 on the actual release |
| Whisper and other ASR "correct" dialect words | Research §2 | WS-C dialect-aware metrics |

**Revised position on D-25:** the frontend plan said Capacitor has "mature" microphone permission handling. The September 2026 report shows that Capacitor 8.5.x had a permission problem of its own. Capacitor remains the recommendation only as approved "subject to device testing" (your condition). If E2 shows the failure on the reference device and no documented workaround holds, D-25 must be reopened.

## 10. Go and no-go rules

| Decision | Go if | No-go action |
|---|---|---|
| D-19 orb renderer | O-1 to O-3 pass on the reference devices | Use A2 (Canvas 2D) as the default on the failing device class; record in D-19 |
| D-24 Tauri on desktop | T-Z-2 to T-Z-5 pass on Zorin, and T-W-1 and T-W-2 pass on Windows | Propose Electron as the fallback. This needs a new approval, because Electron changes the bundle, memory and security profile |
| D-25 Capacitor on Android | T-A-1 to T-A-4 pass on the reference device | Reassess Tauri 2 mobile with the same tests. Needs a new approval |
| Barge-in headset-first rule | A-5 fails on speakers | Adopt the headset-first label for v1. Needs approval |
| Language labels (WS-C) | Each language's label set from §6.4 | Keep "Not supported" or "Experimental" as the gates decide. Never upgrade a label without a passing test |

A failed no-go is a result, and it is recorded as one. The spike does not finish until every decision above has a recorded outcome.

## 11. Deliverables and sequence

1. **Approval** of §12 items (no execution before this).
2. **WS-F** harness and known-answer test (sandbox, if approved).
3. **WS-A** test page with the three orb variants, run on the desktop first, then on the reference phone.
4. **WS-B** capture, VAD, playback and barge-in on the desktop, using headset and speakers.
5. **WS-D** Tauri shell on Windows, then on Zorin, in the order D1, D2, D3, D4, D5, D6.
6. **WS-E** Capacitor shell on the reference phone, E2 variants first.
7. **WS-C** only after its dependencies (§8) are met.
8. **Results** in docs/spikes/F1-results.md (created by the spike): a table per criterion ID with pass, fail or not measured; the device and version record; the go and no-go outcome per decision; and a list of anything not verified.
9. **ADR** updates in OPEN_DECISIONS.md for D-19, D-24, D-25, and the language labels.

Relative effort is not estimated here. It depends on device access, and I will estimate once §8 is answered.

## 12. Approvals requested before the spike runs

| # | Item | My recommendation |
|---|---|---|
| 1 | Confirm the §6 targets as written, or change them | Confirm; each is proposed and locked in the ADR after results |
| 2 | Hardware: reference Android phone, Zorin PC and exact release, Windows PC | Provide the details in §4.1 |
| 3 | Toolchain installs on your machines, run by you (Rust, Tauri CLI, Android SDK, Gradle, Playwright browsers) | Approve the list; I will give you exact commands for review. I will not run remote installers in the sandbox |
| 4 | Where spike code lives: `spikes/` on this branch, or outside the repository | `spikes/` on this branch, marked throwaway |
| 5 | Headset-first barge-in rule, if A-5 fails | Approve the rule in advance, so it does not block the spike |
| 6 | Native raters (D-06), written consent for their audio, and whether any consent covers retention | Provide raters or a recruitment plan before WS-C |
| 7 | Provider shortlist and trial budget (D-05). Note that sending audio to a third party needs terms and DPA review first | Approve the shortlist in §5 WS-C; no provider calls before terms review |
| 8 | Release thresholds (D-17), signed off or replaced | Sign off the eval plan §7 values, or give replacements, before WS-C |
| 9 | CI option for builds the sandbox cannot run (GitHub Actions, runner cost, secrets) | Optional. Decide whether you want CI for Tauri and Android builds |
| 10 | Confirm the other approvals I did not see explicitly in your message: D-21 (320 px floor, 360–390 px design target); D-22 (male-presenting voices only within tested bounds); D-27 (`motion` for UI transitions); D-28 (Storybook optional, decided in F2); D-29 (self-hosted OFL fonts and one open-licence icon set); and the other libraries in frontend plan §1 (TanStack Router and Query, XState, Zod, React Aria Components, Tailwind CSS 4) | Confirm each one |
| 11 | Start the spike (WS-F first, then WS-A and WS-B) after items 1–4 are answered | Yes, once the answers are in |

Still open and not needed for F1: D-01, D-07, D-09, D-14, D-10, D-20. These gate later phases (user scope, persona, age, crisis resources, memory sync, and Pidgin and Yoruba ambition), and they remain required before any user other than you.
