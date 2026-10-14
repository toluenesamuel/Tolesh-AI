# Tolesh Master Implementation Plan

Status: **plan only. No application code exists and none should be written until the user approves the open decisions that block it.**

## 1. Product statement

Tolesh is a personal AI companion and authorised digital assistant with a natural, male-presenting personality, built with Nigerian cultural and linguistic awareness, for web, Windows, Zorin OS/Linux and Android.

Nigerian language ability, cultural intelligence and personality are **core requirements that shape the architecture**, not features added after the frontend.

## 2. Document map

| Document | Purpose |
|---|---|
| **MASTER_IMPLEMENTATION_PLAN.md** (this) | Scope, capability tiers, principles, what ships first |
| ARCHITECTURE_PLAN.md | Components, interfaces, data flow, degradation policy |
| DEVELOPMENT_ROADMAP.md | Phases, gates, and exit criteria (no dates) |
| SECURITY_AND_PRIVACY_PLAN.md | Threats, NDPA/GAID considerations, provider governance, agency safety |
| OPEN_DECISIONS.md | Decisions the user must make, with options and blocking effect |
| AGENT_COLLABORATION.md | How agents and humans work in this repo, and claim discipline |
| docs/NIGERIAN_LANGUAGE_AND_SPEECH_RESEARCH.md | What providers do and do not support (evidence-graded) |
| docs/PERSONALITY_AND_EMOTION_SPEC.md | Persona, Situation Gate, emotional expression, roasting rules |
| docs/MEMORY_AND_PERSONALIZATION_SPEC.md | Privacy-controlled memory and personalisation |
| docs/NIGERIAN_LANGUAGE_EVALUATION_PLAN.md | Scenarios, metrics, release gates |
| AGENTS.md | Always-read agent briefing and skill routing |

## 3. Guiding principles

1. **Honest capability.** Say what has been tested. A language "supported" in a vendor list is not "supported" by Tolesh until it passes our gates.
2. **Mirror, don't perform.** Language and tone follow the user and the moment. No forced Pidgin or slang.
3. **Immediate context beats history.** Memory sets a ceiling for banter and never triggers it. A Situation Gate runs before every reply.
4. **Cultural understanding, not stereotyping.** Context is offered as an option the user can overrule.
5. **Expression, not pretence.** Tolesh expresses designed emotion and never claims to feel. He never guilt-trips and never stays hostile.
6. **The user controls tone and memory.** Stop requests are absolute and persistent. Everything remembered is visible, editable and deletable.
7. **Replaceable providers.** Every model and speech service sits behind an adapter and a measured capability record.
8. **Privacy by default** and **safe agency last**.

## 4. Capability tiers for the first version

The user asked which capabilities can be delivered first, which need research, and which depend on third parties. This is the honest sorting. "Deliverable" means *buildable with known techniques*, **not** "will work well in Pidgin/Yoruba", which is only known after testing.

### Tier 1: deliverable in the first version (within our control)

| Capability | Notes |
|---|---|
| Text conversation in **Nigerian English** | Within frontier LLM strengths; still evaluated |
| Persona framework: config, Situation Gate, post-checks | Our code and prompts; effectiveness measured by the evaluation plan |
| Mirror-the-user language policy and "ask, don't guess" for unknown slang | Behavioural; testable |
| Teasing/roasting controls: opt-in, topics, intensity, absolute stop | Our logic |
| Memory with full user controls (view/edit/disable/delete/export), local-first | Our code |
| Provider adapters, registry, capability manifest with `untested` default | Our code |
| UI shell with orb and the state and affect machine, reduced-motion equivalents, accessibility | Skills already installed support design; orb tech undecided |
| Evaluation harness and the seed gold set | The first thing built |
| Honest status display ("Experimental", "Not supported") | Our code |
| Privacy basics: no secrets in clients, no raw audio retention, event-only logs | Our code |

### Tier 2: possible in the first version only if testing passes (depends on third parties)

