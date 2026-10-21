# Branch comparison — `main`, `genspark_ai_developer`, `arena/fae714f3-tolesh-ai`

Date: 2026-10-19 (Africa/Lagos). Written for Request P, phase 1.
Every SHA below was read from git on this date.

## 1. The three branches

| Branch | Head | What it is | Relation |
|---|---|---|---|
| `main` | `92c4217` | `chore: initial commit`. A single scaffold commit. | Root of both feature branches. |
| `genspark_ai_developer` | `b5f5e71` | The GenSpark build: Tolesh server and web app, docs, JARVIS analysis, skills. 18 commits on top of `main`. | Source of the port. |
| `arena/fae714f3-tolesh-ai` (this session) | local `601d55d`; pushed `f7af520` | GenSpark content by path copy, plus Arena work: reliability, speech, browser tests, cloud avatar spikes, planning records. | 18 commits not yet pushed. 38 commits on top of `main`. |

Notes:
- `main` is not a product branch. Nothing from `main` needs porting.
- The GenSpark branch moved during this session: its head was `f0e3d8a` when the port
  was made, and it is now `b5f5e71`. That is why 8 newer GenSpark commits were ported
  separately (section 3).
- Commit counts by `git rev-list`: GenSpark-only 17 commits, Arena-only 37 commits, all
  unpushed Arena commits 18.

## 2. What each branch contains (paths)

| Area | GenSpark (`b5f5e71`) | Arena (local `601d55d`) |
|---|---|---|
| Server (`server/`) | Single final-answer path, SSE route, providers, persona, store, 5 test files (`abort-wiring`, `chat-route`, `final-answer`, `providers`, `store`) | Same, plus 2 test files (`eval-scorer`, `reliability`): reliable provider calls (retry on 401/5xx/timeouts; bounded), `max_tokens` budget, truncation visible, date context, Pidgin/mirror mode, stream-interruption fix (terminal event), client disconnect abort, 27 reliability tests, eval harness (`server/eval/`) |
| Web (`web/`) | HUD, streamed answers, speech queue, settings, onboarding, export, auto-reconnect | Same, plus: speech matches the displayed answer (same text path, Markdown removed for speech, code replaced by one note), watchdog for stuck utterances, interrupted/truncated replies visible, parity and behaviour tests, browser scenario suite |
| Browser e2e (`web/e2e/`) | `verify-ui`, `verify-settings`, `verify-reconnect` (hard-coded machine paths) | Same three, made portable (`CHROME_PATH`, temp DB, cleanup), plus `ui-scenarios.mjs` (14 checks, scripted provider, real server and Vite) |
| Scripts | `scripts/latency.mjs`, `scripts/verify.sh` | Same, plus `verify.sh` browser phase (BLOCKED without `CHROME_PATH`) |
| Docs | Overnight reports, feature audit, JARVIS analysis, planning docs | Same (ported), plus the Request P docs listed in section 5 |
| Skills | `.claude/skills/` links | Same links, plus `ai-avatar` (Arena, earlier request), Spec Miner (ported) |
| Spikes | none | `spikes/cloud-avatar/`, `spikes/phone-probe/` (cloud avatar prototype, HUD-probe; not integrated) |

## 3. Port status (GenSpark → Arena)

Every GenSpark commit has been checked. "Identical" means the Arena blob equals the
GenSpark blob at the source commit. "Edited" means Arena changed the file on purpose after
the port. Full per-file table: `docs/PLANNING_PROVENANCE.md`.

