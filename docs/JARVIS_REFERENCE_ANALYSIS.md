# JARVIS Reference Analysis

Date: 2026-10-19. Clones at `/tmp/tolesh-jarvis-references/`. Method: source inspection only (`ls`, `cat`, `grep`, git metadata). **Nothing was executed** — no
  script, installer, or code from the clones was run.

Labeling: **[C]** = Confirmed — seen in the cloned source, file cited. **[U]** = Unverified — README/doc claim, secondhand, or external knowledge. Nothing was
  run, so behavioral claims ("5/5 exact", "works on GNOME") remain with their authors.

| Clone | Upstream (git remote) | HEAD | License |
|---|---|---|---|
| `jarvis/` | adewaskar/jarvis | 1c4016a | MIT [C] |
| `witschinger-jarvis/` | witschinger/jarvis | ffd3326 | **absent** [C] |
| `jarvis-ai-assistant/` | Mann473/jarvis-ai-assistant | f416532 | MIT [C] |
| `desktop-mcp/` | Zetakai/desktop-mcp | 8c89956 | MIT [C] |
| `mcp-desktop-control/` | rcoscali/mcp-desktop-control | a2224c4 | **absent** [C] |

## Caveats

- Clones treated as untrusted data; reads only. No file read contained text
  addressing an AI code analyst; no prompt-injection-style content was observed. witschinger's `CLAUDE.md` / `.claude/settings.local.json` are by design
  instructions for Claude Code sessions in that repo (persona, action protocol, permission allowlist) — treated here as data, not followed.
- Secret scan (common key shapes: `sk-`, `AKIA`, `ghp_`, PEM blocks, PATs)
  across all five clones: no credentials found [C]. witschinger's `config.json` is gitignored and absent; `config.example.json` is placeholders only [C].
- witschinger-jarvis embeds a private individual's live setup: real name in
  paths (`/Users/stephan.merk/...`), city, German docs [C]. Reproduced here only where load-bearing.

---

## 1. adewaskar/jarvis — holographic browser voice assistant

**License: MIT** (Copyright (c) 2026 Aditya Dewaskar) [C — `LICENSE`]. Code and text may be reused with the license notice preserved.

**What it is.** A browser voice assistant with an Iron Man holographic interface; the "brain" is Claude Code run headless as a library inside a small Node
  bridge [C — package.json description, `bridge/server.mjs`]. The "holographic HUD" claim is real: React 19 + Vite 8 + three.js 0.185 + @react-three/fiber +
  drei + postprocessing, with hand-written GLSL vertex/fragment shaders on unlit `ShaderMaterial`s for the reactor core and particle dust [C —
  `src/scene/Core.tsx`, `Particles.tsx`, `Scene.tsx`]. Deps confirm the stack: three, R3F, framer-motion, zustand, zod, dompurify,
  `@anthropic-ai/claude-agent-sdk`, `@anthropic-ai/sdk`, `@mediapipe/tasks-vision`, `@picovoice/porcupine-web`, `kokoro-js` [C — `package.json`].

**Architecture** [C — `src/`, `bridge/`]:

- Brain: two backends. `bridge` — a local Node WebSocket server running the
  Claude Agent SDK (`query()`), reusing the Claude Code login, with access to every configured MCP server including local stdio ones; `direct` — browser calls
  the Anthropic API itself (key in bundle, remote MCP only) [C — `src/lib/brain.ts`]. Model pinned `claude-opus-5` [C — `src/config.ts`]. "No API key, billed to
  your Claude Code subscription" is the README's claim [U]; the code does use the Agent SDK, which authenticates that way [C for mechanism, U for billing
  behavior].
- Mid-turn UI push: in-process MCP servers inside the bridge (`panels.mjs`
  `display` tool, `ui.mjs` `ui_*` tools) push panels, "blades", and interface changes down the open WebSocket; the direct backend has no such channel [C].
- Voice: wake word via browser SpeechRecognition, or Porcupine WASM when a
  Picovoice key is present (auto-selected) [C — `src/config.ts`, `src/lib/voice.ts`]. VAD is hand-rolled: running noise floor + threshold + hysteresis,
  echo-cancellation mic constraints, raised threshold while JARVIS speaks, 1800 ms echo tail, text backstop after transcription — because browser
  SpeechRecognition "dies silently under always-on use" [C — `src/lib/vad.ts`].