| Capability | Depends on |
|---|---|
| **Pidgin text**: understand and reply | A frontier or open LLM's actual Pidgin ability. No benchmark found, so we must measure it. Launch as **Experimental** if it scrapes through |
| **Yoruba text**: understand and reply | Same. The only human evaluation we found rated Yoruba weakest (2.69/5 for a Nigerian-built model) |
| **Code-switching (text)** | Same. The best-known Nigerian open model lists limited code-switching handling |
| **Nigerian-English voice** (speak and listen) | Azure lists an en-NG male voice; ASR quality on Nigerian speech and latency untested |
| **Male-presenting voice** | Only one confirmed male Nigerian voice (Azure en-NG-Abeo, English) |
| **Barge-in and low-latency turn-taking** | Provider streaming support and our measurements |

### Tier 3: needs further research before committing (unknown feasibility)

| Capability | Open question |
|---|---|
| **Pidgin voice** (ASR+TTS) | No verified provider. Claims by small vendors only |
| **Yoruba voice** | TTS tone correctness and naturalness are poor in the evidence found; ASR accuracy is self-reported by small projects |
| **Spoken code-switching** | ASR and TTS both weak spots |
| **Prosody-based gate** (detecting mood from voice) | Unproven, privacy-sensitive; likely out |
| **Language and Context Pack** (native-speaker reviewed) | Needs native reviewers and a budget |
| **Slang drift handling** | Needs a sustainable correction loop |
| **Expressive TTS** (laughter, exasperation) | Depends on provider controls, and may sound uncanny |
| **Avatar with face** | Design and effort; optional |

### Tier 4: later phases (high risk, not v1)

Floating assistant per platform, **screen awareness**, **computer task execution**, wake word, always-on listening, Android and Windows/Linux packaging specifics, sync across devices. These need platform research and the security gates in SECURITY_AND_PRIVACY_PLAN.md section 9.

### Explicitly out of scope for v1

Voice cloning, voiceprints/speaker ID, romantic or sexual roleplay (D-08), engagement hooks, autonomous actions without confirmation, Hausa/Igbo (not requested; see D-13).

## 5. What third parties determine

- Whether Pidgin and Yoruba **voice** exist at acceptable quality (ASR, TTS).
- LLM fluency in Pidgin, Yoruba and code-switching, and its safety behaviour in those languages.
- Latency, pricing, data retention, training-on-data, region and licence terms.
- Licence limits on community models (e.g., the 1,000-user cap on N-ATLaS).

We reduce this dependence with adapters, fallbacks and our own harness, but we **cannot manufacture capability a provider lacks**. If a language fails the gate, Tolesh says so and uses text or English.

## 6. Quality bar

- Release gates in docs/NIGERIAN_LANGUAGE_EVALUATION_PLAN.md section 7, with hard-fail ledger.
- WCAG 2.1 AA, reduced-motion equivalents for every state, keyboard operability.
- Real-browser and real-device testing before any UI claim. No claim without evidence (AGENT_COLLABORATION.md section 5).

## 7. Risks (top)

| Risk | Mitigation |
|---|---|
| Pidgin/Yoruba quality poor | Evaluation first; tier labels; text fallback |
| Joke at a serious moment | Gate, conservative defaults, hard-fail metric, red-team |
| Caricature or stereotyping | Mirror rule, native rater review, Language and Context Pack |
| Provider data terms unsuitable | Governance gate before real data |
| Legal exposure (NDPA) | Counsel review before public release; adult-only decision |
| Scope explosion (agency features) | Phases and gates; v1 is conversation |
| Native-rater availability | Decide budget early (D-06) |

## 8. Definition of done (per phase)

See DEVELOPMENT_ROADMAP.md exit criteria. A phase is done only when its gates pass **and** the evidence is committed (test outputs, support-matrix update).

## 9. What happens next

1. User answers the blocking decisions in OPEN_DECISIONS.md (D-01 to D-06 first).
2. Build the evaluation harness and seed set (Phase 0). This needs no UI and no stack decision beyond a scripting language.
3. Run the shortlisted providers, fill the support matrix, and use the results to set v1 language scope.
4. Only then, with explicit approval, start Phase 1 implementation.
