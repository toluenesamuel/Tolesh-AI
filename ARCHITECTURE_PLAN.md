# Tolesh Architecture Plan

Status: **plan, not implementation.** Nothing is built and no stack is chosen. Where this document says "proposed", the user decides (see OPEN_DECISIONS.md).

Related: docs/NIGERIAN_LANGUAGE_AND_SPEECH_RESEARCH.md, docs/PERSONALITY_AND_EMOTION_SPEC.md, docs/MEMORY_AND_PERSONALIZATION_SPEC.md, docs/NIGERIAN_LANGUAGE_EVALUATION_PLAN.md, SECURITY_AND_PRIVACY_PLAN.md.

## 1. Architectural drivers

1. **Language, culture and personality are core, not a layer added later.** They shape the data model, provider interfaces, UI states and test strategy from the first commit.
2. **Providers are replaceable.** Research shows no provider is proven for Pidgin or Yoruba, and the landscape is moving. Every model and speech service sits behind an interface with a measured capability record.
3. **Honest capability.** The system knows what it has tested and tells the user what it cannot do, rather than faking fluency.
4. **Privacy by default.** Local-first memory, minimal data to providers, visible capture, and user-controlled deletion.
5. **Cross-platform:** web, Windows, Zorin OS/Linux, Android, with different capabilities per platform (floating overlay, screen capture, computer control).
6. **Safe agency.** Screen awareness and computer control are high-risk and are added last behind explicit permissions, a visible indicator and a stop control.

## 2. System overview (logical)

```
                          ┌────────────────────────────────────────────┐
  Client (per platform)   │  UI shell: orb/avatar, transcript, controls │
  web / desktop / Android │  State machine: idle→listening→thinking→…   │
                          │  Audio I/O, VAD, barge-in, local memory     │
                          └───────────────┬────────────────────────────┘
                                          │  typed events (WS/HTTP)
                          ┌───────────────▼────────────────────────────┐
  Orchestrator            │  Session manager · Turn loop · Policy      │
  (server or on-device)   │  Situation Gate · Persona composer         │
                          │  Language router · Memory broker           │
                          └──┬──────────┬───────────┬────────────┬─────┘
                             │          │           │            │
                      ┌──────▼───┐ ┌────▼─────┐ ┌───▼──────┐ ┌───▼──────────┐
                      │ ASR      │ │ LLM      │ │ TTS      │ │ Tools/Agent  │
                      │ adapter  │ │ adapter  │ │ adapter  │ │ (later)      │
                      └──────────┘ └──────────┘ └──────────┘ └──────────────┘
                             ▲          ▲           ▲
                      Provider registry + capability manifest (tested status)
                      Evaluation harness (offline) runs the same adapters
```

## 3. Components

### 3.1 Client shell
- Renders the orb/avatar and transcript; owns the **conversation state machine** (`idle`, `listening`, `thinking`, `speaking`, `acting`, `error`, `muted/offline`) and a separate **affect layer** (`neutral`, `warm`, `amused`, `curious`, `concerned`, `playful-annoyed`, `excited`, `calm-serious`).
- State and affect arrive as **typed events** from the orchestrator. The UI never decides emotion itself.
- Handles mic capture, voice-activity detection, and **barge-in** (stop TTS on user speech).
- Stores local memory (see 3.7) and settings.
- Every state has a text label and a non-colour cue, plus a reduced-motion equivalent (see docs/PERSONALITY_AND_EMOTION_SPEC.md).

### 3.2 Orchestrator
- Runs the turn loop: receive input → language detection → Situation Gate → memory retrieval → persona composition → model call → post-checks → TTS → events.
- Placement is an open decision: remote service (simplest, shared across clients), on-device (private, limited by model size), or hybrid.

### 3.3 Language router
- Per message and per utterance, detects language mix with a confidence score (Nigerian English / Pidgin / Yoruba / other).
- Chooses the **reply language** by the mirror rule, **capped by the tested support tier** of the active providers. Example: a user speaks Yoruba, Yoruba ASR is Experimental, so Tolesh transcribes, shows the transcript for confirmation when confidence is low, and replies in text or a best-supported language and says so.
- Never claims fluency it has not verified.

### 3.4 Situation Gate
- Classifies the immediate situation G0-G4 (docs/PERSONALITY_AND_EMOTION_SPEC.md section 3) **before** the persona is composed.
- Implementation options to evaluate: a dedicated small classifier, a structured LLM call, or rules plus an LLM. It must be testable independently and tuned conservatively (an under-serious error costs more than an over-serious one).
- Output: `{gateLevel, confidence, signals[]}`; low confidence defaults to the more serious level.

