# Nigerian Language and Speech Provider Research

Research date: 2026-10-14. Method: web search plus reading primary pages (model cards, vendor docs, papers).
**No audio was listened to, no provider API was called, and nothing here was tested by us.**
Provider facts go stale quickly. Re-verify before any decision, and record `verified_on` in the provider manifest (see ARCHITECTURE_PLAN.md).

## Evidence grades

| Grade | Meaning |
|---|---|
| **[V]** | Read in a primary source (model card, official docs, paper abstract) this session |
| **[A]** | Author or vendor self-reported numbers; small or unaudited; not independently reproduced |
| **[M]** | Marketing claim only |
| **[S]** | Seen only in a search snippet; page not read |
| **[?]** | Not found / could not verify |

## 1. Bottom line

1. **Nothing we found demonstrates natural, reliable Nigerian Pidgin or Yoruba conversation end to end** (understanding, replying, listening and speaking). Every capability below is a candidate to test, not a feature to promise.
2. **Yoruba is the weakest link.** The only human evaluation of a Nigerian-built LLM rated Yoruba lowest (2.69/5 vs 4.21/5 for English) [V]. A 2026 study found only 2 of 4 Yoruba TTS systems produced intelligible speech [V].
3. **Pidgin has the least official support.** It is absent from the supported-language list of the N-ATLaS model card [V], and absent from the Azure and Gemini TTS language lists we searched [V]. It is claimed by YarnGPT's site [M] and several small vendors [S].
4. **Nigerian-accented English is the best-supported tier.** Azure lists en-NG neural voices, including a male voice, `en-NG-AbeoNeural` [V]. Quality is untested.
5. **General-purpose ASR (Whisper large-v3) tends to "correct" Nigerian dialect words into standard English** (e.g. "dey"→"they") [A]. Fine-tuned open models report large gains but on small, self-reported tests [A].
6. **No independent benchmark of frontier LLMs on Pidgin, Yoruba or code-switching was found.** The pages that looked like leaderboards were a submission form or search snippets. We must run our own evaluation (see NIGERIAN_LANGUAGE_EVALUATION_PLAN.md).

## 2. Speech recognition (ASR)

| Candidate | Languages | What we read | Limits |
|---|---|---|---|
| **Whisper large-v3 (zero-shot)** | Multilingual | [A] A single-author benchmark (500 samples, 5 speaker groups): raw WER 35.05% overall. 23.5% of its non-faithful errors were dialect words rewritten as standard English | **Language was forced to `en` for all samples. The "Yoruba" and "Pidgin" groups are speaker backgrounds, not Yoruba-language speech. This is not evidence about Yoruba ASR.** Small samples, no confidence intervals, rule-based classifier not validated by humans |
| **Fine-tuned Whisper (same author, private)** | Nigerian English/Pidgin | [A] 8.30% WER (500 samples); 7.11% on the 160 clean held-out samples | Weights and audio private, cannot be reproduced. 68% of the test set overlapped training. In-domain only |
| **NaijaVox-2.0 (Axiveri)** | Yoruba (with diacritics), Hausa, Igbo, Pidgin, Nigerian English | [A] Self-reported WER: Pidgin 14.7%, Nigerian English 19.6%, Yoruba 22.3% (50 samples per language, strict WER, no normalisation). Whisper-large-v3 + LoRA, open weights | The Yoruba test set is FLEURS, and FLEURS is also in the training mix, so verify split separation. Datasets differ per language, so the numbers are not comparable across languages. Apache-2.0 **plus binding behavioural restrictions** (no non-consensual surveillance, etc.). ~1.5B-parameter base, so GPU hosting; not on-device. Community model, bus-factor risk |
| **N-ATLaS ASR models (Awarri / FG Nigeria)** | Yoruba, Hausa, Igbo, Nigerian English | [V] Terms mention four ASR models | Details not read. Terms list "limited handling of code-switching" and "degraded performance in noisy environments" as known limits. See licence cap in section 4 |
| **Azure Speech (en-NG)** | Nigerian English | [V] `en-NG` appears in the speech-to-text and custom-speech tables (page parsed as flattened text, so exact feature columns not confirmed) | No Yoruba, Hausa, Igbo or Pidgin entries found on the page. Quality on Nigerian speech untested |
| **ElevenLabs Scribe** | "90+ languages" | [M] | Could not confirm whether Yoruba or Pidgin are in the STT list |
| **Spitch** | Yorùbá, Igbo, Hausa, Swahili, more | [M] Docs: TTS, STT, translation, diacritics | Pidgin, voices, pricing and terms not read (voices page failed to load) |
| 9jaLingo, ajala.ai, Intron Sahara, others | Various | [S] | Not investigated |

**Takeaway:** a candidate shortlist for a trial is Whisper large-v3 (baseline), NaijaVox-2.0, Azure en-NG, Spitch, and one frontier multimodal model. None is known to be good enough for Yoruba or Pidgin.

## 3. Text-to-speech (TTS)

