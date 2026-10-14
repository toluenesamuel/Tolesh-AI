# Tolesh Frontend Implementation Plan

Status: **planning only. No frontend code has been written, and implementation is not approved.**
Date: 2026-10-14. Scope: web, Windows, Linux/Zorin OS, Android.
Depends on: MASTER_IMPLEMENTATION_PLAN.md, ARCHITECTURE_PLAN.md, DEVELOPMENT_ROADMAP.md, OPEN_DECISIONS.md, docs/PERSONALITY_AND_EMOTION_SPEC.md, docs/MEMORY_AND_PERSONALIZATION_SPEC.md, SECURITY_AND_PRIVACY_PLAN.md.

Package versions below were read from the npm registry on 2026-10-14. They are **not installed** and must be re-checked and pinned in the ADR.

---

## 0. Project review (Task 1)

### 0.1 What can be decided now from existing requirements

These follow directly from the requirements already in the repository. They need no new approval beyond accepting this plan.

| # | Decision | Basis |
|---|---|---|
| R-1 | Accessibility target is **WCAG 2.2 AA**. The existing documents require 2.1 AA (ARCHITECTURE_PLAN.md §10, AGENTS.md); 2.2 AA contains all 2.1 AA criteria, so targeting 2.2 meets the existing requirement. The baseline documents are not edited until you approve this. |
| R-2 | **Dark-first, with a light theme.** Both themes must pass the same contrast checks. | AGENTS.md design direction. |
| R-3 | The **orb is the hero**; everything else stays quiet. | AGENTS.md; ARCHITECTURE 3.10 (avatar and expression renderer). |
| R-4 | **Every state has a reduced-motion equivalent** and a non-colour cue. | AGENTS.md accessibility rules; ARCHITECTURE §10 (reduced-motion tests); MASTER §6. |
| R-5 | **No runtime calls to third-party CDNs** (fonts, analytics, CSS). Fonts are self-hosted. | SECURITY_AND_PRIVACY_PLAN §2 (minimum data to third parties). |
| R-6 | **Browser speech recognition (Web Speech API) is not the core voice path.** Voice goes through provider adapters. | Provider capability must be tested per language (ARCHITECTURE 3.6). Browsers differ in where they send audio. |
| R-7 | **No analytics SDK in the client.** Event-only logs. | ARCHITECTURE §9 (no SDK that exfiltrates transcripts). |
| R-8 | **No streaks, guilt notifications, or "I missed you" prompts.** | PERSONALITY §7.3. |
| R-9 | **Memory screen** supports view, edit, disable, delete, export, and a global pause. | MEMORY spec §4. |
| R-10 | **A Stop control is always reachable** while the mic, screen awareness or an action is active. | SECURITY §9 items 2 and 3. |
| R-11 | **Teasing and roasting are opt-in**, with intensity and topic controls and an absolute stop. The UI must make the current setting visible. | PERSONALITY §7. |
| R-12 | **No literal emotion claims in UI copy.** Affect is shown as design, never as an inner state. | PERSONALITY §6.1. |

### 0.2 Recommended, needs your approval

These are recommendations. Each is listed as a decision in OPEN_DECISIONS.md.

| Decision | Recommendation | Section |
|---|---|---|
| D-02 Frontend stack | React + TypeScript + Vite, as an installable PWA. D-02 requires a prototype and an ADR, so the final choice is confirmed in F1 | §1 |
| D-03 Platform approach | Option A: one UI codebase; thin desktop and Android shells | §8 |
| D-19 Orb and face | Abstract WebGL2 orb for v1; no face. D-19 requires a prototype, so this is confirmed by the F1 spike | §3.7 |
| D-21 Responsive baseline | 320 CSS px reflow floor; design around 360–390 px | §4.3 |
| D-22 Voice scope | Choose only among voices that pass tests; no cloning | §4.2 (S3) |
| D-23 Computer control | None until a security review; then a per-app allow-list | §10 (F9) |
| D-24 Desktop engine (new) | Tauri 2; Electron as fallback if the Zorin OS gate fails | §1, §8 |
| D-25 Android shell (new) | Capacitor for v1; Tauri 2 mobile as the alternative | §1, §8 |
| D-26 to D-29 (new) | WCAG 2.2 AA; `motion` for UI transitions; Storybook optional; self-hosted OFL fonts and one open-licence icon set | §6, §3.4, §1, §11 |

### 0.3 Unresolved, and affects the frontend

| Decision | Frontend impact | Blocks |
|---|---|---|
| D-01 Who uses Tolesh | Onboarding copy, legal notices, consent flows | Any user beyond the owner |
| D-04 Orchestrator placement | Transport (WebSocket vs HTTP) and offline behaviour. The client talks only to a typed event interface, so this is isolated | Phase F2 contract |
| D-05 Providers | Which voices and languages the UI may offer | Phase F4 |
| D-07 Persona details | Name, forms of address, default humour. UI copy depends on them | Phase F2 copy |
| D-09 Age policy | Onboarding age gate. Adults-only is recommended | Any user beyond the owner |
| D-10 Memory sync | Local-only storage (recommended) vs an encrypted sync layer | Phase F3 |
| D-14 Crisis resources | G0 screen cannot show phone numbers until a Nigerian source verifies them. Phase F2 shows only generic guidance | Phase F2 G0 copy |
| D-18 Telemetry | Event-only, local-first (recommended). No analytics UI yet | Phase F2 |

