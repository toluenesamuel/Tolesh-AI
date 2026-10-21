# Tolesh — Feature Audit

Date: 2026-10-19 (overnight session 2). Branch: `genspark_ai_developer`.

Classification per mission addendum: **implemented+verified** (automated or
real-browser evidence in this session), **implemented+unverified** (code
shipped, evidence missing), **partial**, **missing**, **blocked**.
Evidence citations name the exact suite/command that was run. Nothing here is
claimed without the run that proves it — see "Fresh verification evidence".

## Request P status (2026-10-19, Arena branch `arena/fae714f3-tolesh-ai`)

Classes: **verified** (automated or browser run in this request), **partial**,
**unverified** (code exists, the check that matters has not run), **blocked** (needs
something not available here), **not done**. The GenSpark sections below are kept as
the earlier record.

| Feature | Class | Evidence / what is missing |
|---|---|---|
| Reasoning never shown, stored or spoken | verified (scripted provider) | Browser `ui-scenarios` 14/14; server tests. Not measured on a real model (no key) |
| Stored reply equals displayed reply | verified | Browser `ui-scenarios` (history check) |
| Stream interruption shows an honest error, keeps partial text, returns to idle | verified | Browser `ui-scenarios`; `chat-route` and `reliability` tests (stream breaks give a terminal `error` event) |
| Truncated answer shows a visible cut-off note | verified | Browser `ui-scenarios`; `api.chatstream` tests |
| Client disconnect aborts the upstream call | verified | `abort-wiring.test.js` (3 tests, from GenSpark `4d5a1ce`) |
| Retries bounded; no retry on abort; a 401 is never retried | verified | `reliability.test.js` (27 tests) |
| Streamed text equals whole-reply text (literal `<`, partial tags) | verified | `final-answer.test.js`; the new tests fail on the previous code |
| Speech text matches the displayed text (words, order) | verified (text path) | `display-speech-parity.test.ts`: 40 random stream splits; `speech-behaviour.test.ts` |
| Speech **audio** plays the same words | **unverified** | No speech engine in headless Chromium. Needs a browser with speech, or a real device |
| Voice recognition (speech in) | **unverified** | Same reason. Language setting unchanged |
| Current date and time reach the model | verified | Browser `ui-scenarios` (the request carries 2026-10-19, Africa/Lagos) |
| Context retention: last 40 messages, 24,000 chars, omission note | verified (limits); **unverified** (model uses them) | Direct `buildModelMessages` check. Whether answers use the context needs a live run |
| Natural Nigerian Pidgin by default | **not done** | Default is `mirror` (decision D-P1). `pidgin` is opt-in. Native-speaker review not done (D-P2) |
| Provider evaluation (Dahl, other models) | **blocked** | No provider key. `server/eval/run.mjs` exits 2 (BLOCKED). Only the Dahl adapter exists |
| Output validation | partial | Final-answer path, truncation and empty-answer checks. No schema validation beyond these |
| Tool reliability | **not done** | The app has no tool calls to test |
| Settings, onboarding, conversation export | verified | `verify-settings.mjs` 8/8 (ported from GenSpark, portable paths); `settings.test.ts` |
| Auto-reconnect after server outage | verified | `verify-reconnect.mjs` 2/2; `reconnect.test.ts` |
| JARVIS HUD refinement, avatar-free | **not done** | Not started in this request. Existing HUD unchanged |
| Cloud avatar | prototype | `spikes/cloud-avatar/`: not integrated, unchanged here |
| Spec Miner skill (`Jeffallan/claude-skills`, MIT) | partial | Files and frontmatter checked. Activation in Claude Code **unverified** |
| 19 UI and animation skills | partial | Links resolve to `SKILL.md` (file level). Activation **unverified** |
| Desktop control (Linux) | **not done** | Not installed. Needs approval (D-P5) |
| Public APIs | **not done** | None chosen; needs a named use case (D-P8) |
| Overhead of Tolesh itself (fake provider, 300 ms) | verified (benchmark) | First byte p50 7 ms; full-reply overhead p50 20 ms. No regression against `faa9e6c`. Model latency not measured |
| Full project check (`scripts/verify.sh`) | verified | Server 84/84, smoke, web 86/86, build, browser 14/14 (with `CHROME_PATH`) |

## Fresh verification evidence (2026-10-19 ~03:10)