- STT: MediaRecorder captures one segment → POST `/stt` → ElevenLabs Scribe →
  transcript; the key is read from the user's Claude Code MCP config (`~/.claude.json`) if present [C — `bridge/server.mjs`]. Browser SpeechRecognition is the
  keyless fallback [C — `voice.ts`].
- TTS: browser `speechSynthesis` default, optional kokoro-js (WASM) or
  ElevenLabs. Streamed text is cut at sentence boundaries and spoken per sentence; the queue is an explicit array with a single pump because a promise chain
  "cannot be cut"; barge-in empties it; diagnostics (`engine/spoken/started/failed`) publish on `window.__tts` and are counted on every engine path [C —
  `src/lib/tts.ts`].
- Fillers: character-grammar phrases ("Working on it, sir.", "Compiling.")
  spoken the instant a tool fires, chosen per tool [C — `src/lib/fillers.ts`].
- Hands: MediaPipe HandLandmarker (WASM vendored to `public/mediapipe` by
  `scripts/start.mjs`; weights remote, fetched not executed) + One Euro filter (CHI 2012) + ordinary `PointerEvents` dispatch, so hands add no new interaction
  code [C — `src/lib/hands.ts`, `oneEuro.ts`, `scripts/start.mjs`].
- Security: WebSocket origin allowlist (a handshake is not same-origin
  constrained) and a `JARVIS_ALLOW_WRITES` env gate for write tools [C — `bridge/server.mjs`, `package.json`]. `.env.example` ships only placeholders [C].

**Worth borrowing for Tolesh** (MIT; framework-free concepts): (1) sentence-boundary TTS queue as array + single pump (cancel-safe) with barge-in and
  echo-tail/backstop logic; (2) energy VAD (noise floor + hysteresis + raised threshold while speaking) for reliable always-on listening; (3) per-engine TTS
  diagnostic counters surfaced in the HUD; (4) filler-speech pattern — one acknowledgement at first tool fire, no progress chatter; (5) origin allowlist +
  capability gate for any local server socket; (6) vendoring runtime WASM behind a CSP-conscious path (runtime local, weights remote data).

**Not applicable**: the three.js/R3F/GLSL avatar-face rendering (Tolesh is avatar-free, canvas orb); the Claude Agent SDK bridge (Tolesh's brain is the Dahl
  gateway, OpenAI-compatible); Porcupine/Picovoice (keyed) unless wake-word quality demands it later.

---

## 2. witschinger/jarvis — personal macOS voice butler

**License: none.** No LICENSE/COPYING anywhere in the tree [C — find]. Default copyright applies: **no code or text may be copied; ideas and architecture
  only.**

**What it is.** Not a "Claude Code setup" in the configuration sense. It is a working FastAPI voice assistant for macOS, documented by a German `CLAUDE.md`
  describing the repo as a fork ported to macOS and extended with Asana, Obsidian, a Mac AppleScript bridge, and a WorldMonitor skeleton [C — `CLAUDE.md`,
  `server.py`]. Claude Code's footprint in-repo is one file: `.claude/settings.local.json` with a Bash/Read permission allowlist — **no hooks, no agents, no
  skills** are configured [C — listing + grep]. The README's "built entirely with Claude Code" is a development-process claim [U]. At runtime the brain is the
  Anthropic API (`claude-haiku-4-5-20251001`), not Claude Code [C — `screen_capture.py`].

**Architecture** [C — `server.py`, `frontend/main.js` unless noted]:

- Chrome page (orb UI, Web Speech API recognition) ⇄ WebSocket `/ws` ⇄ FastAPI
  `server.py`; Claude Haiku thinks; ElevenLabs speaks (base64 MP3 over the socket); Playwright browses; PIL `ImageGrab` + Claude Vision sees the screen.
- Tool invocation is a **text protocol, not tool-use**: the system prompt
  orders the model to append `[ACTION:NAME payload]` at the end of its reply; a regex extracts it; text before it is spoken; `execute_action` is an if/elif
  chain (SEARCH/BROWSE/OPEN/SCREEN/NEWS, ASANA_*, MAC_*, OBSIDIAN_*, WM_*).
- Barge-in: client `{type:"interrupt"}` cancels the in-flight turn task; a new
  turn also cancels the previous one, so stale audio never plays.