### 0.4 Inconsistencies found in the planning set

- The architecture said the stack was "deliberately not chosen" and gave no recommendation. This plan supplies one (§1), pending approval.
- The roadmap's Phase 1 lists "design system approved" but has no measurable criteria. Added in §10.
- The UI skill's stack data has no entries for voice or orb work (see docs/SKILL_VERIFICATION.md). Design choices for those areas come from our own specifications.
- ARCHITECTURE_PLAN.md §10 and AGENTS.md say WCAG 2.1 AA. This plan targets 2.2 AA, which is a superset. The baseline wording is left as is until you approve.

---

## 1. Recommended frontend technology (Task 2)

Tolesh is a **live, voice-first, always-available companion**. It needs real-time audio, GPU-driven visuals, careful focus and state handling, and one codebase that also runs in desktop and Android shells. A chatbot UI would not need any of that. The stack below is chosen for those needs.

| Area | Recommendation | Why | Rejected | Gate before commitment |
|---|---|---|---|---|
| Language | **TypeScript**, strict mode | Typed event contracts from the orchestrator; safe state machines | Plain JavaScript | None |
| Framework | **React 19** | Largest set of mature, accessible component primitives; every shell option wraps a static build; the team can hire for it | Svelte (fewer accessible primitives); Vue (equivalent, smaller primitive set for our needs); Angular (heavier for a single-page companion) | None |
| Build | **Vite 8**, SPA with a PWA manifest | Fast dev loop; static output for Tauri and Capacitor | **Next.js**: server rendering adds a second server to secure, and the real-time audio and WebGL work is client-only anyway | None |
| Routing | **TanStack Router** | Type-safe routes and search params, so settings deep links are checked at compile time | React Router (fine, less type safety) | None |
| Server state | **TanStack Query** for REST; realtime events go into the conversation machine | Caching, retries, and clear loading and error states | Hand-rolled fetch | None |
| Conversation state | **XState 5** state machine | The brief asks for an explicit state machine (AGENTS.md). XState makes states, transitions, interruption and guards testable and visualisable | Ad-hoc booleans or a generic store | None |
| Typed events | **Zod 4** schemas for every event from the orchestrator | Rejects malformed or unexpected events at the boundary | Trusting the wire format | None |
| UI primitives | **React Aria Components** (Adobe) | Keyboard, focus, ARIA and screen-reader behaviour is handled by a library that is widely tested. Matches WCAG 2.2 requirements | Radix (also good; similar); shadcn/ui copy-in (its default look is the generic SaaS style the brief rejects) | Visual review in F2 |
| Styling | **Tailwind CSS 4** with CSS custom-property tokens | Utility styling with one token source for dark and light themes | CSS-in-JS (runtime cost for a motion-heavy UI) | None |
| UI motion | **Motion** (`motion`, MIT) for layout and UI transitions; CSS for micro-interactions | Interruptible animations, layout transitions, and `prefers-reduced-motion` support | GSAP (not needed for v1; its skills stay conditional); Framer Motion (same library, older name) | None |
| Orb | **Custom WebGL2 fragment shader** on one canvas. Fallbacks: Canvas 2D, then static SVG | One full-screen shader is a few kilobytes and gives direct per-frame control of audio level and state. three.js or React Three Fiber would add large dependencies for one effect | three.js / R3F (heavy for one orb); Lottie or Rive (good for character animation; reconsider if a face is approved, see §3.7) | Phase F1 spike on reference devices |
| Voice capture | **getUserMedia + AudioWorklet** | Live input level, frame-accurate capture for the streaming ASR adapter, and no browser-vendor speech service | Web Speech API (see R-6) | Phase F4 spike |
| Voice activity | **@ricky0123/vad-web** (ISC, ONNX/WASM), to be evaluated | Client-side endpointing so silence is not streamed | Server-only VAD (adds latency and bandwidth) | Phase F4 evaluation |
| Voice playback | **Web Audio API** with a cancellable queue | Barge-in must stop speech immediately; an `<audio>` element cannot do this precisely | `<audio>` element | Phase F4 |
| Icons | One open-licence SVG set (for example **Lucide**, ISC) | Consistent stroke, labelled and decorative use. No emoji as icons (AGENTS.md) | Emoji; mixed icon sets | Licence check at ADR |
| Fonts | **Sora** (display), **Inter** (UI and body), **JetBrains Mono** (technical text). Self-hosted. All OFL | Distinctive display face without the overused cyberpunk pairings. Verified OFL in the UI skill's font-licence data | Orbitron (the cyberpunk default); CDN-loaded fonts (R-5) | None |
| Desktop shell | **Tauri 2** (Windows: WebView2; Linux/Zorin: WebKitGTK) | Small installed size and low idle memory, which matters for an always-running companion. Stable with mobile targets | Electron (consistent Chromium everywhere; heavier) | **Zorin OS gate (F5):** mic, WebGL2, AudioWorklet and always-on-top must pass on WebKitGTK. If not, fall back to Electron |
| Android shell | **Capacitor 8** around the same web build (approved subject to device testing) | Native permission handling for the microphone; a conservative choice for voice on Android. Overlay work is native either way. **Revised 2026-10-14:** a September 2026 report says Capacitor 8.5.1 also denies the WebView microphone unless `MODIFY_AUDIO_SETTINGS` is declared, so this is tested in F1, not assumed | **Tauri 2 mobile**: one toolchain across desktop and Android, but its Android WebView microphone permission path has documented problems (Tauri discussion #12732, April 2026) | **Android gate (F6):** microphone capture and a 60 fps orb on the reference device |
| Testing | **Vitest** + Testing Library (unit and component); **Playwright** in Chromium, Firefox and WebKit; **@axe-core/playwright** for accessibility scans | Real-browser verification, as the rules require. Covers all three rendering engines that our shells use | Unit tests only (not enough for audio or WebGL) | None |
| Component gallery | **Storybook 10** (MIT), used to review every state of every component | Makes the 11 states and the orb look-up reviewable without running the whole app | None | Optional; decide in F2 |
| Quality | ESLint with jsx-a11y; TypeScript `strict`; pnpm; Node 22 LTS | Catches common accessibility and type errors early | None | None |

### 1.1 Observed versions (npm registry, 2026-10-14; not installed)

| Package | Version | License |
|---|---|---|
| react | 19.3.1 | MIT |
| vite | 8.3.4 | MIT |
| typescript | 7.0.2 | Apache-2.0 |
| tailwindcss | 4.3.3 | MIT |
| react-aria-components | 1.22.1 | Apache-2.0 |
| motion | 14.2.0 | MIT |
| xstate | 5.33.2 | MIT |
| @tanstack/react-router | 1.170.44 | MIT |
| @tanstack/react-query | 5.104.2 | MIT |
| zod | 4.6.7 | MIT |
| vitest | 5.0.4 | MIT |
| @playwright/test | 1.64.1 | Apache-2.0 |
| @axe-core/playwright | 4.13.0 | MPL-2.0 (test-only use) |
| @storybook/react-vite | 10.6.2 | MIT |
| @tauri-apps/cli | 2.12.2 | Apache-2.0 OR MIT |
| @capacitor/core | 8.5.3 | MIT |
| @ricky0123/vad-web | 0.0.31 | ISC |

The versions above have not been tested together. Compatibility between them is an ADR task (F1), not an assumption.

### 1.2 Platform-specific risks

- **Zorin OS (Ubuntu-based):** WebKitGTK versions vary by release. **Revised 2026-10-14:** third-party reports say WebKitGTK refuses `getUserMedia` unless media streams are enabled and a permission-request handler allows the microphone, and that missing GStreamer plugins leave the device list empty. Both are tested in F1 (WS-D). Microphone, WebGL2, AudioWorklet and always-on-top behaviour must be tested on the actual Zorin version the user runs. Results are not assumed from other Linux systems. Wayland restricts overlays and screen capture, which affects Phase F7 and F8.
- **Windows:** WebView2 is Chromium-based and is usually present on Windows 10 and 11. Confirm the runtime is installed during packaging.
- **Android:** the WebView grants microphone access only after both the OS permission and the WebView grant succeed. Test on a real device, including audio focus behaviour.

---

## 2. Client architecture (summary)

```
Shell (browser | Tauri | Capacitor)
  └─ App UI (React, routes, components)
       ├─ Conversation machine (XState)   ← typed events ← Orchestrator (WebSocket/HTTP)
       ├─ Audio engine (AudioWorklet, VAD, playback queue)
       ├─ Orb renderer (WebGL2; reads a ref-based store every animation frame)
       ├─ Query layer (TanStack Query) for settings, memory, tasks, permissions
       └─ Local store (IndexedDB on web and desktop; memory stays on device, D-10)
```

Rules:
- The **UI never decides emotion**. Affect and state arrive as typed events from the orchestrator (ARCHITECTURE §3.2–3.5: orchestrator, Situation Gate, persona composer).
- The orb reads a **ref-based store** that is updated once per animation frame. High-frequency audio levels never go through React state, so the page does not re-render per frame.
- Every component that can run a capture or an action shows the global status bar (§4.1).
- No provider credentials exist in the client. The client calls only the orchestrator (SECURITY §6).

---

## 3. Design system (Task 3)

### 3.1 Direction

**A lit instrument, not a dashboard.** The orb is the one light source. Surfaces are dark, matte and layered, with hairline edges. Interfaces are quiet and precise. Layout is asymmetric: the companion stage takes the main column, and context sits to the side.

Avoid: purple-to-pink gradient washes; identical rounded SaaS cards; emoji icons; scattered fade-up entrances; hover-scale on everything; neon cyberpunk type; and red-primary marketing buttons.

Note on the UI skill's suggestion: `ui-ux-pro-max` returned an "AI-Native UI" style with `#6366F1` (AI Purple) as its primary colour. That contradicts the brief and is overridden here.

### 3.2 Colour tokens

Contrast was calculated with the WCAG relative-luminance formula on 2026-10-14. Text requires 4.5:1. Non-text indicators and control boundaries require 3:1 (WCAG 1.4.11).

**Dark theme (default)**

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--tl-bg-base` | `#07090E` | App background | — |
| `--tl-bg-surface` | `#0D1119` | Main panels | — |
| `--tl-bg-raised` | `#141A25` | Popovers, dialogs | — |
| `--tl-border-control` | `#6B7890` | Input and button boundaries | 4.24 on surface (dark); meets 3:1 |
| `--tl-border-hairline` | `#26303F` | Decorative dividers only | decorative |
| `--tl-text-primary` | `#EEF2F8` | Body and headings | 15.52 on raised |
| `--tl-text-secondary` | `#B3BDCC` | Secondary text | 9.19 on raised |
| `--tl-text-muted` | `#97A3B7` | Captions and metadata | 6.84 on raised |

**Light theme**

| Token | Value | Contrast |
|---|---|---|
| `--tl-bg-base` | `#F6F8FB` | — |
| `--tl-bg-surface` | `#FFFFFF` | — |
| `--tl-border-control` | `#6B7890` | 4.45 on surface; meets 3:1 |
| `--tl-text-primary` | `#0E1420` | 18.43 on surface |
| `--tl-text-secondary` | `#3F4A5C` | 8.95 on surface |
| `--tl-text-muted` | `#5C6679` | 5.78 on surface |

### 3.3 State language (colour is never the only cue)

Each state has a **label**, a **shape or motion cue**, and a **colour**. Colour is listed last on purpose.

| State | Label | Non-colour cue (motion) | Orb (dark) | Contrast on surface |
|---|---|---|---|---|
| `idle` | Ready | Slow breath | `#8FA3C2` | 7.37 |
| `listening` | Listening | Ring follows mic level | `#4FE3C8` | 11.84 |
| `thinking` | Thinking | Slow rotating shimmer | `#F5B94E` | 10.74 |
| `speaking` | Speaking | Ring follows speech envelope | `#6FD3FF` | 11.19 |
| `acting` | Working on a task | Segmented ring with progress arc | `#B5F26B` | 14.29 |
| `error` | Something went wrong | Single steady ring, no flashing | `#FF8A8A` | 8.33 |
| `muted/offline` | Muted or offline | Dashed ring, static | `#8A93A3` | 6.10 |

Light theme equivalents: `listening #0A7C6A` (5.12), `thinking #8A5A00` (5.93), `speaking #1C5FA8` (6.46), `acting #3D6B0F` (6.35), `error #A8232B` (7.14), `muted/offline #5A6170` (6.22), `idle #4B5F7D` (6.50).

Interactive surfaces also need a visible focus ring: 2 px `--tl-focus` (`#9BE9FF` on dark, `#0A5C8C` on light), with at least 3:1 against the adjacent colour.

### 3.4 Typography

| Role | Family | Weights | Notes |
|---|---|---|---|
| Display | Sora | 500, 600 | Headings and the state label only |
| UI and body | Inter | 400, 500, 600 | All other text |
| Technical | JetBrains Mono | 400, 500 | Logs, action traces, token and version strings |

Scale (rem at 16 px root): 0.875, 1, 1.125, 1.375, 1.75, 2.5. Body line height 1.5. Line length 60–75 characters. Text must resize to 200% and reflow at 400% zoom without loss (WCAG 1.4.4, 1.4.10).

Fonts are self-hosted with `font-display: swap`. No runtime request to a font CDN (R-5).

### 3.5 Spacing, shape, elevation, motion

- Spacing: 4 px base; scale 4, 8, 12, 16, 24, 32, 48, 64.
- Radius: 10 px controls, 16 px panels, 999 px pills (status chips only).
- Elevation: shadows are reserved for dialogs. The orb's glow is its own effect, not a shadow.
- Motion durations: 120 ms (micro), 200 ms (standard), 360 ms (state change). Easing: standard `cubic-bezier(0.2, 0, 0, 1)`.
- `prefers-reduced-motion: reduce` replaces every animation with a static state, a text change, or a short opacity change under 150 ms.
- Nothing flashes more than three times per second (WCAG 2.3.1).

### 3.6 Reusable components

`StatusBar` · `Orb` · `StateLabel` · `TalkButton` (push-to-talk) · `StopButton` (global) · `Transcript` (role `log`) · `MessageBubble` (with language tag and support status) · `ComposerInput` · `CaptionLine` · `LevelMeter` (text value and bar) · `ProviderStatusChip` (Untested / Experimental / Beta / Supported / Not supported, with date) · `PermissionRow` · `MemoryItem` · `TaskItem` (list item, not a card) · `ActionLogEntry` · `SettingField` · `BoundedSlider` (min and max come from the tested manifest) · `ConsentDialog` · `ConfirmDialog` · `ErrorBanner` · `EmptyState` · `Skeleton` · `Announcer` (polite live region) · `NavRail` · `BottomNav`.

Lists and dividers are preferred over cards. A card needs a reason to exist.

### 3.7 Orb specification

- **Parameters** driven by the orchestrator's events: `state`, `affect`, `intensity` (0–1), `speechAmplitude` (0–1). Audio level comes from the local mic in `listening`.
- **Rendering:** one full-screen quad in a fragment shader on a `<canvas>`. Parameters: radius, edge noise, hue, pulse rate, and ring segments.
- **Affect modifiers (from PERSONALITY §6.2):** `warm` slows the breath; `amused` adds a brief shimmer; `concerned` steadies the ring and cools the hue; `playful-annoyed` gives a quick pulse that settles within one turn; `excited` quickens the pulse; `calm-serious` is still and minimal.
- **Budget:** at most one noticeable flourish per reply, and fewer during long tasks.
- **Frame rate:** target 60 fps on the reference device. Idle drops to 30 fps. Hidden tabs and minimised windows pause rendering.
- **Fallbacks:** WebGL2 → Canvas 2D radial gradient → static SVG with the state label. The orb is decorative for assistive technology. The state label and an `aria-live` announcement carry the meaning.
- **Reduced motion:** no pulse or shimmer. The orb is static, the ring shape changes once per state change, and the level is shown as a bar.
- **Face (D-19):** not in v1. If approved later, it becomes a separate component with its own spec, and a Rive state machine is the candidate to evaluate.

---

## 4. Screens, navigation and responsive behaviour (Task 3)

### 4.1 Global frame

- **Status bar (always visible):** state label, mic indicator (`off`, `on`, `muted`), screen-awareness indicator (`off` in v1; visible once Phase F8 ships), and the **Stop** button. The Stop button is visible whenever mic, screen awareness or an action is active.
- **Navigation:**
  - **Phone (under 640 px):** bottom bar with five items: Companion, Chat, Tasks, Memory, More (Settings, Permissions, Privacy).
  - **Tablet (640–1023 px):** left rail with icons and labels.
  - **Desktop (1024 px and up):** left rail, main column, and a context panel (transcript, current task, status).
- **Skip link** to main content. Focus order follows visual order.

### 4.2 Screen specifications

| # | Screen | Purpose | Key elements | Required states | Phase |
|---|---|---|---|---|---|
| S0 | **First run and consent** | Disclose that Tolesh is an AI; confirm age (D-09); explain mic and memory choices | Plain-language statements; checkboxes that are off by default; "I'm not sure" leads to a safe default | Incomplete, declined (text-only mode), accepted | F2 |
| S1 | **Companion** (home) | The main experience: the orb and conversation | Orb (centre); state label beneath it; TalkButton; composer for text; "Show transcript" drawer; affect is never shown as text | idle, listening, thinking, speaking, error, muted/offline; connecting; no WebGL (2D fallback) | F2 (text), F4 (voice) |
| S2 | **Chat** | Read and search the conversation | Messages with language tag (`lang` attribute) and support chip; captions for voice replies; "That's not what I meant" action logs a correction event | Empty, loading history, failed send (retry), low-confidence transcript (confirm before sending) | F2 |
| S3 | **Voice panel** (on S1) | Control voice input and output | Push-to-talk and hands-free (later); input LevelMeter with text value; captions toggle; voice selection from tested male-presenting voices (D-22); pitch, rate and energy within tested bounds | Mic denied (explanation and text fallback); voice not tested for the chosen language (fallback message) | F4 |
| S4 | **Today** (dashboard) | Summary of what Tolesh is doing for the user | Current task, recent actions, memory count, provider status with honest labels, privacy summary (mic on or off; screen awareness on or off) | Loading skeleton; nothing scheduled ("No tasks yet"); provider degraded | F3 |
| S5 | **Tasks** | Track and stop work | TaskItem list with states: queued, running, awaiting confirmation, done, failed, stopped. Per-task action log | Empty; running; awaiting confirmation (ConfirmDialog); failed (what happened, retry, stop); stopped | F3 (list), F9 (actions) |
| S6 | **Permissions** | Control what Tolesh may access | PermissionRow per capability: microphone, notifications, screen awareness, computer control. Per-app allow-list. Last used. Revoke | Granted; denied; "Not available yet" for phases not built (shown, never silently missing) | F3 |
| S7 | **Memory** ("What Tolesh remembers") | Inspect and control memory | Tabs for memory types A to D; MemoryItem with source, date and "why stored"; edit; disable per type; global pause; "Forget everything"; export (JSON and readable text) | Empty ("Nothing remembered"); pause active; deletion confirmed in plain words | F3 |
| S8 | **Settings** | Persona, language, voice, accessibility, privacy | **Persona:** humour ceiling; roast opt-in, intensity, topics; stop-teasing state always visible. **Language:** mirror rule on; slang level; code-switching on or off; support matrix. **Voice:** see S3. **Accessibility:** reduce motion (follows the OS by default), text size, high contrast, captions. **Privacy:** what is stored, export, delete, telemetry (event-only) | Saved; saving; invalid value (field error next to the field) | F2 (stubs), F3 (live) |
| S9 | **Crisis (G0) view** | Calm, plain support when the gate says G0 | No persona flourishes; no orb flourish (calm-serious); short supportive text; generic instruction to contact local emergency help; verified numbers only after D-14 | Shown immediately; dismissible only by the user | F2 |
| S10 | **Confirm and stop overlays** | Prevent accidental destructive or irreversible actions | ConfirmDialog with the exact action, what changes, and Cancel as the default focus | Confirm, cancel, action failed | F3 (dialogs), F9 (actions) |
| S11 | **Floating assistant** | Compact orb that stays available | Mini orb with state label; Stop; open main app | Per platform | F7 (Phase 4) |

Visuals for S1 are the priority. Everything else is quiet structure around it.

### 4.3 Responsive behaviour

| Width (CSS px) | Layout | Requirement |
|---|---|---|
| **320** | Single column; bottom bar; orb scales to 56% of width | Reflow with no horizontal scroll (WCAG 1.4.10). Floor for testing |
| **360–390** | Design target: single column; orb at 60–70% of width; large touch targets | Primary design reference (D-21) |
| **600–767** | Single column with side margins; bottom bar | — |
| **768–1023** | Left rail; main column; transcript as a drawer | — |
| **1024–1439** | Rail; main; context panel | — |
| **1440 and up** | Same as 1024, with a wider context panel and a max content width of 1440 px | — |
| **400% zoom on 1280 px** (≈320 CSS px) | Same as 320 | Test case for WCAG 1.4.10 |

Test matrix: 320, 360, 375, 768, 1024, 1440 px, plus 400% zoom on a 1280 px window (D-21). Every screen in §4.2 is tested at each width.

---

## 5. Loading, empty, error and offline states

Rules: never blame the user; always say what happened and what can be done; keep the orb state consistent with what is true; never use a spinner alone for content that has a known shape (use a skeleton).

| Situation | UI behaviour | Example copy (placeholder; final copy approved with D-07) | Orb |
|---|---|---|---|
| Connecting to the orchestrator | Skeleton in the transcript; composer usable | "Connecting…" | muted/offline, dimmed |
| Orchestrator unreachable | Error banner with retry; text is queued locally | "I can't reach my brain right now. Your message is saved. I'll send it when I'm back." | error |
| Microphone permission denied | Explanation with steps to re-enable; text fallback | "The mic is off for this app. You can type, or turn it on in your system settings." | muted/offline |
| No WebGL2 | 2D canvas orb | — (no message; this is a silent fallback) | unchanged |
| Voice not tested for the detected language | Show transcript; reply in text in the best-tested language; say so | "Voice isn't tested for this language yet. I'll reply in text." | idle |
| Low-confidence transcript | Show the transcript; ask before acting | "Did you say: '…'? Send it, or type a correction." | listening then idle |
| Model or provider failed | Retry; name the fallback if one is used | "The main voice model didn't respond. I switched to a backup." | error, then speaking |
| Awaiting confirmation | ConfirmDialog; focus moves to Cancel | "Delete 3 files? This can't be undone." | acting (paused) |
| Action failed | Show the failed step, what was not changed, and Retry or Stop | "Stopped at step 2. Nothing else was changed." | error |
| Empty memory | Empty state with what the user can add | "Nothing remembered. You control what I keep." | idle |
| Long operation | Progress text and step name; Stop available | "Looking through the page… (step 2 of 4)" | acting |

Copy uses plain English. Nigerian English, Pidgin and Yoruba copy are not used in UI strings until native-speaker review (AGENTS.md).

---

## 6. Accessibility (WCAG 2.2 AA)

| Area | Requirement |
|---|---|
| Keyboard | Every function reachable by keyboard. Talk and Stop have keyboard shortcuts, configurable in settings. Shortcuts must not conflict with screen readers (WCAG 2.1.4) |
| Focus | Visible 2 px focus ring with 3:1 contrast (2.4.7, 2.4.11). Focus moves into dialogs and returns to the trigger on close. Focus never lands on something hidden |
| Targets | Primary controls at least 44 × 44 CSS px. All targets at least 24 × 24 px (2.5.8). Adequate spacing between targets |
| Dragging | Any drag interaction has a single-pointer alternative (2.5.7) |
| Announcements | `aria-live="polite"` for state changes only ("Listening", "Speaking", "Working on a task"). Partial transcripts are not announced. Announcements are debounced |
| Captions and transcripts | Every spoken reply has a caption and appears in the transcript |
| Motion | Reduced-motion equivalents for every state. No flashing above three per second |
| Colour | Every state has a label and a non-colour cue. Error states never rely on colour alone |
| Language | `lang` on every message: `en-NG` for Nigerian English, `yo` for Yoruba, `pcm` for Nigerian Pidgin. Language tags on messages are set by the language router, not guessed in the UI |
| Orb | Decorative for assistive technology. The state label and announcements carry the meaning |
| Text and zoom | 200% text resize without loss (1.4.4). Reflow at 320 CSS px and 400% zoom (1.4.10) |
| Forms | Every field has a visible label. Errors are described in text next to the field. Required fields are marked in text, not colour only |
| Testing | axe-core scan on every screen in every browser; manual keyboard and screen-reader pass (NVDA on Windows, Orca on Zorin) before each phase is marked done |

---

## 7. Performance and fallbacks

### 7.1 Budgets (proposed; set from measurement in F1 and F2)

| Metric | Target | Notes |
|---|---|---|
| Initial JavaScript for the Companion route | ≤ 200 KB gzipped | Excludes the orb shader |
| Orb frame rate | 60 fps on the reference device; 30 fps idle | Reference device chosen in F1 and written into the ADR |
| Interaction to next paint (INP) | ≤ 200 ms | Web Vitals "good" threshold |
| Largest Contentful Paint | ≤ 2.5 s on a mid-range phone over 4G | Web Vitals "good" threshold |
| Time to first audio, barge-in stop | Set from baseline measurement | ARCHITECTURE 3.9. No promise until measured |
| Idle CPU and GPU in the desktop shell | Measured per platform; recorded in the ADR | No fixed number until F5 |

### 7.2 Fallback ladder

| Capability missing | Behaviour |
|---|---|
| WebGL2 | Canvas 2D orb |
| Canvas 2D | Static SVG orb with state label |
| Microphone | Text input only; explanation shown |
| AudioWorklet | Mic level shown as "listening" text without a meter |
| Reduced motion (OS setting) | Static orb; state changes are text and shape only |
| Low-power mode (user setting, or hidden tab) | Orb paused or 1 fps; audio levels still update the state |

The Battery Status API is not relied on, because browser support is limited.

---

## 8. Platform support

| Platform | Shell | Status | Notes |
|---|---|---|---|
| Web (desktop and mobile browsers) | None; installable PWA | Phase F2 | Chromium, Firefox and WebKit tested. Web Speech API is not used |
| Windows | Tauri 2 (WebView2) | Phase F5 | Confirm WebView2 runtime at packaging |
| Linux / Zorin OS | Tauri 2 (WebKitGTK). Electron fallback | Phase F5 gate | Test on the actual Zorin release. Wayland limits overlays and screen capture |
| Android | Capacitor 8 around the same build | Phase F6 gate | Microphone permission and WebView grant tested on a real device. Overlay is a native module |
| iOS | Not in scope | — | Not in the brief. Revisit only if requested |

---

## 9. Integrations and dependencies

### 9.1 Proposed dependencies (none installed)

Listed in §1.1, plus: `@tanstack/react-router`, `@tanstack/react-query`, `xstate`, `zod`, `motion`, `react-aria-components`, `tailwindcss`, `lucide-react` (or equivalent), `@ricky0123/vad-web` (to evaluate), `vitest`, `@playwright/test`, `@axe-core/playwright`, `eslint-plugin-jsx-a11y`, `storybook` (optional), `@tauri-apps/cli` and `@capacitor/core` (shells, from F5/F6 only).

### 9.2 Not included

- three.js, React Three Fiber, Lottie, Rive: not in v1 (reconsider only for an approved face, §3.7).
- GSAP and its skills: conditional on a stack decision that adds GSAP. Not needed for v1.
- Next.js: rejected (§1).
- shadcn/ui: rejected as a visual base (§1).
- Electron: fallback only (D-24).
- Any analytics, session-replay or crash-reporting SDK that can see transcript content (R-7).

### 9.3 Integration contract (to write in F0, before F2)

The client and orchestrator share a versioned, typed event contract:

- Client to orchestrator: `user.text`, `user.audioChunk`, `user.stop`, `user.correction`, `user.setting`, `memory.edit`, `memory.delete`, `permission.revoke`, `task.stop`, `task.confirm`.
- Orchestrator to client: `state.changed`, `affect.changed`, `transcript.partial`, `transcript.final`, `reply.token`, `speech.chunk`, `gate.level`, `language.detected`, `provider.status`, `action.proposed`, `action.progress`, `error`.
- Every event is validated with Zod at both ends. Unknown events are logged as event names only, and are never rendered.

---

## 10. Implementation sequence and acceptance criteria (Task 3)

No phase starts until the user approves it in writing. F0 and F1 belong to roadmap Phase 0 (decisions and evaluation, no product UI). F2 and F3 belong to Phase 1; F4 to Phase 2 (its Pidgin and Yoruba extension is Phase 3, conditional); F5 to F7 to Phase 4; F8 to Phase 5; F9 to Phase 6.

### F0 — Approvals and contracts (documents only; no code)

- Decisions accepted: D-02, D-03, D-19, D-21, D-22, D-23, D-24, D-25.
- Integration contract (§9.3) written and reviewed.
- Design tokens (§3.2, §3.3) recorded as a specification.
- **Acceptance:** decisions recorded with dates in OPEN_DECISIONS.md; contract file reviewed; no code in the repository.

### F1 — Spikes (roadmap Phase 0; throwaway prototypes; plan in docs/F1_SPIKE_PLAN.md; execution awaits your approval)

- Orb shader on the reference device (mid-range Android) and on a desktop browser.
- Audio: getUserMedia and AudioWorklet in Chromium, in the Android WebView, and in WebKitGTK on Zorin OS.
- Record measurements and the ADR for the orb and the shell choice.
- **Acceptance:** numbers recorded against §7.1 targets; a go or no-go for each shell with the evidence; spike code kept out of the product branch unless approved.

### F2 — Web shell and text companion (roadmap Phase 1)

- App shell, global frame, navigation at all three widths.
- S0 consent, S1 companion (text), S2 chat, S8 settings (stubs with real validation), S9 crisis view.
- State machine with all seven states and the affect layer, tested with fake orchestrator events (test doubles only; no provider).
- **Acceptance:**
  - Every transition in the state machine has a unit test, including interruption from each state.
  - axe-core reports no serious or critical violations on S0, S1, S2, S8, S9 in Chromium, Firefox and WebKit.
  - The width matrix (§4.3) passes with no horizontal scroll at 320 px and 400% zoom.
  - Reduced-motion parity: every state has a non-animated equivalent, verified by test.
  - The keyboard completes a full text conversation with no mouse.
  - The network log shows no third-party requests.
  - Companion route JavaScript meets the §7.1 budget.

### F3 — Dashboard and control screens (roadmap Phase 1 memory requirement)

- S4 Today, S5 Tasks (list only), S6 Permissions, S7 Memory, and the live S8 settings.
- **Acceptance:**
  - A memory item deleted in the UI does not appear in the next reply (end-to-end probe, per MEMORY spec §8).
  - A revoked permission takes effect on the next action and is shown immediately.
  - Features not yet built are labelled "Not available yet", never hidden.
  - Dialogs trap and restore focus; destructive actions default to Cancel.

### F4 — Voice (roadmap Phase 2)

- Capture, VAD, streaming to the ASR adapter, playback queue, barge-in, captions, LevelMeter, S3 voice panel (D-22).
- Mic indicator visible whenever capture is active.
- **Acceptance:**
  - Barge-in stops playback within the threshold set from baseline measurement.
  - No raw audio is stored in the client (test on IndexedDB and cache storage).
  - Voice is offered only for languages and voices with a passing manifest entry; otherwise the fallback message appears.
  - Low-confidence transcripts are confirmed before any action.

### F5 — Desktop shells (roadmap Phase 4)

- Tauri 2 build for Windows and Zorin OS; Electron fallback only if the Zorin gate fails.
- **Acceptance:** on each target OS, microphone capture, WebGL2 orb, always-on-top window, Stop shortcut, and notifications all pass manual test scripts; idle resource use is recorded.

### F6 — Android shell (roadmap Phase 4)

- Capacitor build; microphone permission flow; touch targets; bottom bar; reduced-motion parity.
- **Acceptance:** on the reference device, microphone capture works after both permission layers; the orb holds 60 fps in the Companion screen during a 5-minute voice session, or the gap is documented and the orb budget is revised with the user.

### F7 — Floating assistant (roadmap Phase 4)

- Per-platform mini orb: Windows and Linux windows; Android overlay as a native module.
- **Acceptance:** each platform's limits are documented (Wayland, Android overlay policy); Stop is reachable from the floating assistant; no overlay appears without the user enabling it.

### F8 — Screen awareness UI (roadmap Phase 5; requires SECURITY §9 items 1–7 and 10)

- Permission flow, persistent indicator, exclusion zones, redaction preview, capture history.
- **Acceptance:** no capture without a visible indicator and consent; exclusion zones apply in tests; independent review recorded.

### F9 — Computer task execution UI (roadmap Phase 6; requires D-23 and full SECURITY §9)

- Plan view, step confirmation, dry-run, action log, kill switch, allow-list editor.
- **Acceptance:** the stop control halts every action state within the documented time; destructive actions require confirmation; an independent security review is recorded.

### Definition of done for each phase

Gates pass, evidence is committed (test reports, axe output, screenshots from real browsers, measurement tables), and the handoff lists what was not verified.

---

## 11. Decisions requiring your approval

**Status (2026-10-14):** items 1–6 and 9 were approved in your message (with conditions); see the approval record in OPEN_DECISIONS.md. Items 10 and 11 are still open. The spike plan is docs/F1_SPIKE_PLAN.md.

| # | Decision | Recommendation | Why you need to decide |
|---|---|---|---|
| 1 | D-02 Stack | React, TypeScript, Vite, TanStack, XState, React Aria, Tailwind, Motion | Commits the team to these libraries |
| 2 | D-03 Platform | Option A: one UI codebase with thin shells | Shapes packaging and effort |
| 3 | D-24 Desktop engine | Tauri 2; Electron fallback | Depends on the Zorin gate result |
| 4 | D-25 Android shell | Capacitor | Trade-off between one toolchain and mature Android voice handling |
| 5 | D-19 Orb and face | Abstract orb, no face in v1 | Changes the visual identity |
| 6 | D-21 Responsive baseline | 320 px floor; 360–390 px design target | Changes the acceptance tests |
| 7 | D-22 Voice scope | Tested male-presenting voices only; pitch, rate and energy adjustable within tested bounds; no cloning | Limits voice choice |
| 8 | D-23 Computer control | None until security review, then a per-app allow-list | Safety-critical scope |
| 9 | D-09 Age policy | Adults only | Required before any user other than you |
| 10 | D-14 Crisis resources | Verified Nigerian source before any number appears | Safety content |
| 11 | D-07 Persona details | Voice character, default humour, forms of address (no default "oga/boss" until approved), and no default roast | UI copy and persona settings depend on it |
| 12 | D-26 Accessibility standard | WCAG 2.2 AA as the target; baseline wording updated only after approval | Changes the cited standard in three documents |
| 13 | D-27 Motion library | `motion` for UI transitions; CSS for micro-interactions; no GSAP in v1 | Decides which motion skills apply |
| 14 | D-28 Component gallery | Storybook optional; decided in F2 | Adds a dependency |
| 15 | D-29 Fonts and icons | Self-host Sora, Inter, JetBrains Mono (OFL); one open-licence icon set | Licence and brand |
| 16 | Spike approval (F1) | Approve the spikes described in §10 | Spikes write code, so they need approval |

**Current state:** the planning documents are reconciled. Frontend implementation has **not** started and waits for your approval.