### 3.5 Persona composer
- Builds the system prompt from: fixed truths, persona config, gate level, language policy, active stop flags, and relevant memory.
- Persona version is stamped on each turn for reproducibility and evaluation.
- A **post-check** screens drafts against hard-fail rules (humour at G0/G1, off-limits roast topics, stereotyping, literal-emotion claims, guilt-tripping) and regenerates or downgrades. A post-check is a safety net, not a substitute for a good prompt and gate.

### 3.6 Provider adapters and registry
Interfaces (names illustrative):

```ts
interface AsrProvider {
  id: string; transcribe(stream, opts: { languageHint?: string[], codeSwitch?: boolean }): AsyncIterable<AsrResult>;
}
interface LlmProvider { id: string; generate(req): AsyncIterable<Token>; }
interface TtsProvider {
  id: string; voices(): Voice[];
  synthesize(text, opts: { voiceId, language, style?, signal }): AsyncIterable<AudioChunk>;
}
```

**Capability manifest** per provider and language, **populated only from our own test results**:

```json
{
  "providerId": "example-asr",
  "capabilities": [
    { "language": "yo", "mode": "asr", "status": "untested",
      "verifiedOn": null, "testSuiteVersion": null,
      "metrics": null, "limitations": [], "dataTerms": { "retention": null, "trainsOnData": null, "region": null } }
  ]
}
```

Status values: `untested | not_supported | experimental | beta | supported`. The router and UI read status; nothing is hard-coded to a vendor. Adding or swapping a provider means writing an adapter, running the evaluation harness, and updating the manifest. No other code changes.

Fallback chains: per language and mode, an ordered list. If the top provider's status is below `beta`, the product says so (see 7.2).

### 3.7 Memory broker and store
- Local-first store on the client; optional encrypted sync is an open decision.
- Typed items (settings, suggestions, user-shared facts, language corrections), each with provenance, created/updated time, source turn, expiry, and a user-visible label.
- The broker returns **minimal relevant snippets** per turn. It enforces "preference is a ceiling" by tagging memory-derived hints as non-binding and passing the gate level along with them.
- Full delete, export, pause and per-type disable. Specified in docs/MEMORY_AND_PERSONALIZATION_SPEC.md.

### 3.8 Language and Context Pack
- Versioned data (glossary, idioms, register notes, sensitivity flags, regional notes, examples) reviewed by native speakers.
- Retrieval-augmented at turn time for relevant phrases. Contains **no** group stereotypes and has an explicit sensitivity field.
- Users can add private entries (type D memory) without changing the shared pack.

### 3.9 Voice pipeline
- **Input:** capture → VAD → streaming ASR (with language hints) → low-confidence handling → transcript shown.
- **Output:** text from LLM → sentence chunking → TTS streaming → playback; **barge-in** cancels TTS and in-flight generation.
- **Latency budget** (targets to be set after baseline measurement, not promises): time-to-first-audio, barge-in stop time, p50/p95 turn time.
- **Voice configuration (D-22, recommended):** the persona config selects a voice from the set of providers' voices that passed the tested male-presenting gate. Users adjust pitch, rate and energy only within tested bounds. No voice cloning, no voiceprints, no speaker identification. The chosen voice ID is stored per provider, and no provider receives a voice unless its manifest entry says it is tested.
- Diacritisation step for Yoruba TTS input (provider-supplied or separate), evaluated for tone correctness.
- No voiceprints or speaker ID. Raw audio is not retained by default.

### 3.10 Avatar and expression renderer
- Consumes `{state, affect, intensity, speechAmplitude}` events and maps them to orb parameters (hue shift, pulse, amplitude, edge noise). Not every emotion is a facial animation. A face is optional and an open decision.
- Renders via an approach chosen after prototype (CSS/SVG, canvas, or WebGL/shader). Must meet performance and battery limits on Android and on modest Windows/Linux hardware, and degrade gracefully (no mic permission, no WebGL, low power, reduced motion).

### 3.11 Tools and agency (later phases)
- **Screen awareness** and **computer task execution** run as separate, permissioned capabilities behind a policy layer: explicit per-capability consent, an always-visible indicator, a stop control, an action log, confirmation for destructive or irreversible actions, and allow-lists. Platform realities differ (Windows UI automation, Linux X11/Wayland constraints on screen capture and input injection, Android accessibility services and Play policy). All are research items, not v1.