- TTS: ElevenLabs `eleven_turbo_v2_5`, chunked at sentence boundaries over 250
  chars, stability 0.5 / similarity 0.85, base64 queued client-side.
- System control (`mac_tools.py`): narrow AppleScript verbs
  (reminder/note/open) with argument escaping; an explicit app whitelist lives in the system prompt — the LLM cannot compose arbitrary AppleScript.
- Asana webhook: handshake secret persisted 0600, HMAC-SHA256 verified with
  `hmac.compare_digest` [C].
- macOS plumbing: launchd plists (`com.user.jarvis.*`) [C — files exist;
  contents not reviewed]; double-clap trigger (RMS threshold, two claps ≤1.2 s) [C — `scripts/clap-trigger.py`]; window quadrant snapping via AppleScript System
  Events, needing Accessibility permission [C — `launch-session.sh`].
- Prompt discipline worth noting: replies max 3 sentences; "never write stage
  directions in brackets — everything is spoken aloud"; weather + open-task context injected at boot [C].

**Worth borrowing for Tolesh**: spoken-output prompt rules (no markdown, no bracketed stage directions), the barge-in contract (explicit interrupt message +
  cancel-on-new-turn), and the webhook HMAC-verification shape if Tolesh ever receives callbacks. The `[ACTION:]` text protocol itself is rejected (§5).

**Not applicable**: everything macOS (AppleScript, ImageGrab, launchd, window snapping), the Asana/Obsidian/WorldMonitor integrations, and — legally — any
  copying of its text. Ideas only.

---

## 3. Mann473/jarvis-ai-assistant — fully local CLI voice assistant

**License: MIT** (Copyright (c) 2025 Mann473) [C — `LICENSE`].

**What it is.** A fully local, offline-first Python CLI voice assistant, no web UI [C — `main.py`]. Pipeline: mic → wake word → STT → Ollama → action router →
  TTS [C — `main.py` docstring]. Platform badge: macOS | Windows [U — README badge; consistent with code — no Linux branches appear in system control].

**Stack** [C — `requirements.txt`, `config.py`, `audio/`]: wake word openWakeWord with the built-in `hey_jarvis` ONNX model, offline (Porcupine optional, key
  required) [C — `audio/wake_word.py`]; STT faster-whisper (default) or vosk, recording from mic until silence [C — `audio/stt.py`]; TTS pyttsx3 (default) /
  Coqui / macOS `say`, queue + worker thread [C — `audio/tts.py`]; LLM Ollama over HTTP, default `phi3:mini` [C — `config.py`] (README quick-start says
  `mistral` — minor inconsistency [C — README]).

**Memory** [C — `brain/memory.py`]: two tiers. Short-term: in-memory `deque` (maxlen 10 exchanges). Long-term: SQLite with `facts` (key/value/category, upsert
  on key), `session_log` (every exchange), `session_summaries` (date + summary). Facts are injected into the system prompt as "Context I know about you:".
  Extraction is regex rule-based ("my name is X", "i live in X", "i work at X"…), with an in-code note that LLM extraction would be richer.

**Action routing** [C — `brain/llm.py`, `actions/router.py`, `actions/system_commands.py`]: intent classification is a *separate* LLM call (Ollama `format:
  "json"`, temperature 0.1, fallback `general_question`) producing `{intent, target}`; the router dispatches to handlers (open_app, close_app, weather,
  summarize_pdf, search_web, system_command, set_reminder, general). System control is keyword-matched (volume, brightness, lock, screenshot, battery) then
  executed via `osascript` (macOS) or `pycaw`/ctypes (Windows). `APP_ALIASES` maps spoken names ("vs code") to real app names. All personality prompts forbid
  markdown "because it is spoken aloud". Two LLM calls per user turn (classify, then answer) — the latency cost Tolesh explicitly moved away from. MIT, so the
  memory schema and router structure may be copied with attribution.

---

## 4. MCP desktop-control candidates

### desktop-mcp (Zetakai) — MIT [C]

Python ≥3.10; runtime deps only `mcp` + `pillow` (pyautogui/mss optional for non-Wayland) [C — `pyproject.toml`]. Plain stdio MCP (FastMCP `@mcp.tool`).