| Suite | Command | Result |
|---|---|---|
| Server (node:test) | `cd server && npm test` | **45/45 pass** |
| Web units (vitest) | `cd web && npx vitest run` | **64/64 pass, 8 files** (includes new settings.test.ts 13 + speech rate test) |
| Web typecheck | `npx tsc --noEmit` | clean (exit 0) |
| Web production build | `npm run build` | exit 0 (24.80 kB JS, gzip 9.03 kB) |
| Browser E2E (HUD/voice/history) | `node web/e2e/verify-ui.mjs` | **9/9** (re-run this session) |
| Browser E2E (settings/onboarding/export) | `node web/e2e/verify-settings.mjs` | **8/8 pass** (written + run this session) |
| Browser E2E (auto-reconnect) | `node web/e2e/verify-reconnect.mjs` | **2/2 pass** (offline pill at boot, auto-recovery without reload) |

## 1. Core pipeline (highest-priority mission section)

| Feature | Status | Evidence |
|---|---|---|
| Internal reasoning never displayed or spoken — stripped **at source** (server) in both JSON and SSE paths | implemented+verified | `server/test/final-answer.test.js`, `providers.test.js` (within 45/45); `web/src/spoken.test.ts` guards the client side |
| No naive word-deletion / no CSS filtering of reasoning | implemented+verified | final-answer tests pin reasoning-channel + `<think>` handling at the message level, not string surgery on visible text |
| Streaming answers (SSE) with progressive bubbles | implemented+verified | `web/src/sse.test.ts` 6/6, `web/tests/api.test.ts` 5/5; e2e 9/9 |
| Sentence-by-sentence TTS from the stream (first sentence speaks early) | implemented+verified | `web/src/speech-queue.test.ts` 9 tests |
| No overlapping/duplicate speech (one utterance at a time, queue) | implemented+verified | speech-queue tests ("enqueued text mid-utterance is queued, not spoken over", "cancel() stops speech") |
| Interruption: Stop button, Escape, mic barge-in, typed message during speech | implemented+verified | e2e 9/9 (previous session, real Chrome); unit: cancel tests |
| Client disconnect aborts upstream provider call (no orphan generation) | implemented+verified | `server/test/abort-wiring.test.js` 3/3 (commit `4d5a1ce`) |
| Fenced code blocks never spoken | implemented+verified | spoken.test.ts (11) + speech-queue integration test (RED→GREEN this session, commit `0453a14`) |
| Markdown markers never spoken (transcript keeps raw markdown) | implemented+verified | same RED→GREEN run |
| No UI freeze during generation | implemented+verified (browser E2E covers the loop; streaming is async by construction) | e2e 9/9 |

## 2. HUD / interface

| Feature | Status | Evidence |
|---|---|---|
| Circular HUD orb, no avatar/mascot | implemented+verified | e2e 9/9 (canvas renders, non-graphical fallback tested in hud.test.ts) |
| 6 states: idle/listening/processing/speaking/interrupted/error | implemented+verified | hud.test.ts 2/2 + e2e idle/text-loop checks (interrupted = toIdle on cancel paths) |
| Audio-reactive visuals from real signals | implemented+verified | mic RMS analyser (listening), onboundary progress (speaking); honest HUD tests |
| Reduced-motion equivalent + no-canvas degradation | implemented+verified | hud.test.ts, styles.css media query |
| Persona (male-presenting, warm, Nigerian English/Pidgin/Yoruba mirroring, no claimed emotions) | implemented+verified (prompt-level) | `server/test/persona.test.js` 2/2 pins SYSTEM_PROMPT rules; live-model tone **blocked** (no key) |

## 3. Voice loop

| Feature | Status | Evidence |
|---|---|---|
| Push-to-talk recognition (Chromium), interim partials, text fallback | implemented+verified (unit + e2e shell); real-mic behavior untested in sandbox | voice.ts; footnote states limits honestly |
| Sentence-queue TTS, HUD level from real boundary events | implemented+verified | speech-queue tests |
| Reasoning/code/markdown never spoken | implemented+verified | spoken.test.ts + speech-queue integration tests (this session) |
| Settings: speech on/off, speech rate, hands-free | implemented+verified | `web/src/settings.test.ts` 13/13 unit; UI wired in main.ts; browser: `verify-settings.mjs` 8/8 (persistence, readout, reload) |
| Hands-free loop (auto re-listen after reply) | implemented+unverified (loop) | `shouldResumeListening` decision unit-tested (3 cases); setting persists (e2e 8/8); full spoken-reply→re-listen cycle needs a real mic/synth — not reachable in headless run |
| Continuous/ambient listening (wake word) | missing | Web Speech is push-to-talk; not full duplex — documented honestly in UI footnote |
| Server-side ASR/TTS | blocked (no provider decision/keys) | report §Blockers |