### 3.12 Evaluation harness
- Offline runner that drives ASR/LLM/TTS adapters with the gold set and records metrics, timings and rater scores. It is the **first thing built** and the gatekeeper for the capability manifest (docs/NIGERIAN_LANGUAGE_EVALUATION_PLAN.md).

## 4. Data flow of one voice turn

1. Mic audio → VAD → ASR stream (language hints from settings and previous turns).
2. Transcript + confidence → Language router → low confidence: show and confirm, or ask.
3. Situation Gate classifies the turn (using text, and later prosody if tested).
4. Memory broker returns relevant snippets, which cannot override the gate.
5. Persona composer assembles the prompt.
6. LLM streams a reply. The post-check screens it. Language router confirms the reply language is within the tested tier.
7. TTS streams the audio. UI receives `speaking` + affect events.
8. User speech interrupts: TTS and generation cancel, and state returns to `listening`.
9. Corrections ("that's not what I meant", "relax") are logged as events for evaluation and may create user-confirmed memory.

## 5. Platform strategy (proposed, undecided)

Option A: **web-first PWA** + thin desktop shells (Tauri or Electron) + Android wrapper (Capacitor/TWA). One UI codebase; native capability by plugin; weakest for deep overlay, always-on-top, screen capture, input control.
Option B: **web UI + native companions** per platform for overlay and agent features.
Option C: fully separate native apps. Best capability; highest cost.

Recommendation for v1: **Option A for conversation, text and voice**, treating overlay and computer control as later platform-specific modules. Stack and framework are deliberately not chosen here. Decision criteria: orb rendering performance on mid-range Android, mic and audio latency, offline behaviour, packaging effort, maintainability by this team. See OPEN_DECISIONS.md.

## 6. Hosting and data location (open)

Pros and cons of server vs on-device depend on provider choice. Open-weight Nigerian models (about 1.5B-8B parameters) need GPUs, so they favour a server. Nigeria's data-protection rules constrain cross-border transfer; see SECURITY_AND_PRIVACY_PLAN.md. Provider region, retention and training-on-data terms are recorded in the capability manifest `dataTerms` field and **must be known before any provider receives real user data**.

## 7. Degradation and honesty policy

### 7.1 Principle
If a capability is below `beta` for the requested language/mode, Tolesh tells the user plainly and uses the best tested fallback.

### 7.2 Matrix of behaviours (initial)

| Situation | Behaviour |
|---|---|
| Voice in a language where ASR is `untested` or `not_supported` | Offer text input; say voice for that language is not supported yet |
| Reply wanted in Yoruba/Pidgin; LLM or TTS below `beta` | Reply in the best-supported language, or text-only in the requested language marked "experimental"; never auto-speak it with an untested voice |
| ASR confidence low | Show the transcript for confirmation instead of acting on it |
| Unknown slang | Ask |
| Provider outage | Fallback chain; if none, say so and offer text |

### 7.3 Status shown to users
Per language/mode: Supported / Beta / Experimental / Not supported, with test date. Users can see this in settings.

## 8. Security and privacy architecture (summary)

Detailed in SECURITY_AND_PRIVACY_PLAN.md. Key architectural rules: secrets never in clients; provider calls through the orchestrator with an allow-list and redaction; local-first memory; no raw audio retention by default; visible capture indicators; agency behind a policy layer with logs and a stop control.

## 9. Observability

Structured logs of **events, not content**, by default: state transitions, latencies, provider IDs/versions, gate levels, error codes, correction events. Content logging only with explicit consent for evaluation, with a short retention. No analytics SDK that exfiltrates transcripts.

## 10. Testing strategy (links)

- Unit and contract tests for adapters and the state machine.
- The **Nigerian-language and personality evaluation** in docs/NIGERIAN_LANGUAGE_EVALUATION_PLAN.md as a release gate for language and persona changes.
- Accessibility tests (WCAG 2.1 AA, keyboard, screen reader, reduced motion).
- Performance tests on a low-end Android device and modest Windows/Linux hardware.
- Real-browser and real-device checks before claiming UI behaviour.

## 11. Decisions this plan intentionally defers

Stack and framework, platform packaging, orchestrator placement, orb rendering technology, LLM and speech providers, sync, and whether the avatar has a face. All are tracked in OPEN_DECISIONS.md with the criteria for deciding.