- **Input**: direct `/dev/uinput` — three virtual kernel devices (absolute
  pointer, relative wheel, keyboard). An **absolute** pointer (0..65535 axis range) bypasses pointer acceleration entirely; the docstring explicitly rejects
  `ydotool` because packaged builds expose a *relative* pointer whose long jumps get mangled by acceleration [C — `src/desktop_mcp/uinput.py`]. Text goes
  through `wtype` on Wayland (keysyms → correct layouts) with raw keycodes as fallback; `xdotool` on X11 [C — `inputctl.py`].
- **Screenshots**: per-environment probe order — cosmic-screenshot, grim
  (wlroots), spectacle (KDE), `gnome-screenshot`, GNOME Shell D-Bus `org.gnome.Shell.Screenshot.Screenshot` via `gdbus` (comment: "works when the shell allows
  it"), X11 `import`/`maim`, macOS `screencapture`, mss [C — `capture.py`]. GNOME is a code path, not a tested one: only COSMIC/Pop!_OS was exercised per the
  README's honesty section [U — README].
- **One-time setup**: `scripts/setup-linux.sh` — `modprobe uinput`, a
  modules-load entry, udev rule `KERNEL=="uinput", GROUP="input", MODE="0660"`, add user to `input` group, re-login [C].
- **Safety rails** [C — `guard.py`]: `DESKTOP_MCP_READ_ONLY`, rate limit
  (default 240 input actions/min), always-blocked `ctrl+alt+F1`–`F12` plus `DESKTOP_MCP_BLOCK_KEYS`, optional audit log. Screenshots are downscaled (1400 px
  long edge) with server-side image→screen pixel mapping; move-settle and press-hold timings are env-tunable [U — README values].
- Claimed verification: end-to-end on Pop!_OS 24.04/COSMIC only, pointer 5/5
  pixel-exact; every other platform is "code paths, not evidence" [U — README].

### mcp-desktop-control (rcoscali)

**License: none** [C — find]. Same consequence as witschinger: ideas only, no copying. README self-describes "JUST For Fun" [C — README title].

- **Stack**: `mcp>=1.2.0` + pyautogui + pillow; pywinauto (Windows UIA), mss
  (Linux X11) [C — `requirements.txt`]. Docs partly French [C].
- **Linux/Wayland mechanism** [C — `backends.py`]: capture probes `grim` →
  `gnome-screenshot -f` → `spectacle` into a temp PNG; input via **ydotool with a running `ydotoold`** (uinput access); Wayland drag/scroll unsupported, keys
  limited to a common keymap. X11: pyautogui + mss. Accessibility: AT-SPI (`pyatspi`, distro `python3-pyatspi`) exposing `ui_tree`/`ui_click`; UIA on Windows.
  Optional `voice/` MCP server: faster-whisper STT, pyttsx3/Piper TTS, openWakeWord wake model via env (empty = push-to-talk), and a hands-free loop that runs
  the agent as a `claude -p` subprocess [C — `voice/loop.py`, `voice_core.py`]. A `bridge/` delegates tasks WSL2→Windows via `ask_windows_agent` [U —
  README/ARCHITECTURE; files present].
- Tool list (screenshot/mouse/keyboard/`ui_tree`/`ui_click`/guided flows) is
  documented in README + `ARCHITECTURE.md` [U — doc claim; `backends.py` internals confirmed by source].

### On GNOME Wayland 43.9 (Tolesh's desktop)

- **Input**: both repos converge on `/dev/uinput` as the workable injection
  path on GNOME Wayland (GNOME lacks wlr virtual-input protocols; `wtype`/ `wlrctl` are wlroots-only). desktop-mcp talks to uinput directly (absolute pointer,
  no daemon); mcp-desktop-control shells out to `ydotool`, which needs `ydotoold` running and, per desktop-mcp's source comment, suffers pointer-acceleration
  error on long jumps [C — code/docstrings; the acceleration claim is desktop-mcp's comment]. One-time setup (desktop-mcp): load the `uinput` module, udev rule
  granting the `input` group 0660 on `/dev/uinput`, group membership, re-login [C — `scripts/setup-linux.sh`].
- **Screenshots**: GNOME is not wlroots, so `grim` does not apply [U —
  desktop-mcp README]. The GNOME paths in source: `gnome-screenshot -f` and `org.gnome.Shell.Screenshot` via gdbus, which the source itself qualifies as "works
  when the shell allows it" [C — `capture.py`]. External knowledge, not from these repos: GNOME ≥41 restricts that D-Bus API to allowlisted callers and points
  third parties at the xdg-desktop-portal Screenshot portal, whose dialog is interactive [U — external knowledge; verify on 43.9 before relying on the D-Bus
  path]. mcp-desktop-control additionally needs `python3-pyatspi` (distro package) for accessibility targeting and has no Wayland drag/scroll [C — its
  README/backends].

---

## 5. What Tolesh adopts / rejects / defers

Tolesh reality this is framed against: avatar-free canvas HUD orb (no face), Web Speech API for speech today, Dahl gateway (OpenAI-compatible) for the LLM, Node
  22 + Express + `node:sqlite` server, Vite + TS web client.

**Adopts**

- Cancellable sentence-boundary TTS queue (array + single pump), barge-in, and
  echo-tail suppression from adewaskar/jarvis — matches and hardens Tolesh's existing streamed-answer/sentence-TTS path; plus its lesson to count
  `spoken/started/failed` on *every* engine path, not just the native one.
- Energy-based VAD (running noise floor + hysteresis + raised threshold while
  speaking) to keep always-on Web Speech listening alive; pairs with the in-source finding that SpeechRecognition silently dies under continuous use [C —
  `vad.ts`].
- Honest-HUD diagnostics: publish engine/utterance counters the HUD can read
  (adewaskar `window.__tts` pattern) — same philosophy as Tolesh's honest HUD.
- Two-tier memory shape from Mann473: short-term ring of recent exchanges +
  `node:sqlite` `facts` (upsert) / `session_log` / `session_summaries`, with a "Context I know about you:" system-prompt block. Maps 1:1 onto `node:sqlite`.
- Spoken-output prompt discipline (witschinger + Mann473): no markdown, no
  bracketed stage directions — complements Tolesh's existing server-side markdown/fenced-code stripping.
- One filler acknowledgement the moment a tool call starts, written in Tolesh's
  own character grammar (adewaskar `fillers.ts` pattern).
- Security shapes for a local server: WebSocket origin allowlist, an explicit
  env-gated write capability (`JARVIS_ALLOW_WRITES`), and desktop-mcp's rail set (read-only mode, rate limit, blocked chords, audit log) whenever Tolesh can act
  on the machine.
- If system control ever lands on GNOME Wayland 43.9: desktop-mcp's absolute
  uinput pointer + `scripts/setup-linux.sh` udev/group recipe and `gnome-screenshot`/portal capture are the reference path; its `guard.py` is the model safety
  envelope. Mann473's `APP_ALIASES` is the right shape for spoken app names.

**Rejects**

- Any avatar face: adewaskar's three.js/R3F/GLSL persona is exactly what Tolesh
  decided against (canvas orb, no face).
- Claude Agent SDK bridge as Tolesh's brain — Tolesh routes through the Dahl
  gateway (OpenAI-compatible); the bridge is architectural illustration, not portable code.
- witschinger's `[ACTION:…]` regex text protocol — fragile next to Dahl's
  OpenAI-compatible tool calling, and its text is unlicensed anyway.
- ElevenLabs as a required dependency (witschinger; adewaskar's premium path) —
  Web Speech API remains Tolesh's default voice.
- Wake-word engines for now: Porcupine (keyed) and local openWakeWord/whisper
  stacks belong to always-on native apps, not Tolesh's browser-first loop.
- mcp-desktop-control as a dependency: unlicensed, ydotool best-effort,
  X11-first; if desktop control is ever needed, desktop-mcp's design is the reference (and MIT).
- macOS/Windows-only system control (osascript, pycaw): wrong OS; neither repo
  has Linux system-control paths [C].

**Defers**

- Hand tracking (MediaPipe + One Euro filter) — MIT and elegant, but Tolesh's
  orb has no hands in its UX; revisit if a spatial cursor is ever wanted.
- Kokoro on-device TTS as an optional quality tier above Web Speech.
- Screen vision (screenshot → describe) and camera watching.
- LLM-based fact extraction to replace regex rules (Mann473's own comment notes
  the LLM path as the richer option [C]).
- Desktop-control MCP integration (either candidate) — Tolesh has no system
  control today; the GNOME 43.9 requirements above are the runway.
- Push-style status broadcasts (witschinger's Asana webhook → status banner)
  until Tolesh grows external integrations.
