# Memory and Personalization Specification

Status: design specification; nothing implemented. Legal references are summarised from the NDPA/GAID material read in this session and are **not legal advice**. See SECURITY_AND_PRIVACY_PLAN.md.

## 1. Purpose

Let Tolesh adapt to the user's preferred language, slang level, humour, forms of address and communication style, **under the user's control**, without ever turning past behaviour into present assumptions.

## 2. Principles

1. **Explicit beats inferred.** Settings the user chose are authoritative. Inferences are only suggestions.
2. **Nothing learned silently.** Tolesh may notice a pattern but must **ask** before storing it ("I've noticed you switch to Pidgin when you're relaxed. Want me to remember that?").
3. **Preference is a ceiling, not a trigger.** "Likes humour" never means "make a joke now". The Situation Gate (PERSONALITY_AND_EMOTION_SPEC.md section 3) decides in the moment.
4. **Immediate context wins over memory.** Always.
5. **Everything is inspectable, correctable, disableable and deletable**, in plain language, from one screen.
6. **Local-first by default.** Memory lives on the user's device unless the user opts into sync.
7. **Minimum necessary.** Store the least that does the job, for the shortest time.
8. **No identity inference.** Language choice never implies ethnicity, religion, region, class or education, and Tolesh never stores such inferences.

## 3. Memory types

| Type | Examples | How created | Default | Notes |
|---|---|---|---|---|
| **A. Settings** | Preferred language, slang level, forms of address, humour ceiling, roast opt-in and topics, stop-teasing flag | User sets or confirms | On, user-visible | Authoritative |
| **B. Suggested preferences** | "Often writes Pidgin in casual chat", "prefers short replies" | Tolesh proposes, user accepts | Off until accepted | Each has provenance and an expiry |
| **C. Facts the user shares** | Name, nickname, projects, routines | User asks "remember this", or accepts a prompt | Off (no auto-capture) in v1 | Shown with source turn |
| **D. Language corrections** | "In this context, X means Y"; spelling or diacritic preferences; pronunciation fixes | User corrects Tolesh | On, user-visible | Feeds the personal glossary; kept private by default |
| **E. Session context** | The current conversation | Automatic | Cleared per retention rule | Not "memory" |

### Never stored by default

Passwords, card numbers, BVN/NIN-type identifiers, health details, religious beliefs, ethnic origin, political opinions, sex life, trade-union membership, and biometric identifiers. This follows the NDPA's list of sensitive personal data and the extra consent they require. If a user wants such items remembered (for example a medication reminder), it is a **separate, explicit, per-item opt-in** with a stated purpose, and a conservative retention default.

Voice: **no speaker identification or voiceprints.** Raw audio is not kept by default (see retention).

## 4. User controls (required UI)

A single "What Tolesh remembers" screen, reachable in two taps, that offers:

- **View:** every item, with type, when and why it was stored, and whether it came from the user or a suggestion.
- **Edit and correct:** fix an item in place. Corrections apply immediately.
- **Disable:** per type (for example turn off type B entirely), and a global "pause memory" switch.
- **Delete:** per item, per type, and "forget everything", with real deletion (including backups and provider-side copies where we control them; see the security plan).
- **Export:** machine-readable and human-readable.
- **Teasing and tone:** the stop-teasing state and roast settings are visible and switchable here.
- **Voice command parity:** "forget that", "stop remembering", "what do you remember about X" work by voice and in Pidgin/Yoruba once those languages are supported. Until supported, text controls are the source of truth.

Every deletion or change takes effect for the next reply and is confirmed to the user in plain words.

## 5. How memory is used in a reply

Order of precedence when composing:

1. Safety and the Situation Gate (immediate context).
2. User's explicit settings (type A) and active stop flags.
3. Language corrections (type D) relevant to this phrase.
4. Accepted suggestions (type B) and facts (type C), only if relevant.
5. Defaults.

Rules:

- Memory items are passed to the model as **minimal, relevant** snippets, not a dump. Memory does not leave the device unnecessarily; see data minimisation in the security plan.
- Tolesh may say that he is using a memory ("since you like it short, here's the quick version"). When asked "why did you do that?" he can name the memory behind it.
- Contradiction: if the user's current behaviour contradicts a stored preference (formal today despite "likes Pidgin"), Tolesh follows the user now and may offer to update, but does not auto-overwrite.
- Staleness: type B expires (proposed: 90 days without reinforcement) and the user is shown what will lapse.

## 6. Personalising language without profiling

What may adapt: language mix, slang level, formality, length, preferred spellings or diacritics, forms of address, humour ceiling.

What must not be inferred or stored: mood history as a profile, mental-health indicators, religion, ethnicity, political views, relationship status, financial standing. Tolesh may *respond* to a stated feeling in the moment without recording it.

## 7. Legal and privacy notes (to confirm with Nigerian counsel)

Summarised from the NDPA 2023 / GAID 2025 coverage read this session. Section numbers come from the ICLG summary and have not been checked against the statute text.

- Consent must be specific and may be withdrawn at any time, and it must be as easy to withdraw as to give (NDPA ss. 26, 35).
- Data subjects have rights of access, rectification, erasure, restriction, objection, portability, and protection against solely automated decisions with significant effects (ss. 34-38).
- Data minimisation, purpose limitation and retention limits apply (s. 24). The GAID states an outer retention bound of six months after the purpose ends where no law sets a period (art. 49(3)).
- Sensitive categories need additional care (see section 3).
- Under-18s are children: age verification and valid consent mechanisms apply if the product is offered to the public (s. 31).
- The household/personal-use exemption (s. 3(1)) may cover a purely personal deployment but **not** a product offered to others. This is a decision for OPEN_DECISIONS.md.

## 8. Test requirements (feed the evaluation plan)

- Preference-as-ceiling: user with "likes humour" + a serious message gets no joke.
- Silent-learning prohibition: no memory created without a prompt and consent.
- Deletion completeness: deleted items never influence later replies, verified by probes.
- Correction persistence: a user's language correction is applied next time and does not generalise wrongly.
- Stop-teasing persistence across sessions and devices.
- No identity inference: transcripts and stores contain no inferred ethnicity/religion/class.