## 4. Memory & privacy

| Feature | Status | Evidence |
|---|---|---|
| Conversation persistence (SQLite), list/read | implemented+verified | store tests 5/5; chat-route tests |
| User-controlled deletion (API + UI with two-step confirm) | implemented+verified | DELETE route tests; e2e history delete |
| Nothing learned silently (no hidden memory writes) | implemented+verified | store only persists explicit chat turns; no other writes |
| Long-term memory beyond conversations (facts/preferences) | missing (spec exists: `MEMORY_AND_PERSONALIZATION_SPEC.md`) | — |
| Conversation export (recovery/privacy) | implemented+verified | main.ts exportConversation → JSON download; `verify-settings.mjs` "export downloads parseable conversation JSON" |
| Keys/credentials never reach the browser | implemented+verified | providers hold env keys server-side; cors localhost-only; e2e + smoke verify honest no_key path |

## 5. Everyday-assistant additions (this session)

| Feature | Status |
|---|---|
| Settings panel (voice toggle, rate, hands-free) persisted locally, storage-block safe | implemented+verified — 13/13 unit + e2e 8/8 (persistence across reload) |
| First-run onboarding explainer | implemented+verified — e2e 8/8 (shows first run, dismissed, never re-shown) |
| Conversation export (JSON download) | implemented+verified — e2e 8/8 (download parses, correct id/title/messages) |
| Server reconnect/recovery UX | implemented+verified | `web/src/reconnect.test.ts` 3/3 unit (backoff/give-up); `verify-reconnect.mjs` 2/2 real browser (offline pill → auto-recovery, no reload) |

## 6. Security posture

| Item | Status | Evidence |
|---|---|---|
| Provider keys server-side only; never printed/committed | implemented+verified | providers.js reads env; no key material in repo (git grep clean in prior session); .env git-ignored |
| Localhost-only binding + CORS allow-list | implemented+verified | index.js `HOST=127.0.0.1` default, origin regex |
| Rate limiting (per-IP) + 8k char cap + 256kb body cap | implemented+verified | chat-route tests |
| Client aborts cancel upstream (token/cost hygiene) | implemented+verified | abort-wiring tests 3/3 |
| Reasoning never in pipeline (filter at source) | implemented+verified | providers readStream/readCompletion + tests |
| Speech never reads code fences / markers | implemented+verified | this session, commit `0453a14` |
| No secrets printed in logs/reports | implemented+verified | audit practice all session; error paths emit kinds, not values |

## 7. Blocked / not possible tonight

| Item | Blocker | Evidence |
|---|---|---|
| Live Dahl model replies | `DAHL_API_KEY` revoked/absent — user must add a fresh key to `server/.env`; never paste into chat | prior session verified the revoke (401s) |
| Real-device testing (Android/Windows) | no devices reachable from this sandbox | — |
| Desktop-control MCP validation | GNOME Wayland 43.9: `org.gnome.Shell.Screenshot` DBus → AccessDenied; `/dev/uinput` root-only; portal screenshot requires an interactive approval dialog, which the mission forbids auto-accepting. Both candidate MCPs (desktop-mcp: MIT, uinput/GNOME-DBus backends; mcp-desktop-control: **no license**, ydotool) require exactly those denied primitives. Installing one would ship a tool that cannot pass its own harmless acceptance test (screenshot → click → type). | evidence in session log; repos in /tmp/tolesh-jarvis-references |
| Live e2e with real model | same key block | — |

## 8. Production readiness (localhost MVP scope)

Done: localhost binding, CORS allow-list, body caps, per-IP rate limit, timeout/retry, honest errors, graceful shutdown (SIGINT/SIGTERM), dependency audit 0 vulns, tests + build green, graceful no-canvas/no-speech/no-storage degradation.
Deliberately out of scope for a localhost personal app: TLS/reverse proxy, multi-user auth, horizontal scaling. Documented as open decisions, not silently skipped.
