# Open Decisions

Status: **all open**. Nothing below has been decided. Items marked **blocking** stop the named phase. Recommendations are proposals for you to accept or change.

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
Not chosen. Criteria: orb rendering performance on mid-range Android, mic/audio latency, offline behaviour, packaging, maintainability, accessibility. Decide through a short prototype, recorded as an ADR.

### D-03 Platform approach (blocking Phase 1 shell, Phase 4)
- A: web-first PWA + thin desktop shells + Android wrapper.
- B: web UI + native companions for overlay/agent features.
- C: fully separate native apps.

Recommendation: A for v1 conversation; revisit for overlay and agent features.

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

### D-19 Orb rendering approach and optional face
CSS/SVG, canvas or WebGL/shader; face versus abstract orb only. Decide by prototype against performance limits.

## C. Language and personality

### D-06 Native raters and authors (blocking Phase 0)
Who writes and rates the gold set for Nigerian English, Pidgin and Yoruba? Budget, number of people (minimum 3 per language), regions and dialect areas covered, payment, and consent and welfare terms. Without this, no language claim can be made.

### D-13 Scope beyond the three requested languages
Hausa and Igbo were not requested, though several providers cover them and Nigerian users commonly speak them. Recommendation: not in v1, but keep the architecture language-agnostic.

### D-07 Persona details
Name (Tolesh), voice character (age range, accent, energy), default intensity of humour, forms of address (for example whether "oga/boss" are defaults), and whether any default roast is allowed (recommendation: none; all opt-in).

### D-17 Release thresholds
The placeholder thresholds in docs/NIGERIAN_LANGUAGE_EVALUATION_PLAN.md section 7 need your sign-off, or replacement, **before** testing starts, then locked.

### D-20 Level of Pidgin and Yoruba ambition for v1
- (a) Text understanding and replies at Experimental level if evidence allows.
- (b) Understanding only; reply in English.
- (c) Defer entirely.

Recommendation: decide after Phase 0 from evidence.

## D. Process and repository

### D-11 Branch and PR workflow (needs your answer now)
Two lines of work currently exist in the repository. See AGENT_COLLABORATION.md section 3 for details.
- `genspark_ai_developer` (this planning work, PR #1 open into `main`).
- `arena/fae714f3-tolesh-ai` (separate session, includes a different AGENTS.md and docs/skill-setup.md, and states that it should not be merged from or pushed to `genspark_ai_developer`).

Question: which branch is the canonical working line, and how should they be reconciled? **Nothing has been merged, rebased or overwritten.**

### D-12 Budget
Provider trial costs, rater payments, GPU hosting, counsel. Needed to scope Phase 0.

### D-15 Licence compliance
If using N-ATLaS (user cap and same-licence derivatives) or NaijaVox (behavioural restrictions), confirm that the licence fits the intended use. Decide before relying on either.

## Decision order (suggested)

1. D-11 (so work is not duplicated or lost), D-01, D-06, D-12, D-05.
2. D-17 and D-20 once Phase 0 begins.
3. D-02, D-03, D-04, D-19 after Phase 0 results.
4. D-07, D-08, D-09, D-14, D-10, D-16, D-18 before Phase 1 finishes.
