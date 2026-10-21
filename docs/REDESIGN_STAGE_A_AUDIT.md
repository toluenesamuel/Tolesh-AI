# Tolesh AI redesign — Stage A: audit and baseline

Date: 2026-10-21 (Africa/Lagos). Branch: `arena/fae714f3-tolesh-ai`. Baseline commit: `7ae0c1b` (identical to `origin/arena/fae714f3-tolesh-ai`).

Stage A is read-only with respect to application code. The only repository changes made in this stage are:
- `skills-lock.json`: one new entry for `web-design-guidelines` (see §4).
- `.agents/skills/web-design-guidelines/` (SKILL.md, SOURCE.md) and the `.claude/skills/web-design-guidelines` symlink.
- This document.

Nothing has been pushed, merged, deployed, or changed in production.

## 1. Safety baseline

| Item | Result |
|---|---|
| Repository state before work | Local branch fast-forwarded from `c5e83ca` to `7ae0c1b`; working tree equal to `origin/arena` apart from two untracked probe PNGs (not committed). |
| Backup | `/home/user/Tolesh-AI-backup-redesign-20261021T132819Z/Tolesh-AI-full.tar` with `SHA256SUMS.txt`, `refs-before.txt`, `status-before.txt`. Restore check identical. |
| Unexplained changes | None found. |
| Unresolved | Request P work (95 uncommitted paths, `f7af520`-based) and its `/tmp` artefacts are **not present** in this clone. Whether they live in `7ae0c1b` history is unverified. Phase 1 cherry-pick gate remains open. |

## 2. Test and build baseline (actual results, run 2026-10-21)

Dependencies installed with `npm ci` in `web/` and `server/` from the lockfiles.

| Command | Result |
|---|---|
| `web`: `npm run typecheck` (`tsc --noEmit`) | Exit 0. |
| `web`: `npm test` (vitest) | **86 of 86 passed**, 12 files. |
| `web`: `npm run build` (`tsc --noEmit && vite build`) | Exit 0. Output: `index.html` 0.77 kB, CSS 7.13 kB, JS 25.46 kB (gzip 9.41 kB). |
| `server`: `npm test` (node test runner) | **84 of 84 passed**, 0 failed. |
| Browser scenarios (`web/e2e/ui-scenarios.mjs`, `verify-*.mjs`) | **Not yet run in this clone.** Planned for Stage D with the browser below. |

## 3. Browser baseline and defects

### 3.1 Environment

No browser was present after the re-clone. Playwright's CDN and Azure hosts did not respond from the sandbox. Chromium 153 was obtained from the `@sparticuz/chromium` npm package into `/tmp` (outside the repository) and run with its bundled system libraries (`LD_LIBRARY_PATH`) and fonts (`FONTCONFIG_PATH`). Launch and screenshot were verified. This binary is a third-party build; it was not used for anything other than rendering this app locally.

### 3.2 Capture method

A harness (kept outside the repo at `/tmp/browser-tools/capture.mjs`) starts the real API server with a scripted fake provider and the Vite dev server, then for each viewport captures: idle, after one message, history open, and settings open. It records horizontal overflow, the layout viewport width, console and page errors, and any clicks that are intercepted by another element.

Screenshots and `report.json`: `/home/user/design-evidence/baseline/` (outside the repo, 36 PNG files).

### 3.3 Results per viewport

| Viewport | Layout viewport width | Console errors | Intercepted taps |
|---|---|---|---|
| 320×568 | **399 px** | none | **Send**, **Settings** |
| 360×740 | **399 px** | none | **Send**, **Settings** |
| 375×667 | **399 px** | none | none |
| 390×844 | **399 px** | none | none |
| 430×932 | 430 px | none | none |
| 768×1024 | 768 px | none | none |
| 1024×768 | 1024 px | none | none |
| 1280×800 | 1280 px | none | none |
| 1440×900 | 1440 px | none | none |

Console errors are none for all runs. The fake provider returns a fixed reply; the reply rendered on desktop.

### 3.4 Defects confirmed in the baseline

