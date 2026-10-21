# Tolesh AI redesign — Stage B: design specification

Status: **proposed, not yet approved.** Written before implementation (Stage C). Baseline facts are in `docs/REDESIGN_STAGE_A_AUDIT.md`.

Scope: the existing vanilla TypeScript + Vite web app in `web/`. No framework change, no new runtime dependency, no server change, no new paid service. Server API contracts and every element ID listed in the audit §7 stay the same.

## 1. Direction

**Concept: "Core".** Tolesh is a single luminous instrument, not a face or an avatar. The orb is the only ornament, and it is a live readout of what the assistant is doing. Everything else is quiet, dark and precise, so the orb carries the personality.

Principles:
1. **State is honest.** Every visual state corresponds to a real event (mic stream, request in flight, real speech playback, real error). No animation implies activity that is not happening.
2. **Dark first, light later.** All colour is set through semantic tokens. A light theme is a later token override, not a rewrite.
3. **Thumb first.** On phones the primary actions sit in the bottom third of the screen.
4. **Quiet chrome.** Hairline borders, low-contrast surfaces, one accent colour per state.
5. **Vector only.** No emoji or glyph characters as controls. Icons are inline SVG.

## 2. Design tokens

All values are CSS custom properties on `:root` (dark theme). A `[data-theme="light"]` block is reserved for the later light theme and is not shipped in Stage C.

### 2.1 Colour (dark)

| Token | Value | Use | Contrast on `--bg-0` |
|---|---|---|---|
| `--bg-0` | `#05080F` | page background | — |
| `--bg-1` | `#0A1020` | sidebar, sheets | — |
| `--surface-1` | `#0E1626` | bubbles, composer field | — |
| `--border` | `rgba(136, 214, 255, 0.14)` | hairlines | decorative |
| `--border-strong` | `rgba(136, 214, 255, 0.32)` | focused or active borders | decorative |
| `--text-1` | `#E8F1FB` | primary text | 17.6 : 1 |
| `--text-2` | `#A3B4C9` | secondary text | 9.5 : 1 |
| `--text-3` | `#7D8FA6` | captions, labels | 6.1 : 1 |
| `--accent` | `#38D8F0` | listening, primary actions | 11.7 : 1 |
| `--accent-ink` | `#04121A` | text on accent fills | 11.1 : 1 on `--accent` |
| `--think` | `#A597FF` | processing | 8.1 : 1 |
| `--speak` | `#5EF2C2` | speaking | 14.3 : 1 |
| `--danger` | `#FB7185` | errors | 7.4 : 1 |
| `--offline` | `#94A3B8` | offline, muted | 7.8 : 1 |
| `--focus` | `#7DD3FC` | focus ring, 2 px, offset 2 px | — |

Every text token is at least 4.5 : 1 against `--bg-0` and `--surface-1`. Contrast figures were computed on 2026-10-21 with the WCAG relative-luminance formula.

### 2.2 Spacing, radius, elevation, z-index

- Spacing scale (px): 4, 8, 12, 16, 20, 24, 32, 40, 56.
- Radius: `--r-sm` 10, `--r-md` 14, `--r-lg` 20, `--r-pill` 999.
- Elevation is a border plus a soft shadow (`0 12px 40px rgba(0,0,0,.45)`) on overlays only.
- Z-index: transcript 0, orb 1, state label 2, composer 3, top bar 4, drawer scrim 20, drawer 21, toast/notice 30.

### 2.3 Typography

