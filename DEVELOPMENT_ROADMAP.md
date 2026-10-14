# Tolesh Development Roadmap

Status: **plan**. Phases are ordered by dependency and risk, **not by date**. No time estimates are given because none can be defended yet. Sizes (S/M/L) are rough effort guesses only. No phase starts without explicit user approval. Phases 0-1 have no external dependency beyond provider accounts.

Legend: **Gate** = must be true before the next phase. **Evidence** = what must be committed to claim completion.

## Phase 0: Decisions and evaluation foundation (no product UI)

Goal: learn what is actually possible before building around assumptions.

| Work | Size |
|---|---|
| Resolve blocking decisions D-01 to D-06 (OPEN_DECISIONS.md) | S (user) |
| Recruit native-speaker raters and authors: Nigerian English, Pidgin, Yoruba (D-06) | M |
| Author the seed gold set (docs/NIGERIAN_LANGUAGE_EVALUATION_PLAN.md sections 4-5), kept private | M |
| Build the offline evaluation harness and provider adapters (ASR, LLM, TTS) | M |
| Obtain provider terms, DPAs and data-handling facts for each shortlisted provider | M |
| Run the baseline; fill the support matrix; log unsupported expressions | M |
| Counsel consultation on NDPA applicability (D-01) | S |

**Gate:** support matrix filled with real results; v1 language scope set from evidence; provider data terms known for any provider that will see real data.
**Evidence:** harness code, run outputs, support matrix, limitations note.

## Phase 1: Text companion (web)

Goal: a working text conversation with the persona, controls, and honest status. Nigerian English is the primary language. Pidgin and Yoruba text appear only at the tier the evidence supports.

| Work | Size |
|---|---|
| Choose stack and platform approach (D-02, D-03) and record in an ADR | S |
| Design system and orb/avatar direction approved (uses installed skills; user approval required) | M |
| Orchestrator: turn loop, language router, Situation Gate, persona composer, post-checks | L |
| Provider registry and capability manifest wired to the adapters | M |
| Memory broker and store with the full "What Tolesh remembers" screen | L |
| Teasing and roast controls with absolute stop | M |
| UI: transcript, state and affect indicators, reduced-motion equivalents, accessibility | L |
| Status display: Supported / Beta / Experimental / Not supported per language | S |
| Persona regression suite wired to the harness | M |
| Real-browser and accessibility testing | M |

**Gate:** evaluation gates passed for each language labelled above "Not supported"; zero hard fails; accessibility checks passed; deletion verified end to end.
**Evidence:** test reports, screenshots/recordings from real browsers, updated support matrix.

## Phase 2: Voice, Nigerian English first

Goal: natural spoken conversation where evidence allows.

| Work | Size |
|---|---|
| Streaming ASR integration with language hints, confidence handling, transcript confirmation | M |
| TTS integration with a tested male-presenting voice | M |
| Barge-in, VAD, latency instrumentation, p50/p95 targets set from baseline | L |
| Mic indicator and permission flows; no raw audio retention | M |
| Orb driven by speech amplitude and state | M |
| Voice persona tests (S16/S17) and latency gate | M |

**Gate:** voice quality and latency meet the locked thresholds; privacy gates for voice met (SECURITY_AND_PRIVACY_PLAN.md section 12).
**Evidence:** listening-test results, latency data, provider terms on file.

## Phase 3: Pidgin and Yoruba voice (conditional)

Goal: add voice only for languages and providers that clear both ASR and TTS gates, including Yoruba tone correctness.

| Work | Size |
|---|---|
| Re-run provider evaluation (the landscape moves; includes any new Nigerian providers) | M |
| Diacritisation step for Yoruba TTS input, if needed | M |
| Per-language voice enablement, status labels and fallbacks | M |
| Code-switching voice tests | M |
| Optional: fine-tune or self-host an open model, with a licence check (e.g., N-ATLaS caps; NaijaVox restrictions) | L, may be infeasible |

**Gate:** each language and mode that is enabled has passing results and a published limitations note. Languages that fail remain text-only.
**Evidence:** support matrix rows.

## Phase 4: Desktop and Android, floating assistant

| Work | Size |
|---|---|
| Packaging for Windows, Zorin OS/Linux, Android per D-03 | L |
| Floating or overlay assistant, one module per platform, researched for limits (Wayland/X11, Android overlay policy) | L |
| Platform audio and permission handling | M |
| Performance and battery tests on mid-range Android and modest PCs | M |

**Gate:** per-platform test passes; performance within budgets; no regression in persona gates.

## Phase 5: Screen awareness (high risk)

Prerequisites: SECURITY_AND_PRIVACY_PLAN.md section 9 items 1-7 and 10 complete (consent, visible indicator, stop control, redaction of sensitive fields, threat model).

| Work | Size |
|---|---|
| Per-platform capture research and prototypes | L |
| On-device-first processing; consent per use | L |
| Sensitive-content redaction and exclusion zones | L |
| Threat-model review; prompt-injection tests | M |

**Gate:** independent review; no capture without visible indicator and consent.

## Phase 6: Computer task execution (highest risk)

Prerequisites: Phase 5 gates plus the full security section 9 list.

| Work | Size |
|---|---|
| Action framework: allow-listed actions, dry-run, step confirmation, action log | L |
| Kill switch and rate limits | M |
| Platform automation research (Windows UI automation, Linux, Android accessibility) | L |
| Red-team for prompt injection through screen/web content | M |

**Gate:** independent security review; confirmation required for destructive actions; stop works in all states.

## Cross-cutting, continuous

- Regression evaluation on every provider, persona, prompt, or language-pack change, and on a schedule.
- Native-speaker review of the Language and Context Pack and slang updates.
- Provider terms re-check on change.
- Field correction events fed back into the gold set.
- Documentation of unsupported expressions and provider limitations.

## What could change this roadmap

- Phase 0 results showing Pidgin or Yoruba text is below the gate: the language ships as Experimental or is deferred.
- A provider emerging (or failing) for Pidgin/Yoruba voice.
- Legal advice that restricts the data flows assumed here.
- Budget or rater availability constraints.
