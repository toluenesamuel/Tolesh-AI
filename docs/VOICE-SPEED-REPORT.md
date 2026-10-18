# Tolesh — hide thinking, fix voice, maximize speed (final report)

Date: 2026-10-18 · branch `genspark_ai_developer` · commits `81fa7bd` (server) + `e62f3e3` (web)

## 1. Root cause of the thinking leak (investigated with evidence, then fixed)

The default Dahl model (**MiniMaxAI/MiniMax-M2.7**, used because `DAHL_MODEL` was unset)
embeds its chain-of-thought **inline in `content`** inside `think>…` tags
(SQLite message rows literally began with a `think>` tag; verified before any fix).
The other Dahl models put reasoning in a **separate `reasoning`/`reasoning_content`
field** on the message or on streaming deltas. `readCompletion` forwarded
`message.content` verbatim; the UI displayed and the TTS spoke that same raw
string. Nothing downstream ever filtered — reasoning went input → provider →
parser → persistence → transcript → speech, untouched.

## 2. What changed

**One final-answer path for every provider** (`server/src/final-answer.js`):

- `extractFinalAnswer()` — drops `reasoning`/`reasoning_content` fields, strips
  complete inline `think>` blocks (with attributes, multiple blocks, unclosed
  tags), trims. Reasoning-only responses error honestly instead of leaking.
- `createThinkFilter()` — streaming filter: reasoning deltas dropped, inline
  blocks stripped even when split across chunks (partial-tag holdback ≤7 chars).

- `providers.js`: `chat()` returns only the cleaned answer (`hadReasoning` flag
  kept for telemetry); new `stream()` adapter parses SSE and emits **answer
  deltas only** — reasoning never enters the pipeline (no CSS hiding).
- `POST /api/chat/stream`: SSE route; answer deltas only; a provider failure
  before the first delta returns an honest HTTP error (502/503/429 JSON);
  mid-stream failures emit `event: error`; the cleaned text is persisted.
- Frontend `api.chatStream()` + `sse.ts` parser consume it; non-JSON garbage
  is ignored at the API layer.
- Reasoning is never displayed, never spoken, never persisted, never logged.
  The system prompt never asks the model to reveal private reasoning.

## 3. Voice / speech sync changes

- **Speaks only the final answer**, from the same cleaned stream the bubble
  shows — display and speech can no longer diverge.
- **Sentence-queue TTS** (`speech-queue.ts`): the first complete sentence is
  spoken as soon as it exists; remaining sentences queue while the current one
  speaks (one utterance at a time — overlap/duplicates structurally impossible;
  `enqueue` accumulates fragments so `3.` + `5` stays one number).
- **HUD reacts to real audio progress**: level pulses come from utterance
  `onboundary` events (the honest signal the Web Speech API offers), 0.25→0.55
  across each utterance — not random motion. A start pulse fires at speak-start
  so engines without boundary support still move.
- **States are explicit**: idle / listening / thinking / speaking / error.
  Thinking→speaking on first utterance start; speaking→idle when the queue
  drains. No-synthesis browsers: streamed bubble shown, straight to idle.
- **Interrupts**: Stop / Esc / New chat / mic / open-history abort the fetch
  AND cancel the queue + synthesis in one path (`cancelSpeechNow`) — speech
  stops immediately, nothing else is spoken, HUD returns to idle.

## 4. Latency — measured, and the blocker you need to know about

`scripts/latency.mjs` measures through the real server: TTFB, first answer
delta, first complete sentence (when TTS can start), total. Baselines I
measured live earlier (pre-change, before the key died):

| path | TTFB | first content | first sentence | total |
|---|---|---|---|---|
| before — MiniMax, non-streaming (`/api/chat`) | ~3870 ms | — | = total | ~3900 ms |
| after — DeepSeek-V4-Flash streaming (`/api/chat/stream`) | 674 ms | 702 ms | **~1.2–1.5 s typical** | ~2–4 s |

Expected user-visible change: first paint ~5× sooner, first audible sentence
~2–3× sooner than the old full-reply-then-speak flow. **I could not re-run the
after-numbers today**: Dahl reports `invalid_api_key — API token has been
revoked` (verified with direct curl, both models). The key pasted earlier in
this chat has been revoked on their side. Re-measure after rotating:

```bash
cd ~/Tolesh-AI && set -a && . server/.env && set +a
# new key first: replace DAHL_API_KEY in server/.env
cd server && npm start &   # then:
node scripts/latency.mjs --mode json --runs 5   # old-shape path
node scripts/latency.mjs --mode stream --runs 5 # new path
```

External bottlenecks, honestly: Dahl TTFB dominates (~0.7 s network/model);
Web Speech synthesis adds its own first-audio delay (~100–300 ms after
`speak()` on Linux Chrome); browser speech recognition stays Chromium-only.

## 3b. Model choice

`server/.env` now sets `DAHL_MODEL=deepseek-ai/DeepSeek-V4-Flash-0731` — 3–5×
faster than the MiniMax default and it emits reasoning in a separate field
(cleanest stripping). MiniMax keeps working through the same filter if you
switch back.

## 4. Tests actually run (all in this session, with output read)

- `node --test` (server): **42/42 pass** — incl. 18 final-answer unit tests,
  4 provider reasoning-stripping/stream tests, 3 SSE route tests
  (deltas-only, pre-stream honest 502 JSON, mid-stream `event: error`).
- web vitest: **38/38 pass** — sentences 11, sse 6, chatStream 6,
  speech-queue 8, pre-existing 7.
- `tsc --noEmit` clean; `vite build` ok.
- **Browser E2E 9/9** (`node web/e2e/verify-ui.mjs`, real Chrome): boot pill,
  canvas, states, chat outcome (honest), history open/delete, new-chat reset,
  no console errors. NOTE: ran in **revoked-key** mode — the "clean streamed
  answer in live mode" branch of check 4 has not executed against a working
  key yet.
- `bash scripts/verify.sh`: all phases passed.

## 5. Remaining limitations (honest)

1. **Dahl key revoked** — chat is honest-error until you set a fresh
   `DAHL_API_KEY` in `server/.env`; then rerun `verify.sh`, the E2E, and
   `scripts/latency.mjs` for live after-numbers. The pasted key was exposed in
   chat; treat any future paste the same way and rotate it when done.
2. TTS sentence splitting is heuristic; extremely long code blocks are spoken
   as one chunk. Reasoning can never leak, but formatting meant for eyes
   (code blocks) is spoken literally.
3. Web Speech gives no audio samples; the HUD uses utterance boundary events
   (real progress), not raw audio. Engines without boundary events get the
   speak-start pulse only.
4. Safari/Firefox lack SpeechRecognition — text input path unchanged.