- Family: system UI stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, …`). No web font is loaded, so there is no third-party request and no layout shift.
- Scale (rem): caption 0.72, small 0.8, body 0.95 (line-height 1.55), lead 1.05, title 1.25, wordmark 0.9 with `letter-spacing: 0.32em`.
- Numbers in settings and history counts use `font-variant-numeric: tabular-nums`.
- Headings use `text-wrap: balance`. Body paragraphs use `text-wrap: pretty`.
- Text is never sized in `vw`. The base font size is user-controllable through the browser.

### 2.4 Motion tokens

- `--ease-out: cubic-bezier(.2,.7,.2,1)`; durations 160 ms (controls), 280 ms (drawers and sheets), 900 ms (state crossfade in the orb).
- Only `transform` and `opacity` are animated. No `transition: all`.
- Under `prefers-reduced-motion: reduce`: all CSS transitions and animations are removed, drawers switch to an instant show, and the orb uses its static frames (§5.3).

### 2.5 Light theme (reserved)

The same semantic names are overridden under `[data-theme="light"]`. Text tokens must be re-checked for 4.5 : 1 on the light background before shipping. Not part of Stage C.

## 3. Iconography

- Inline SVG `<symbol>` sprite in `index.html` or generated at boot. `viewBox="0 0 24 24"`, `stroke="currentColor"`, `stroke-width="1.75"`, round caps and joins, `fill="none"`.
- Set (drawn for this project; no third-party icon package is added):
  `menu` (History), `sliders` (Settings), `mic` (voice input), `mic-off` (listening active), `stop` (square; stop speech or request), `send` (paper plane), `plus` (new conversation), `trash` (delete), `download` (export), `close`, `check`, `alert` (errors), `wifi-off` (offline).
- Every icon is `aria-hidden="true"`. Every icon-only button has an `aria-label`. Icon-plus-text buttons keep the text visible.
- The mic button's accessible name changes with state: "Start voice input" / "Stop listening".

## 4. Layout

Breakpoints (min-width, CSS):

| Name | Min width | Used for | Viewports tested |
|---|---|---|---|
| `base` | 0 | phones, portrait | 320, 360, 375, 390, 430 |
| `md` | 640 | large phone landscape, small tablet portrait | 768 |
| `lg` | 1024 | tablet landscape, laptop | 1024 |
| `xl` | 1280 | desktop | 1280, 1440 |

Reading width: transcript and composer are capped at 680 px (`lg`) and 760 px (`xl`), centred.

### 4.1 Phone (`base`, below 640)

```
┌──────────────────────────┐  top bar: [History] TOLESH   [status dot] [Settings]
│                          │
│     ( orb, ~38vh max )   │  state label under orb
│                          │
│   transcript (scrolls)   │
│                          │
├──────────────────────────┤  composer (sticky, safe-area bottom padding)
│ [mic] [ text field  ][➤] │
│ voice note (small)       │
└──────────────────────────┘
```

- Top bar is 52 px, with 44 × 44 px hit targets for History and Settings.
- History and Settings open as full-height **drawers** (History from the left, Settings from the right) with a scrim. Focus moves into the drawer, Escape closes it, and focus returns to the opener.
- Composer: mic (48 px) and send (48 px) sit at the thumb edge. The text field is at least 16 px font size to prevent iOS zoom on focus.
- `env(safe-area-inset-*)` is applied to the top bar, composer and drawers.
- Keyboard: the layout uses `visualViewport` (or `100dvh`) so the composer stays above the on-screen keyboard. While the text field is focused on a phone, the orb is hidden or reduced to its small form to keep the transcript visible.
- The onboarding card is a dismissible banner above the composer, not a block in the transcript.

### 4.2 Tablet portrait (`md`, 640–1023)

- Same single-column structure as the phone, wider transcript (max 680 px), orb up to 300 px.
- History and Settings remain drawers.

### 4.3 Tablet landscape and desktop (`lg`, 1024 and up)

```
┌────────────┬───────────────────────────────────────────┐
│ TOLESH     │  status pill                 [Settings]   │
│ [+ New]    ├───────────────────────────────────────────┤
│            │          ( orb, ~300 px )                 │
│ history    │          state label                      │
│ list       │  transcript (680 px column)               │
│ (scrolls)  │                                           │
│            │  composer (680 px column)                 │
│ [Export]   │  voice note                               │
└────────────┴───────────────────────────────────────────┘
```

- Sidebar is 280 px (`lg`) or 300 px (`xl`), always visible, with its own scroll.
- History is in the sidebar; the History toggle is hidden on `lg` and up because the list is permanent. The `#history-panel` and `.history-item` IDs stay on the sidebar list.
- Settings opens as a right-side sheet, 380 px wide.
- The orb is 300 px (`lg`) and 340 px (`xl`), and the transcript flexes to the remaining height.

### 4.4 Landscape phone

Short viewports (height under 500 px) use a two-column arrangement: orb and state on the left, transcript and composer on the right, with the top bar kept at 44 px.

## 5. Orb

The canvas orb (`hud.ts`) is kept and extended. The public API `new Hud({canvas, reducedMotion})`, `setState`, `getState`, `setLevel(0..1)` is unchanged, so `tests/hud.test.ts` still applies.

### 5.1 States

| State | Trigger (real event only) | Visual | Motion | Label | Reduced-motion frame |
|---|---|---|---|---|---|
| `idle` | app ready, nothing in progress | cyan core, soft halo | slow breath, 4 s | "Idle" | core, halo, no breath |
| `listening` | `SpeechRecognition` started and mic stream open | accent ring, core brightens | ring radius follows real mic level from the AnalyserNode | "Listening" | ring at a fixed radius, brighter core |
| `thinking` | request sent, first token not yet received | violet arc orbiting the core | arc rotation 2.4 s per turn | "Thinking" | violet arc, no rotation |
| `speaking` | `speechSynthesis` `onstart` fired, until `onend` or cancel | mint core, halo | pulses on real `boundary` events (word starts) and fade between them | "Speaking" | mint core, halo |
| `error` | an `ApiError` or recognition error that stops the turn | rose ring, steady | none | "Problem" | rose ring |
| `offline` | `navigator.onLine` false, or server unreachable | grey, dimmed core, dashed ring | none | "Offline" | grey dimmed core |