1. **Mobile layout is wider than the phone (critical for 320–390 px).** Layout viewport becomes 399 px, so mobile browsers zoom the whole page out. The composer overflows (Send is pushed off-screen at 320 px) and the top bar clips "Settings" at 390 px.
2. **Taps blocked (critical at 320–360 px).** The orb canvas covers Send, and the status pill covers the Settings toggle. A user cannot reliably send a message on small phones.
3. **Emoji used as controls.** The History button uses `☰`, Settings uses `⚙`, the voice button uses `🎙` (renders blank in this font, so the primary voice control is an empty circle), the stop/record state uses `⏹`, and delete uses `✕`. The brief forbids emoji as controls.
4. **State label overlaps input at 390 px.** The `IDLE` pill sits over the composer field.
5. **Single breakpoint.** Only `max-width: 480px` exists; `.app` is capped at 860 px; there is no tablet or landscape layout.
6. **Privacy copy is inaccurate.** See §5.
7. **Speech comment overstates privacy.** `web/src/voice.ts` header says recognition is "browser-native, no keys, no cloud". Chromium's Web Speech recognition is typically processed by the browser vendor's service. This must be corrected in the UI copy (§5) and code comments. To be confirmed against the browser's documentation during Stage C.

### 3.5 Strengths to keep

- Stable element IDs and classes used by the 86 unit tests and the browser scenarios (see §6).
- Honest error mapping in `api.ts` and the `ChatErrorKind` set.
- Reduced-motion path already exists in the orb (static frame) and CSS (`prefers-reduced-motion` for buttons).
- `:focus-visible` rings are defined for input, buttons and the mic.
- Streaming, interruption (Stop/Escape), history, reconnect logic and reply-mode defaults have tests.

## 4. Skills verification (checked on 2026-10-21)

| Skill | Status | Evidence |
|---|---|---|
| `frontend-design` | **Present and verified.** Installed locally before this task. | `.agents/skills/frontend-design/SKILL.md`. SHA-256 `d91970639e9f5c37682ac7ab60094d35f1c7c1f38d731bd56396563aee10c1d3`, identical to the current upstream file (`anthropics/skills`, `skills/frontend-design/SKILL.md`). Licence file `LICENSE.txt` present. Lockfile entry present. |
| `web-design-guidelines` | **Installed in this task.** | Installed with the official command `npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines`, run in a scratch directory first. Only `SKILL.md` was copied into `.agents/skills/web-design-guidelines/`, with `SOURCE.md`. `.claude/skills/web-design-guidelines` is a symlink, matching the existing convention. `skills-lock.json` gained one entry (the installer-reported hash). SKILL.md SHA-256 `f4647ca866a3accf763777f83e7682954f0187cd6bea7eea0399796652414e8f` matches upstream. |

Caveats for both:
- **Native activation in Arena is not verified.** `docs/skill-setup.md` records that this session has no plugin registry, so the skills are used as explicitly read project instructions.
- **`web-design-guidelines` licence is not verified.** The upstream `vercel-labs/agent-skills` repository has no root `LICENSE` file.
- **Remote rules.** The skill fetches its rules from `raw.githubusercontent.com` at review time. That host is not on the sandbox allowlist. The rules were read through the GitHub API instead: `vercel-labs/web-interface-guidelines/command.md`, blob `3eb3a212b7b89493922ea418489d4c6f67ae8bd5`, SHA-256 `d246b026f4f29b5823a9cc857f9edf3d2507002e055e32040cadeaf3b38e0234`. Copy kept at `/home/user/design-evidence/web-interface-guidelines-command.md`.
- The installer printed "Review skills before use; they run with full agent permissions." The reviewed SKILL.md contains no commands to execute; only its review criteria are used, and the skill is not run as a script.

## 5. Privacy and data-flow audit