| GenSpark commit | Subject | Arena commit | Status |
|---|---|---|---|
| `469ba8a` … `f0e3d8a` (9 commits) | planning docs, skills, MVP build, HUD, final answer path, streamed answers | `faa9e6c` (path copy of the tree at `f0e3d8a`) | Ported by path copy. Checked: 41 of 42 files under `server`, `web`, `docs`, `scripts` are byte-identical to `f0e3d8a`. The exception is `docs/PERSONALITY_AND_EMOTION_SPEC.md`, which has one added example line from Arena's earlier planning reconciliation (`4d0035e`) |
| `4d5a1ce` | client disconnects abort upstream provider calls | `fb5e4b8` | Ported. Files identical except the `index.js` import line, which keeps Arena's `replyLanguageMode` |
| `0453a14` | speech drops fenced code and strips markdown | — | **Code deliberately not ported.** Arena has its own speech path (`speech-text.ts` + queue with watchdog). The test cases were ported as `speech-behaviour.test.ts` (`1037fac`). Running them found one real gap (a lone backtick was spoken), now fixed |
| `7596f5d` | settings panel, onboarding, conversation export | `3b78c64` | Ported. `settings.ts`, `styles.css` identical. `main.ts` and `speech-queue.ts` edited (one conflict resolved: keep both the timer hook and the rate option) |
| `14df0ff` | auto-reconnect after server outage | `fc934b9` | Ported. `reconnect.ts` and test identical. `main.ts` merged |
| `e37be3d` | feature audit | `c719bd6` | Ported. Later updated by `b5f5e71` |
| `240c60e` | JARVIS reference analysis + Spec Miner skill | `5097baf` | Ported. Spec Miner files identical |
| `74112e8` | overnight report, session 2 | `bba27fb` | Ported. Identical |
| `b5f5e71` | JARVIS analysis final, feature audit update | `66d58eb` | Ported. Identical |

**Deviation (recorded, not hidden).** Seven of these ports used `git cherry-pick`.
`AGENT_COLLABORATION.md` section 3.4 says cross-branch transfers use path copy only. The
content matches the source, and the commits are not pushed, but the method breaks the
procedure. See `docs/OPEN_DECISIONS_REQUEST_P.md`, D-P9.

## 4. Where the branches differ now (intended)

Against the GenSpark tip, the local branch differs in 42 files under `server`, `web`,
`docs` and `scripts` (3,690 lines added, 401 removed). The main reasons:

1. **Reliability (server).** Bounded retries that do not retry an aborted request; per-call
   `max_tokens`; truncation shown to the user; a 401 is not retried forever; an honest
   503 when no key is set; a terminal `error` event when a stream breaks.
2. **Answer text.** One final-answer path. Reasoning never reaches the page, history or
   speech. Verified in the browser, not only by unit tests.
3. **Speech.** Spoken text is derived from the displayed text. Same words, Markdown removed,
   code replaced by one note. Verified by a parity test over 40 random stream splits.
   Speech audio itself is **unverified** (no speech engine in headless Chromium).
4. **Context.** The last 40 messages and up to 24,000 characters are sent (verified by a
   direct call). Earlier messages are noted as omitted, so the model is told not to
   claim memory of them.
5. **Language mode.** `mirror` is the default. Pidgin is opt-in (decision D-P1).
6. **Eval harness.** `server/eval/` (cases, scorer, live runner, overhead benchmark).
   The live runner has not produced a result: no provider key is set.

Arena-side deletion to note: `.agents/skills/ai-avatar/README.md` and `README_ZH.md` were
removed in `fc6c0a5` (an earlier avatar-skill install), and `LICENSE` was renamed to
`LICENSE.txt`. That was deliberate and is not changed here.

## 5. What exists only on Arena (this request)

- `docs/BRANCH_COMPARISON.md` (this file), `docs/FEATURE_AUDIT.md` (Request P section added),
  `docs/AI_QUALITY_REPORT.md`, `docs/OVERNIGHT_REPORT.md`, `docs/OPEN_DECISIONS_REQUEST_P.md`.
- Reliability, speech and browser test work (section 4).
- Cloud avatar and phone-probe spikes (prototypes; not integrated into the app).

## 6. Not in any branch (recorded so nothing is assumed)

- Native-speaker Pidgin review (none).
- Live model evaluation (no provider key).
- Speech audio and recognition checks (no speech engine in the test browser).
- Desktop control and extra public APIs (not chosen; see the decisions file).