Rules:
- The orb never shows `speaking` for synthetic audio. `speechSynthesis` gives no audio level, so the speaking pulse is driven only by real `start`, `boundary` and `end` events. If a browser does not emit `boundary`, the orb shows a steady `speaking` core with no pulse. This replaces any synthetic level that `speech-queue` currently produces; Stage C verifies the existing code and records the outcome.
- `listening` ring radius uses the real AnalyserNode level, not a timer.
- Transitions between states crossfade over 900 ms (opacity and colour only). Under reduced motion they switch immediately.
- A state change is interruptible: a new state replaces an old one at once.

### 5.2 Accessibility of the orb

- `<canvas id="orb" aria-hidden="true">`. The state is announced by `#state-label` (`role="status"`, `aria-live="polite"`), so screen readers hear state changes once, not every frame.
- The orb is decorative and never the only indicator. The label text and the status pill carry the same meaning.

### 5.3 Reduced motion

- `prefers-reduced-motion: reduce` switches the orb to static frames (table §5.1), with no rAF loop running.
- The static frame is redrawn only on state change or resize.

### 5.4 Not used

The white cloud avatar in `spikes/cloud-avatar/` is not adopted. No generic avatar or face. No GSAP, WebGL or Lottie dependency is added in this redesign.

## 6. Components

| Component | Behaviour | Keeps ID / class |
|---|---|---|
| Top bar | History (phone and tablet portrait only), wordmark, status pill, Settings | `#history-toggle`, `#settings-toggle`, `#status-pill`, `#status-dot`, `#status-text` |
| Status pill | dot colour and text reflect provider state; text is the real provider state from `/api/providers`, or "Backend not connected" (see §8) | same |
| Orb region | canvas, state label | `#orb`, `#state-label` |
| Transcript | message bubbles; user right, assistant left; pending and error variants; empty hint | `#transcript`, `.msg`, `.msg.user`, `.msg.assistant`, `.msg.pending`, `.msg.error-msg`, `.empty-hint` |
| Composer | text field, mic, send, stop (stop shown only while busy) | `#controls`, `#text-input`, `#send`, `#stop`, `#mic` |
| History list | conversations, New, Export, Delete with confirmation (`trash` icon) | `#history-panel`, `#new-chat`, `.history-item`, `.history-delete`, `.history-export` |
| Settings sheet | speak replies, speech rate, hands-free, privacy note | `#settings-panel`, `#setting-speech`, `#speech-rate`, `#rate-out`, `#hands-free` |
| Onboarding | dismissible card with the corrected privacy text (§7) | `#onboarding`, `#onboarding-ok` |
| Footnote | voice and privacy note, small | `#footnote` |

Delete uses a confirmation step (a second press or an inline confirm) before removing a conversation. This follows the guideline that destructive actions need confirmation or an undo window.

### 6.1 Buttons and states

- Minimum hit target 44 × 44 px on touch, with 8 px spacing between targets.
- Hover (desktop only, `@media (hover: hover)`), active, focus-visible and disabled states all change contrast, not just colour.
- Focus ring: 2 px `--focus` with 2 px offset. Never `outline: none` without a replacement.
- Mic when listening: `aria-pressed` reflects state, icon changes to `mic-off` or `stop`, and the accessible name changes.

## 7. Privacy copy (proposed; must match §8 and the audit)

These replace the current text. Final wording is confirmed against actual behaviour in Stage C.

- Onboarding: "Tolesh saves your conversations on the server it runs on, and each message is sent to the AI provider that server is set up to use. You can delete or export any conversation from History. Voice input and spoken replies use your browser's speech features; with some browsers your voice may be processed by the browser's speech service."
- Settings note: "Settings are saved only in this browser. They are not sent to the Tolesh server."
- Voice footnote (short): "Voice uses your browser's speech features. Hands-free listening pauses while Tolesh speaks."

The phrase "stay on this machine" is removed. The server-code comment in `voice.ts` that says "no cloud" is corrected to describe the browser-vendor processing.

## 8. Production API path and honest unavailable state

Current state: production builds have no `/api` proxy (audit §6). Requests return 404 on the static host, and CORS allows only localhost origins.

