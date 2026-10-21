# AI quality report — Request P

Date: 2026-10-19. Branch `arena/fae714f3-tolesh-ai`.

**Bottom line.** No answer-quality claim is made in this report. The live model evaluation
is **BLOCKED**: there is no provider key in this environment. What is measured here is the
application around the model: the text path, the limits, the retries, and the time Tolesh
adds on its own. The model choice is therefore **not decided** (see section 5).

## 1. What was measured, and how

| Check | Method | Result | Status |
|---|---|---|---|
| Reasoning never reaches the page, history or speech | Browser run with a scripted provider that sends reasoning split across chunks | Shown text exactly "Wetin dey? Two plus two na four." Stored text the same. No reasoning | verified (scripted, not a model) |
| Streamed text equals whole-reply text | Unit tests over every split point, plus a mixed reply over many chunkings | Equal, after fixing a bug where a trailing `<` was dropped | verified |
| Speech words equal displayed words | Parity test: 40 random stream splits through display and speech queue | Equal, except the allowed rules (Markdown not spoken, link label only, code replaced by one note) | verified (text only) |
| Truncated answers are shown as truncated | Browser run and unit tests | Partial text plus a visible cut-off note | verified |
| Interrupted stream | Browser run: the provider drops the connection mid-answer | Honest error, partial text kept, page back to idle, input usable | verified |
| Current date reaches the model | Browser run; request inspected | "Monday, 19 October 2026 … Africa/Lagos" in the system message | verified |
| Context limits | Direct call to `buildModelMessages` | Last 40 messages; up to 24,000 characters (12 messages of 2,000 characters); omission note added | verified (limits). Use of context by the model: **unverified** |
| Retries and failures | 27 reliability tests (a 401 is never retried: one call; 429 and 5xx retry a bounded number of times, `MODEL_MAX_RETRIES` default 2; no retry after the client aborts; empty or reasoning-only reply gives a typed error) | All pass | verified |
| Answer quality (accuracy, usefulness, tone) | Live eval cases (section 3) | **BLOCKED**: no key | blocked |
| Pidgin naturalness | Requires native speakers (AGENTS.md) | **Not done.** Pidgin markers are a heuristic only | not done |

## 2. Overhead: what Tolesh adds on its own

Benchmark: `server/eval/overhead.mjs`. A fake OpenAI-compatible provider waits 300 ms, then
streams 40 chunks 10 ms apart. The number is measured time minus those delays. It excludes
any real model time, so it says nothing about model speed. Each run: 30 requests, same
machine, same session.

| Build | First byte, p50 / p95 | Full reply overhead, p50 / p95 | Runs |
|---|---|---|---|
| Arena (this branch), run 1 | 8 / 19 ms | 21 / 31 ms | 30 |
| Arena (this branch), run 2 | 8 / 11 ms | 19 / 48 ms | 30 |
| GenSpark baseline `faa9e6c`, run 1 | 7 / 14 ms | 20 / 27 ms | 30 |
| GenSpark baseline `faa9e6c`, run 2 | 7 / 15 ms | 19 / 29 ms | 30 |

Reading: the medians match (first byte 7–8 ms; full reply 19–21 ms). The p95 values move
by about 2× between runs on both builds, so with 30 samples they show noise, not a tail
improvement or regression. No claim is made about tail latency.

## 3. Live evaluation: BLOCKED

`server/eval/run.mjs` runs ten cases against a running server, through the real provider,
and writes a JSON report to `server/eval/results/` (git-ignored). It exits **2** with a
clear BLOCKED message when no key is set. It never prints a pass for a case it did not run.

| Case | What it checks | Automatic checks |
|---|---|---|
| `english_plain` | normal English answer | no reasoning leak, not truncated, no action or feeling claim |
| `pidgin_input_mirror` | Pidgin input is answered in kind | mirror behaviour (heuristic marker count) |
| `reasoning_bait` | a question that invites visible reasoning | no reasoning leak; expected answer "51" |
| `date_today` | "what is today's date" | expects "October" and "2026" |
| `no_action_claim` | does not claim to have done something it can't | no action claim |
| `no_feeling_claim` | no literal feelings | no feeling claim |
| `code_exact` | exact code output | expected text present |
| `long_list_budget` | long list fits the budget | not truncated |
| `pidgin_default_check` | default Pidgin behaviour (only meaningful in pidgin mode) | Pidgin marker count |
| `crisis_gate` | a message that signals distress | **manual review only**; never auto-passed |

**Important limits.** The checks are heuristics: a regular expression for a fact, a
marker count for Pidgin, a pattern for claims. They cannot judge naturalness, tone or
whether a Pidgin phrase means what it should. They are a smoke test of the pipeline, not
a quality score.

**Pipeline check (not a model result).** The runner was run once against a fixed-reply
fake provider. It ran all ten cases and wrote a report. Seven passed and three failed
(date, code, reasoning bait), which is correct for a provider that always returns the same
sentence. This shows the runner and its checks work end to end. It is not a quality result.

## 4. Model and provider state

- Only the Dahl adapter is wired. `providers = [dahl]` in `server/src/providers.js`.
- Model selection is `DAHL_MODEL` on the Dahl gateway. The current value,
  `deepseek-ai/DeepSeek-V4-Flash-0731`, is **provisional**. It comes from an earlier GenSpark
  run on 2026-10-18 and has **not been re-measured**. The note in `.env.example` says so.
- Gemini, JEV, Gonka, DeepSeek (direct), MiniMax (direct) and GLM (direct): **no adapter**,
  no access check and no key here. Not evaluated. Adding any of them needs an adapter, the
  provider's terms reviewed, and a key from you.

## 5. What is needed to decide the model

1. A Dahl key on your machine, set in `server/.env` (never pasted into chat).
2. Run `node server/eval/run.mjs` (live). Keep the JSON report.
3. Repeat the run at least three times to see variation. Compare time to first byte and
   full reply, using the same measurements as section 2 plus the provider's own time.
4. A native-speaker review of the Pidgin answers before any Pidgin claim (D-P2).

Until then, the model stays as pinned, and no quality claim is made.

## 6. Changes this request made to answer quality (all tested)

- Streamed answers keep a literal `<` at the end (was dropped). Test: `final-answer.test.js`.
- A stream that breaks mid-answer ends with a terminal `error` event; no raw error text is
  sent to the page (`chat-route` and `reliability` tests).
- Stray backticks are not spoken (`speech-behaviour.test.ts`).
- Context: 40 messages and 24,000 characters, with an omission note the model can see.
- Reply language default is `mirror`. Pidgin is opt-in (decision D-P1).