| Claim in the app | Actual data flow (from code) | Verdict |
|---|---|---|
| Onboarding: "Your conversations stay on this machine, and you can delete or export them from History." (`web/src/main.ts`) | Conversations are saved by the Tolesh server in SQLite (`DB_PATH`, default `server/data/tolesh.db`). Each message is sent to the configured model provider (`DAHL_BASE_URL`). Routes: `GET/POST/DELETE /api/conversations`. | **Inaccurate.** "On this machine" is only true for a local server. Must state the server stores conversations and the provider receives messages. Change in Stage C. |
| Settings note: "Settings are stored only in this browser (localStorage). Nothing is sent anywhere." | Settings use `localStorage` (`web/src/settings.ts`). No settings field is sent to the server in the reviewed code. | **Mostly accurate.** Keep the first half; change "Nothing is sent anywhere" to "Settings are not sent to the Tolesh server", and confirm in Stage C. |
| Voice note: "Voice uses your browser's built-in speech engine … " | Recognition is provided by the browser. Vendor processing (for Chromium, typically a cloud service) is not described. | **Incomplete.** Add that the browser's speech service may process your voice. Wording to be confirmed in Stage C. |
| Provider keys | Read from server environment variables only (`providers.js`). `/api/providers` returns `available`, `needsKey` (booleans), model names and labels, not the key. Client bundle scanned for key-shaped tokens (`sk-…` with 20+ characters): **none**. The bundle does contain the variable name `DAHL_API_KEY` inside a user-facing message, which is not a secret. | **Verified** for the current build (pattern scan, not a proof). |
| Conversation API access control | `/api/conversations` routes have **no authentication**. CORS allows only `localhost` and `127.0.0.1` origins. | **Blocks any public backend.** A public backend would expose every stored conversation. Requires an approved auth design before any deployment. |

## 6. Frontend-to-backend URL resolution

- `web/src/api.ts`: `BASE = import.meta.env.VITE_API_BASE ?? ''`. Requests go to relative paths such as `/api/chat/stream`.
- Dev: `web/vite.config.ts` proxies `/api` to `TOLESH_API` or `http://127.0.0.1:8787`.
- Production build: there is no proxy. A static host returns 404 for `/api/*`. Observed on the existing preview: `https://tolesh-ai.vercel.app/api/health` → 404 `NOT_FOUND`, and the page shows "Cannot reach the Tolesh server".
- Options for a verified production path (not implemented; each needs approval):
  - **A.** Same-origin reverse proxy: the static host rewrites `/api/*` to a backend host. Needs a backend host (new service, possibly paid).
  - **B.** Set `VITE_API_BASE` to a separate backend origin. Needs a CORS allowlist change on the server and the auth decision in §5.
  - **C.** Serverless functions. Major architecture change; a stop condition.
- Until one is approved, the redesign must show an honest "backend not configured" state in production builds instead of a generic unreachable error.

## 7. Stable interface to preserve

Element IDs used by unit tests and browser scenarios: `#orb`, `#state-label`, `#status-text`, `#status-dot`, `#status-pill`, `#mic`, `#text-input`, `#send`, `#stop`, `#history-toggle`, `#history-panel`, `#settings-toggle`, `#settings-panel`, `#transcript`, `#onboarding`, `#onboarding-ok`, `#footnote`, `#setting-speech`, `#speech-rate`, `#rate-out`, `#hands-free`, `#new-chat`, `.msg`, `.history-item`, `.history-delete`, `.history-export`, `.history-open`, `.body`. The `Hud` class API (`setState`, `getState`, `setLevel`, reduced-motion option) is used by `tests/hud.test.ts`.

## 8. Known gaps carried into later stages

- AGENTS.md still says "planning only / stack not chosen". This is stale against the code (vanilla TypeScript and Vite) and should be updated in the final report; the change is out of scope here.
- The React / Tailwind / XState / React Aria stack in `docs/FRONTEND_IMPLEMENTATION_PLAN.md` is not adopted. The redesign stays in the existing stack.
- The white cloud avatar exists only in `spikes/cloud-avatar/`. It is not used in the app.
- `speaking` level currently comes from `speech-queue` `onLevel`. Whether it is driven by real playback has not yet been verified (Stage C).
- The `esbuild` install-script warning and the 3 npm audit findings (1 moderate, 2 critical) reported by the Vercel build are not yet triaged.

## 9. Next

Stage B: design spec in `docs/REDESIGN_DESIGN_SPEC.md`, before any implementation. Then stop for approval of the production API path (§6) and of the Vercel decision (keep, pause or delete the public `tolesh-ai` deployment, which is currently serving the frontend without a backend).