Design decision (no implementation until approved):
- In production (`import.meta.env.PROD`) with no `VITE_API_BASE`, the app shows a single persistent notice: "Tolesh's server is not connected to this site yet. Chat and voice need the server." It does not retry in a loop and does not show a generic network error on every message. The composer is disabled with an explanation.
- Once a path is approved (audit §6 option A or B), `VITE_API_BASE` (or the same-origin rewrite) is set in the build environment. No secret is ever put in the frontend.
- Auth: conversation routes are unauthenticated (audit §5). No public backend is enabled until an auth design is approved.

## 9. Accessibility checklist (from web-design-guidelines, applied to this design)

- Landmarks: `header`, `nav` (sidebar), `main`, `aside` (drawer or sheet), `footer`. A skip link to `#transcript` or the composer.
- Headings: one `h1` (wordmark), `h2` for History and Settings headings.
- Drawers and sheets: `role="dialog"`, `aria-modal="true"`, focus trapped while open, Escape closes, focus returns to opener, `overscroll-behavior: contain`.
- Live regions: `#state-label` (`role="status"`, polite). New assistant messages are announced once, when the reply completes (not per token). Errors use `role="alert"` only for fatal errors.
- Forms: text field has a label (visually hidden if needed) and `autocomplete="off"`, `spellcheck="false"`; the placeholder ends with "…".
- Speech rate has a visible label and an output (`#rate-out`).
- Typography: "…" not "...", curly quotes in copy, Title Case button labels ("Send", "Stop", "Start Voice Input" as label text where text exists).
- Animations honour reduced motion; decorative loops stop under reduced motion; no autoplay longer than 5 s.
- Touch: `touch-action: manipulation`, `-webkit-tap-highlight-color` set deliberately, `overscroll-behavior: contain` on drawers. `overscroll-behavior: none` on `html` only under `@media (pointer: fine)`.
- Dark mode: `color-scheme: dark` on `html`; `<meta name="theme-color">` matches `--bg-0`.
- Images: none. The canvas is decorative.
- Forced colours (Windows high contrast): borders and focus rings use system colours through `forced-colors` media query.

## 10. Implementation scope (Stage C)

Files expected to change: `web/index.html` (theme-color, skip link, sprite), `web/src/main.ts` (markup and icon buttons, copy, production notice, drawer behaviour), `web/src/styles.css` (tokens and breakpoints, rewritten in place), `web/src/hud.ts` (state contract, reduced motion frames, real-event-driven speaking), `web/src/voice.ts` (comment correction, real `boundary`/`start`/`end` handling if missing), `web/src/speech-queue.ts` (verify speaking events; no synthetic level), plus new unit tests for any new pure logic.

Files that must not change: `server/**`, API contracts, `web/src/api.ts` request shapes, `web/src/sse.ts`, `web/src/reconnect.ts`, persisted settings keys in `settings.ts`.

Changes are small and reversible: one commit per concern, no history rewrite, no force push.

## 11. Test plan (Stage D)

1. Existing: `npm run typecheck`, `npm test` (86), `npm run build`, server `npm test` (84).
2. Browser scenarios with the real server and scripted provider: `web/e2e/ui-scenarios.mjs`, `verify-ui.mjs`, `verify-settings.mjs`, `verify-reconnect.mjs`, using a Chromium located through `CHROME_PATH`.
3. Responsive capture at 320, 360, 375, 390, 430, 768, 1024, 1280, 1440. Assertions: no horizontal page overflow (document scroll width equals the viewport width), no intercepted taps on Send, Settings, History and the mic, all controls at least 44 px on touch.
4. Keyboard: Tab order through top bar, transcript, composer; Escape stops speech and closes drawers; Enter sends; focus visible on every control.
5. Screen reader: accessible names for icon buttons; live region announces state once; drawer focus trap and return.
6. Reduced motion: emulated `prefers-reduced-motion: reduce`; no running animation frames for the orb; no CSS animation or transition on state change.
7. Offline and interrupted states: browser offline emulation shows the offline orb; a dropped stream shows the honest error; reconnect works.
8. Console: zero errors and zero page errors during the scenarios.
9. Accessibility scan: axe-core run from a scratch directory (not added to the repo), with results recorded.
10. Contrast: computed for every token pair in §2.1.

Each test result is recorded with the actual outcome. A test is not reported as passed unless it was run.

## 12. Decisions needed from the user

1. Production API path: option A (same-origin proxy, needs a backend host) or option B (separate backend origin with a CORS change and auth). Until then the production notice in §8 is shown.
2. The public `tolesh-ai` Vercel deployment (`dpl_2FXNMKfFXr3gescrNZ2E69eM2xXn`, promoted to production, serving the frontend without a backend): keep, pause or delete. No action has been taken.
3. Approval of the copy in §7, including the statement that browser speech may be processed by the browser vendor.
4. Confirmation that Stage C may change `hud.ts` and `speech-queue.ts` (speaking must follow real events).
