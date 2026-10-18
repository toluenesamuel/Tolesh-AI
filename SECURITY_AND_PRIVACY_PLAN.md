# Tolesh Security and Privacy Plan

Status: **plan**. Nothing is implemented.

> **Not legal advice.** The Nigerian-law notes below are drawn from secondary summaries (mainly ICLG's 2026 Nigeria chapter and search results for the NDPA 2023 and the GAID 2025). Section numbers were **not checked against the statute text**. Get advice from a Nigerian data-protection lawyer before collecting data from anyone other than yourself. Whether and how the law applies depends on open decisions (OPEN_DECISIONS.md D-01).

## 1. Threat and risk overview

| Area | Why it is high-risk for Tolesh |
|---|---|
| Voice and transcripts | Intimate, continuous, may capture third parties. Voice is potentially biometric |
| Companion memory | Accumulates sensitive personal detail over time |
| Third-party model/speech providers | User speech and text leave the device. Retention, training-on-data and region vary |
| Screen awareness | Captures passwords, banking, private messages, other people's data |
| Computer control | Can cause irreversible damage or be hijacked (prompt injection from on-screen content) |
| Persona | Emotional manipulation, dependency, harmful roasting |
| Secrets | API keys for providers; leakage drains money and exposes data |
| Compromised or low-quality community models | Supply-chain and licence risk |

## 2. Principles

1. **Data minimisation and purpose limitation.** Collect and send the least needed.
2. **Local-first.** Memory and settings on the user's device by default.
3. **Visible and consented capture.** Mic and screen capture are never silent, and there is an always-visible indicator.
4. **User control.** View, correct, disable, delete, export, with real deletion.
5. **Provider data terms are a gate.** No provider receives real user data until retention, training use, region and subprocessors are documented.
6. **Fail safe.** When unsure, do less and ask.
7. **No secrets in clients or in git.**

## 3. Nigerian data-protection considerations (to confirm with counsel)

From the secondary sources read this session:

- **Law:** Nigeria Data Protection Act 2023 (NDPA), signed 12 June 2023, enforced by the Nigeria Data Protection Commission (NDPC). The General Application and Implementation Directive 2025 (GAID), issued 20 March 2025 and effective 19 September 2025, replaced the earlier NDPR framework.
- **Scope:** the NDPA applies to businesses outside Nigeria that process data of people in Nigeria. A personal/household-purpose exemption exists but would not cover a product offered to other people.
- **Lawful basis and consent:** consent must be specific, informed, and as easy to withdraw as to give. Other bases exist (contract, legitimate interests and so on). Consent is a good fit for optional companion memory.
- **Sensitive personal data** includes health, religious beliefs, ethnic origin, political opinions, sex life, biometric data for identification, and more. These need additional care and explicit consent. A voice companion will encounter them in ordinary conversation, so default handling must be "do not retain".
- **Rights:** access, rectification, erasure, restriction, objection, portability, and protection from solely automated decisions with significant effects.
- **Retention:** keep only as long as needed. Reports describe an outer bound of six months after the purpose ends where no law sets a period.
- **Children:** under 18 is a child. Age verification and consent mechanisms are required if minors may use the product. Decide whether to restrict to adults (D-01, D-09).
- **Processors:** a written data processing agreement is required with providers that process personal data for you, with specified clauses, including location of processing.
- **Cross-border transfer:** transfers outside Nigeria need adequacy or other safeguards or a lawful exception. Most speech/LLM providers are abroad, so each needs a documented transfer basis. Reports indicate this is a restrictive area and the rules are evolving.
- **Registration and DPO:** may apply once you process data of more than a threshold number of people in a defined period, or sit in a listed sector. Thresholds and fees reported by ICLG; verify with counsel.
- **Breach notification** duties and **DPIA** expectations for high-risk processing (voice, screen capture, companion profiling) likely apply to a public product.
- **Other laws** possibly relevant: Cybercrimes Act (including interception, impersonation), sector rules if finance or health features are added, NCC rules on communications, and wiretapping/consent norms for recording other people.

## 4. Data inventory and handling (v1 proposal)

| Data | Where processed | Default retention | Notes |
|---|---|---|---|
| Mic audio (live) | Device → ASR provider | **Not stored**; streamed and discarded | Provider retention/training terms must be verified before use |
| Transcripts and chat text | Device; sent to LLM provider per turn | Session only unless user saves | Redaction of obvious identifiers before sending (to be designed and tested) |
| Memory (types A-D) | Device, local-first | Until user deletes; type B expires | Full control UI (docs/MEMORY_AND_PERSONALIZATION_SPEC.md) |
| Settings | Device | Until changed | Includes stop-teasing flag |
| Event logs (no content) | Device or backend | Short (to be set) | State transitions, latency, errors |
| Evaluation audio/text | Separate, consented | Per consent, short | Raters paid and informed; delete on schedule |
| Screen capture (later) | Device-only by default | Not stored; on-demand | Never sent to a provider without per-use consent and a visible indicator |
| Voiceprints / speaker ID | **Not collected** | n/a | Out of scope |

## 5. Provider governance

For every provider (LLM, ASR, TTS) record in the manifest, **before any real user data is sent**:

- Retention period; whether prompts/audio are used for training; opt-out available.
- Processing region and subprocessors; cross-border transfer basis.
- Licence terms and caps (e.g., N-ATLaS limits to 1,000 active users and needs a commercial licence beyond that and same-licence derivatives; NaijaVox adds behavioural restrictions), checked against the intended use.
- Security posture, incident contact, SLA.
- A written data processing agreement where required.

Prefer providers with zero-retention or no-training options. If none is available for a language, that language runs in a degraded or text-only mode, or is held back, rather than silently sending sensitive speech.

## 6. Secrets and credentials

- API keys live only in server-side configuration or the OS secret store, never in client bundles, source, logs or docs.
- `.env*` ignored in git (already in `.gitignore`); provide `.env.example` with names only.
- Scoped, rotatable keys; per-environment keys; spend limits and alerts; revocation runbook.
- Secret scanning in CI (pre-commit and server-side).
- The GitHub token used by this environment is never printed or committed.

## 7. Transport, storage and device security

- TLS everywhere; certificate validation; no mixed content.
- Local memory encrypted at rest using the platform keystore. Optional sync, if built, is end-to-end encrypted. This is an open decision.
- Minimal permissions per platform (mic only when needed; screen capture and accessibility services only for the agent modules, requested just in time).
- Dependency pinning and audit; software bill of materials; review of community models and licences before adoption; checksum verification of downloaded weights.

## 8. Persona, safety and wellbeing controls

- Situation Gate and post-checks (docs/PERSONALITY_AND_EMOTION_SPEC.md) are safety controls, tested as such.
- **Crisis handling (G0):** no banter, supportive language, encouraging real-world help. Local emergency and helpline resources must be **verified by a qualified Nigerian source** before shipping. Do not invent numbers.
- **No manipulation:** no guilt-tripping, engagement hooks, streaks, or "I missed you" prompts in v1.
- **Dependence safeguards:** gentle encouragement toward other support; no romantic or sexual roleplay in v1 (D-08).
- **Not professional advice:** health, legal and financial help is informational, with honest limits and encouragement to consult a professional where appropriate.
- **Honesty about being an AI** and about not experiencing emotions.

## 9. Agency safety (screen awareness and computer control, later)

Required before any such feature ships:

1. Per-capability, revocable, just-in-time consent. No "always allow" in v1.
2. **Always-visible indicator** when screen or mic is active, and an **immediate stop control** (button, hotkey, voice) that halts any action.
3. **Action log** the user can read, and confirmation before destructive or irreversible actions (deleting files, sending messages, payments, installing software, changing settings).
4. **Allow-listed** applications and actions at first, with a dry-run or step-by-step mode.
5. **Prompt-injection defence:** on-screen text and web content are untrusted data, never instructions. Instructions arrive only from the user. Actions derived from untrusted content require confirmation.
6. **Secrets protection:** detect and blur password fields, banking apps and similar. Never read these out loud or send them to a provider.
7. **Third-party privacy:** capturing screens may expose other people's data. Warn and offer exclusion zones.
8. **Platform rules:** Windows, Linux (X11 versus Wayland limits) and Android (accessibility-service policy; store review) each have constraints that must be researched, not assumed.
9. **Kill switch and rate limits** server-side.
10. Threat model and test plan written and reviewed **before** implementation.

## 10. Abuse and misuse considerations

- Voice cloning or impersonation: do not provide voice-cloning features in v1. Some provider terms forbid combining ASR output with TTS to fabricate speech attributed to real people.
- Recording others: Tolesh must not be used for covert recording. Add clear in-product guidance.
- Harmful roast content: enforced by opt-in, topic scope, intensity caps and absolute stop (docs/PERSONALITY_AND_EMOTION_SPEC.md section 7).

## 11. Incident response

Maintain a short runbook: key leak → revoke and rotate; provider incident → disable the adapter via the manifest; data breach → assess, contain, notify per the NDPA timelines confirmed by counsel; gate failure in the field (joke at a crisis) → disable humour for the affected language by config, add the case to the gold set, and review.

## 12. Security and privacy gates by phase

| Phase | Gate |
|---|---|
| Before evaluation with real people | Consent flow; rater agreements; data handling note; provider terms for eval vendors |
| Before any public or multi-user release | Counsel review; privacy notice; DPIA; DPAs with providers; cross-border basis; age policy; deletion verified end-to-end |
| Before voice features | Retention/training terms known for chosen ASR/TTS; mic indicator; no raw audio retention |
| Before screen awareness | Section 9 items 1-7 and 10 done |
| Before computer control | All of section 9 done, plus independent review |