| Candidate | Languages | What we read | Limits |
|---|---|---|---|
| **Azure Neural TTS** | Nigerian English | [V] `en-NG-AbeoNeural` (male), `en-NG-EzinneNeural` (female), Standard | No Yoruba/Pidgin/Hausa/Igbo found. Quality untested |
| **Google Gemini TTS** (`gemini-3.8-flash-tts` as named in docs) | "130+ languages", language auto-detected | [V] Table includes Hausa (both tiers), Igbo (Flash only, not Flash-Lite), Nigerian Fulfulde | `Yoruba` and Pidgin **not found** in the table text. Quality and tone handling untested |
| **ElevenLabs Eleven v3 / v4** | Includes Yoruba (`yo`) and Hausa (`ha`) in language lists | [V] Listed under the v3 and v4 model sections; not in Flash v2.5 (32 languages) or Multilingual v2 (29) | Pidgin not found. Whether Yoruba is natural or **tone-correct** is untested. Latency of v3/v4 for conversation unknown |
| **YarnGPT (product)** | English, Pidgin, Yorùbá, Ìgbò, Hausa; "16 voices" | [M] Site says "every voice speaks all 5 languages fluently" | Marketing. API terms, licence, latency, SLA not read. Studio UI shows a 1,000-character limit |
| **YarnGPT-local (open)** | Yoruba, Igbo, Hausa only (not Pidgin) | [V] ~10 voices including `yoruba_male2`; "experimental purposes" | Model card admits: **ignores intonation → mispronunciations**, audio sometimes very fast, "doesn't respond to some prompts". Sample code uses beam search (likely too slow for live conversation: untested) |
| **Meta MMS-TTS (yor)** | Yoruba | [V] Named in the 2026 study as intelligible | Voice variety, gender, expressiveness unknown |
| **Spitch** | Yorùbá, Igbo, Hausa | [M] | As above |

**Study to remember [V]:** *Evaluating Yoruba TTS for Accessible Computer-Based Testing* (AfricaNLP 2026): of four Yoruba TTS systems, only `mms-tts-yor` and YarnGPT were intelligible. Five visually impaired students preferred Braille and human narration; TTS ranked last as "robotic and unclear". n=5, an exam-content context, and it is unclear which YarnGPT version was tested, so treat it as a warning rather than a verdict.

**Male-presenting voice:** the only confirmed male Nigerian voice is Azure's English `en-NG-AbeoNeural` [V]. YarnGPT-local lists a male Yoruba voice [V]. Everything else is unconfirmed.

## 4. Language models (LLM)

| Candidate | What we read | Limits |
|---|---|---|
| **N-ATLaS LLM** (Llama-3 8B fine-tune; Awarri / Nigerian Federal Ministry) | [V] Languages: English, Hausa, Igbo, Yoruba. Human eval (1–5): English 4.21; Hausa 3.98; Igbo 3.87; **Yoruba 2.69** (fluency 2.71). Bias/fairness: Yoruba 2.23, Hausa 1.11 (n=140). Context ~8k tokens | **Pidgin not in supported languages** (BBC Pidgin was only a synthetic-data source). Terms: **1,000 active-user cap, then a commercial licence needed; derivatives must use the same licence; "not enterprise-grade"**; lists "limited handling of code-switching" as a known limit. Evaluators and rubric details not read |
| **Frontier general LLMs (Gemini, GPT, Claude families)** | [S] A blog snippet says Gemini handles Yoruba/Hausa/Igbo and generates Pidgin with variable quality | **No benchmark found.** Needs our own test. Also need each provider's data-retention and training policy |
| **DataLens Africa "LLM leaderboard"** | Page fetched was a model-submission form | No usable data. Do not cite rankings seen in snippets |

## 5. Cross-cutting problems

1. **Code-switching** is explicitly listed as a weak point by N-ATLaS's own terms [V], and is hard for ASR (one utterance, multiple languages). Test it separately from monolingual speech.
2. **Pidgin has no single standard spelling.** Standard WER against English-style references penalises correct transcription ("pipo" vs "people") and rewards "correcting" dialect to English. We need a dialect-aware metric: score faithful variants as correct and count normalisation of dialect words as an error (method borrowed from the benchmark in section 2 [A]).
3. **Yoruba tone marks.** Meaning and pronunciation depend on tones and diacritics. Users usually type without them, and ASR output may or may not include them. TTS likely needs diacritised input. We need a diacritisation step or provider support (Spitch advertises one [M]) and a tone-error metric. A search snippet suggested ASR error can be lower on tone-marked text [S]; check this ourselves.
4. **Slang drifts fast.** Model knowledge will lag. Unknown slang must trigger a clarifying question, never a confident guess. A user-taught glossary (consented, editable) is the sustainable answer.
5. **Contamination.** FLEURS and other public sets are in many training mixes. Our test set must be written fresh by native speakers and kept private.
6. **Latency and hosting.** Open models of 1.5–8B parameters need GPUs. No latency figure exists for any candidate in conversational use. Measure time-to-first-audio and barge-in stop time ourselves.
7. **Licences constrain product choices.** N-ATLaS caps users at 1,000 and requires same-licence derivatives. NaijaVox forbids certain uses. Check each before depending on it.
8. **"Supports language X" ≠ "good at language X."** A language appearing in a docs list says nothing about naturalness, tone or code-switching.

## 6. Not investigated or not verified

- Pricing, quotas and data-processing terms for any provider (needed for the NDPA analysis in SECURITY_AND_PRIVACY_PLAN.md).
- Data residency and cross-border transfer posture of each provider.
- Real-time / full-duplex speech-to-speech APIs and their Nigerian-language coverage.
- Spitch voices, Pidgin support and terms; YarnGPT API terms; 9jaLingo; ameboGPT; Intron; ajala.ai.
- The N-ATLaS ASR models' accuracy and the human-evaluation protocol.
- Whether Gemini or ElevenLabs STT supports Yoruba or Pidgin.
- Independent reproduction of any [A] number.

## 7. Recommended next research actions (cheap, before any build)

1. Build the evaluation harness and a small native-speaker-written seed set (see NIGERIAN_LANGUAGE_EVALUATION_PLAN.md).
2. Run each shortlisted provider through it; record results in the support matrix; store audio only with consent.
3. Obtain written terms and DPAs from the 2–3 providers that survive.
4. Re-run this research document every time a provider is added or a decision is revisited.
