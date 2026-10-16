# Open Decisions

Status: **partly approved (2026-10-14).** Items in the approval record below are approved, with the conditions shown. All other items are still open. Items marked **blocking** stop the named phase. Recommendations are proposals for you to accept or change.

## Approval record (2026-10-14)

Source: your message approving docs/FRONTEND_IMPLEMENTATION_PLAN.md with six conditions.

| Decision | Status | Condition or note |
|---|---|---|
| D-02 Frontend framework | **Approved:** React, TypeScript, Vite | Other stack libraries (TanStack, XState, Zod, React Aria, Tailwind 4, Motion): **confirmation requested** in docs/F1_SPIKE_PLAN.md §12 item 10 |
| D-03 Platform approach | **Approved:** Option A (web-first, thin shells) | — |
| D-19 Avatar and face | **Approved 2026-10-16:** the white cloud avatar (`spikes/cloud-avatar/`) replaces the orb entirely. Its eyes are part of the cloud. No human face, no animal features | Renderer (inline SVG) and device performance confirmed by F1 spike results |
| D-23 Computer control | **Approved:** none until a security review is approved | Condition 6 of your approval |
| D-24 Desktop engine | **Approved:** Tauri 2 | **Subject to the Zorin OS compatibility test** (F1 WS-D, T-Z-1 to T-Z-6) |
| D-25 Android shell | **Approved:** Capacitor | **Subject to device testing** (F1 WS-E, T-A-1 to T-A-4). New evidence (tc-mobile PR #334) means this must be tested, not assumed |
| D-26 Accessibility | **Approved:** WCAG 2.2 AA target | Baseline wording in ARCHITECTURE_PLAN.md §10, MASTER_IMPLEMENTATION_PLAN.md §6 and AGENTS.md updated to match |
| Design direction | **Approved:** futuristic, polished, animated AI avatar (the white cloud, D-19), voice interaction, dashboard, light and dark themes | Palette and tokens are working values, finalised in F0 |
| Security | **Approved:** no computer-control implementation before the security review is approved | Condition 6 |

**Still open for approval:** D-21, D-22, D-27, D-28, D-29, the remaining stack libraries, D-06, D-05, D-17, D-09, D-14, D-07, D-10, D-01, D-20. The full list is in docs/F1_SPIKE_PLAN.md §12.

Format: ID, question, options, recommendation, what it blocks, who decides.

## A. Product and legal

### D-01 Who will use Tolesh? (blocking Phase 0 legal check, Phase 1 data handling)
- (a) Only you, personally.
- (b) A small invited group.
- (c) The public.

Why it matters: the NDPA's personal/household exemption may cover (a) but not (b) or (c). (b) and (c) bring registration thresholds, a privacy notice, a DPIA, processor agreements, cross-border rules and an age policy (SECURITY_AND_PRIVACY_PLAN.md section 3).
Recommendation: build as if (b) is possible, launch as (a), and get counsel before inviting anyone.
Decides: you, with counsel.

### D-09 Age policy (blocking before any user other than you)
Adults only (18+) versus allowing minors. Under-18s are children under the NDPA and need verification and consent mechanisms.
Recommendation: adults only for v1.

### D-08 Romantic or sexual roleplay and "affection" boundaries
The brief allows affectionate teasing and warmth. It does not mention romance.
Recommendation: out of scope for v1. Friendly, warm affection only; no romantic roleplay, no jealousy or guilt dynamics.

### D-14 Crisis resources
Which helplines or emergency guidance to surface at gate G0. They must be verified by a qualified Nigerian source. Do not ship invented numbers.
Blocking: Phase 1 G0 behaviour beyond "supportive and encourage real-world help".

## B. Technical

### D-02 Stack and framework (blocking Phase 1)
Not chosen. Criteria: avatar rendering performance on mid-range Android, mic/audio latency, offline behaviour, packaging, maintainability, accessibility. Decide through a short prototype, recorded as an ADR.

**Recommendation (2026-10-14, see docs/FRONTEND_IMPLEMENTATION_PLAN.md §1):** TypeScript; React 19; Vite 8 as an installable PWA; TanStack Router and Query; XState for the conversation machine; Zod for events; React Aria Components; Tailwind CSS 4 with tokens; Motion for UI transitions; custom WebGL2 orb. Not Next.js. **Awaiting your approval.** The final choice is confirmed by the F1 spike and recorded as an ADR.

### D-03 Platform approach (blocking Phase 1 shell, Phase 4)
- A: web-first PWA + thin desktop shells + Android wrapper.
- B: web UI + native companions for overlay/agent features.
- C: fully separate native apps.

Recommendation: A for v1 conversation; revisit for overlay and agent features.

**Frontend recommendation (2026-10-14):** A, with a Tauri 2 desktop shell (D-24) and a Capacitor Android shell (D-25). **Awaiting your approval.**

### D-04 Orchestrator placement
Server, on-device or hybrid. Open-weight Nigerian models are about 1.5B-8B parameters and need GPUs. Hosted APIs mean cross-border transfer. On-device means smaller models and weaker language ability.
Recommendation: server-side orchestrator for v1; measure first.

### D-05 Providers to evaluate (blocking Phase 0 baseline)
Proposed shortlist from the research (docs/NIGERIAN_LANGUAGE_AND_SPEECH_RESEARCH.md): ASR: Whisper large-v3 (baseline), NaijaVox-2.0, Azure en-NG, Spitch. TTS: Azure en-NG-Abeo, ElevenLabs v3/v4, Gemini TTS, Spitch, YarnGPT (product and open), MMS-TTS-yor. LLM: at least one frontier model from each major vendor, plus N-ATLaS for comparison.
Question: which to include, and your budget for trials.

### D-10 Memory sync across devices
Local-only versus optional end-to-end-encrypted sync. Recommendation: local-only in v1.

### D-16 Situation Gate implementation
Dedicated small classifier, structured LLM call, or rules + LLM. Decide after Phase 0 data on gate accuracy.

### D-18 Telemetry
Event-only logs versus none. Content logging only with explicit consent. Recommendation: event-only, local first.

### D-19 Avatar rendering approach and face
CSS/SVG, canvas or WebGL/shader; face versus abstract orb only. Decide by prototype against performance limits.

**Decision (2026-10-16, Request K):** the white cloud avatar is approved as Tolesh's visual identity and replaces the orb entirely. It is drawn as inline SVG from a pure state controller, so the cloud needs no WebGL. This supersedes the 2026-10-14 frontend recommendation (WebGL2 orb shader, no face). The eyes are part of the approved cloud, so the earlier 'no face in v1' meant no human face. There is still no human face, no animal features and no orb. The orb stays in git history and in `spikes/phone-probe/orb.js` (no longer loaded) for rollback. **Request L (2026-10-16):** the cloud now has a single outline, transparent glasses with electric-blue frames, large blue irises, dark brows, a navy scene, and a playful wink on cursor approach. Not in acting or error, and never with reduced motion. This is still a prototype: it is not integrated into the main app. **Persona:** the male-presenting personality is kept through voice, language and manner, and the cloud is visually gender-neutral (decided 2026-10-16). **Still open:** frame rate and battery on the reference Android device (F1), and mapping affect to cloud expression (Phase 4).

## C. Language and personality

### D-06 Native raters and authors (blocking Phase 0)
Who writes and rates the gold set for Nigerian English, Pidgin and Yoruba? Budget, number of people (minimum 3 per language), regions and dialect areas covered, payment, and consent and welfare terms. Without this, no language claim can be made.

### D-13 Scope beyond the three requested languages
Hausa and Igbo were not requested, though several providers cover them and Nigerian users commonly speak them. Recommendation: not in v1, but keep the architecture language-agnostic.

### D-07 Persona details
Name (Tolesh), voice character (age range, accent, energy), default intensity of humour, forms of address (for example whether "oga/boss" are defaults), and whether any default roast is allowed (recommendation: none; all opt-in).

### D-21 Responsive width baseline (recommended; awaiting your acceptance)
Sources disagreed: the frontend-ui-engineering skill tests at 320 px; the repository AGENTS.md at the base commit (`c5e83ca`) and the GenSpark AGENTS.md both said "responsive down to 375px".
- **Options:** (a) 375 px minimum; (b) 320 px no-horizontal-scroll floor with 360-390 px mobile-first design; (c) 320 px only.
- **Recommendation: (b).** WCAG 2.2 SC 1.4.10 Reflow requires single-column reflow at 320 CSS px with no two-dimensional scrolling, equivalent to 1280 px at 400% zoom. Designing around 360-390 px covers most current Android and iPhone portrait widths. The 320 px floor is a test minimum, not a design target.
- **Test matrix:** 320, 360, 375, 768, 1024, 1440 px, plus 400% zoom on a 1280 px window.
- **Blocks:** Phase 1 UI acceptance criteria. Does not block Phase 0.
- **Who decides:** you. Until you decide, AGENTS.md applies option (b).

### D-22 Voice presentation and configuration scope (blocking Phase 2)
The brief asks for a configurable male-presenting voice. Azure's `en-NG-AbeoNeural` is the only confirmed male Nigerian voice found (research doc section 3).
- **Options:** (a) user chooses among tested male-presenting voices only; (b) user chooses any voice tested for the language; (c) one fixed default voice, no choice.
- **Recommendation: (a).** Settings allow pitch, rate and energy adjustments within tested bounds, with no voice cloning and no voiceprints. The presentation stays male, and changing it to another presentation is not offered in v1.
- **Who decides:** you. Blocked until a provider passes the Phase 0 voice gates.

### D-23 Computer-control first scope (blocking Phase 6, and the Phase 5 design)
- **Options:** (a) browser-only actions on the web app first; (b) a per-app allow-list on the desktop (Windows and Linux) with dry-run and confirmation; (c) no computer control until a separate security review.
- **Recommendation: (c) for now, then (b).** Only after SECURITY_AND_PRIVACY_PLAN.md section 9 items 1-7 and 10 are complete and independently reviewed.
- **Who decides:** you, with the security review.

### D-17 Release thresholds
The placeholder thresholds in docs/NIGERIAN_LANGUAGE_EVALUATION_PLAN.md section 7 need your sign-off, or replacement, **before** testing starts, then locked.

### D-20 Level of Pidgin and Yoruba ambition for v1
- (a) Text understanding and replies at Experimental level if evidence allows.
- (b) Understanding only; reply in English.
- (c) Defer entirely.

Recommendation: decide after Phase 0 from evidence.

### D-24 Desktop shell engine (blocking Phase 4 desktop; new 2026-10-14)
- **Options:** (a) Tauri 2 (WebView2 on Windows, WebKitGTK on Zorin OS); (b) Electron (bundled Chromium).
- **Recommendation: (a),** with (b) as the fallback. **Approved subject to the Zorin OS compatibility test.** Third-party reports say WebKitGTK denies the microphone unless media streams are enabled and a permission handler allows it (F1 WS-D, D3). Tauri is smaller, which suits an always-running companion. The Zorin OS gate must pass before commitment: microphone capture, WebGL2, AudioWorklet and always-on-top behaviour on the actual Zorin release.
- **Who decides:** you, after the F5 gate.

### D-25 Android shell (blocking Phase 4 Android; new 2026-10-14)
- **Options:** (a) Capacitor 8 around the same web build; (b) Tauri 2 mobile.
- **Recommendation: (a), approved subject to device testing.** Tauri's Android WebView microphone path has documented problems (Tauri discussion #12732, April 2026). Capacitor is not free of such problems: a September 2026 report (tc-mobile PR #334) says Capacitor 8.5.1 denies the WebView microphone unless `MODIFY_AUDIO_SETTINGS` is also declared. That is one device report and is not verified by us. The F1 spike (E2) decides between the two manifest variants.
- **Who decides:** you (approved, conditional). Reopen if T-A-1 fails with every variant.

### D-26 Accessibility standard (new 2026-10-14)
- **Options:** (a) keep WCAG 2.1 AA as written; (b) WCAG 2.2 AA, which includes every 2.1 AA criterion.
- **Recommendation: (b).** Documents currently say 2.1 AA (ARCHITECTURE_PLAN.md §10, AGENTS.md, MASTER_IMPLEMENTATION_PLAN.md §4). Targeting 2.2 meets those requirements. Updating the wording is a separate change, made only after you approve.
- **Who decides:** you.

### D-27 Motion library (new 2026-10-14)
- **Options:** (a) CSS and the Web Animations API only; (b) `motion` (MIT) for UI transitions with CSS for micro-interactions; (c) GSAP.
- **Recommendation: (b).** GSAP is not needed for v1; its skills stay conditional. The avatar uses its own SVG controller, not a library.
- **Who decides:** you.

### D-28 Component gallery (new 2026-10-14)
- **Options:** (a) Storybook 10; (b) none.
- **Recommendation: optional, decided in phase F2.** It helps review each state, but it adds a dependency and maintenance.
- **Who decides:** you.

### D-29 Fonts and icons (new 2026-10-14)
- **Recommendation:** self-host Sora, Inter and JetBrains Mono (all OFL, verified in the UI skill's font-licence data). Use one open-licence icon set (for example Lucide, ISC). Confirm the chosen icon set's licence at ADR.
- **Who decides:** you.

## D. Process and repository

### D-11 Branch and PR workflow (recommended; awaiting your acceptance)
Two lines of work exist. See AGENT_COLLABORATION.md section 3 for details.
- `genspark_ai_developer`: planning source (PR #1 open into `main`, the skill-setup PR).
- `arena/fae714f3-tolesh-ai`: the Arena session branch, which holds the skill setup, the tool evaluation, and the reconciled planning documents.

**Recommended workflow (no merges, no rebases):**
1. **Canonical implementation line:** `arena/fae714f3-tolesh-ai`, the only branch Arena writes to.
2. **`genspark_ai_developer`:** frozen planning reference. Changes arrive only by path copy from a recorded
   source commit (see docs/PLANNING_PROVENANCE.md). Its unique history is preserved, not rewritten.
3. **`main`:** integration target only. Changed by a PR that **you** review and merge.
4. **Review:** open a PR from `arena/fae714f3-tolesh-ai` into `genspark_ai_developer` (or into `main` after
   PR #1 is resolved) for review. Do not merge it in this session. Leave the branch in place after merge.
5. **Conflicts:** an agent stops and reports a conflict. It never resolves one silently or force-pushes.
6. **Per-task check:** fetch origin and compare `genspark_ai_developer` before starting work.

Open sub-question: should PR #1 be closed, or retargeted to `arena/...` after review? That decision is yours.

**Nothing has been merged, rebased or overwritten.**

### D-12 Budget
Provider trial costs, rater payments, GPU hosting, counsel. Needed to scope Phase 0.

### D-15 Licence compliance
If using N-ATLaS (user cap and same-licence derivatives) or NaijaVox (behavioural restrictions), confirm that the licence fits the intended use. Decide before relying on either.

## Decision order (suggested)

1. D-11 (so work is not duplicated or lost), D-01, D-06, D-12, D-05.
2. D-17 and D-20 once Phase 0 begins.
3. D-02, D-03, D-04, D-19 after Phase 0 results.
4. D-07, D-08, D-09, D-14, D-10, D-16, D-18 before Phase 1 finishes.
5. D-21 before Phase 1 UI acceptance criteria are written. D-22 before Phase 2. D-23 before Phase 5 design.
6. D-24, D-25, D-26, D-27, D-28, D-29 before the F1 spikes (docs/FRONTEND_IMPLEMENTATION_PLAN.md §10). D-24 and D-25 are confirmed by their gates.
