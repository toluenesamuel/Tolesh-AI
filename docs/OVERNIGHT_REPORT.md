# Tolesh — Overnight report, Request P (master recovery and intelligence upgrade)

Date: 2026-10-19 (Africa/Lagos). Branch: `arena/fae714f3-tolesh-ai`.
Earlier overnight reports: `docs/history/GENSPARK_OVERNIGHT_REPORT_SESSION2.md` (GenSpark, 2026-10-18).

Labels used below: **verified** (a run in this request), **unverified** (not checked),
**blocked** (needs something missing here), **not done**.

## 1. Summary

- Reliability and answer-text fixes are in and tested: streamed answers keep a literal `<`;
  a broken stream ends with an honest error; a stray backtick is not spoken; client
  disconnects abort the upstream call; retries are bounded.
- Speech is derived from the displayed text. A parity test over 40 random stream splits
  passes. **Speech audio is unverified.**
- GenSpark work was checked commit by commit. All eight newer commits are ported or
  deliberately left out (table in `docs/BRANCH_COMPARISON.md`). One procedure deviation
  (cherry-pick instead of path copy) is recorded, and you need to decide what to do about it.
- Browser checks run against a real server, real Vite and real Chromium. The full project
  check passes.
- **Not done:** Pidgin by default (conflicts with `AGENTS.md`), HUD refinement, desktop
  control, public APIs, and live model evaluation (no key).
- **Not pushed.** The branch has 18 unpushed commits. Pushing waits for your decision on
  the port procedure (D-P9), because a rewrite may be needed first.

## 2. Phases

| # | Phase | Status | Notes |
|---|---|---|---|
| 1 | Recover and compare branches; port GenSpark work; write `BRANCH_COMPARISON.md` | done (with deviation) | 8 newer GenSpark commits handled. Seven were cherry-picked, against `AGENT_COLLABORATION.md` §3.4 (D-P9). `0453a14` speech code not ported on purpose |
| 2 | Baseline tests, answer quality, latency | done for app-level; quality **blocked** | Overhead benchmark (section 4). No live answer-quality result |
| 3 | Reasoning leakage, response handling, voice sync | done for text; speech audio **unverified** | Fixed: `flush()` dropped a literal `<`. Checked, not reproduced: throw on reasoning-only content (returns empty, typed error). Open: failed-turn persistence (D-P4) |
| 4 | Better AI quality: provider evaluation, context, tools, retries, validation | partial | Context limits and retries verified. Provider evaluation **blocked**. Tool reliability **not done** (no tools in the app) |
| 5 | Natural Nigerian Pidgin by default | **not done** | Default is `mirror`. Conflicts with `AGENTS.md`; native review needed (D-P1, D-P2) |
| 6 | Refine JARVIS HUD and voice; avatar-free | **not done** | Not started in this request |
| 7 | Review reference repos (licence, security, patterns) | done (licence) | See section 5 |
| 8 | Verify skills before claiming activation | partial | Spec Miner files checked; 19 UI skills link-checked. Activation **unverified** (D-P6) |
| 9 | Linux desktop control | **not done** | Not installed. Needs your approval (D-P5) |
| 10 | Public APIs | **not done** | None chosen (D-P8) |
| 11 | Full testing | done | Section 3. Blocked and unverified items are labelled |
| 12 | Docs | done | `BRANCH_COMPARISON.md`, `FEATURE_AUDIT.md` (Request P section), `AI_QUALITY_REPORT.md`, this file, `OPEN_DECISIONS_REQUEST_P.md`, `PLANNING_PROVENANCE.md` |
| 13 | Final report | in chat | Same facts as this file |

## 3. Tests (run on this branch, this session)

| Suite | Command | Result |
|---|---|---|
| Server unit and integration | `node --test test/*.test.js` in `server/` | **84/84 pass** (per file: final-answer 21, reliability 27, providers 12, chat-route 7, eval-scorer 9, abort-wiring 3, store 5) |
| Full project check | `bash scripts/verify.sh` with `CHROME_PATH` set | **All phases passed**: server 84/84; live smoke (health, providers, conversation, no-key 503, persisted message); web typecheck; web 86/86 in 12 files; production build; browser 14/14 |
| Browser scenarios | `web/e2e/ui-scenarios.mjs` | **14/14 pass** (scripted provider; not a model) |
| Settings, onboarding, export | `web/e2e/verify-settings.mjs` | **8/8 pass** (ported; portable paths) |
| Auto-reconnect | `web/e2e/verify-reconnect.mjs` | **2/2 pass** (offline at boot; recovers with no reload) |
| Parity: speech vs display | `web/src/display-speech-parity.test.ts` | pass (40 random splits) |
| Speech behaviour (from GenSpark) | `web/src/speech-behaviour.test.ts` | pass (7 cases) |
| Live model evaluation | `node server/eval/run.mjs` | **BLOCKED**: no provider key. Exit 2 |
| Speech audio and recognition | — | **UNVERIFIED**: no speech engine in headless Chromium |
| `verify-ui.mjs` (older full-UI script) | — | Changed (no longer always-true checks) but **not run**: it needs a live key |

Browser runs used a Chromium binary at `/tmp/chromium`, with the system libraries it needs
at `/tmp/al2023/lib`. They are outside the repository.

## 4. Speed and overhead (fake provider; Tolesh's own time only)

Benchmark: `server/eval/overhead.mjs`, 30 runs per build, fake provider with a 300 ms
delay. Not model latency.

| Build | First byte p50 / p95 | Full reply overhead p50 / p95 |
|---|---|---|
| Arena, run 1 | 8 / 19 ms | 21 / 31 ms |
| Arena, run 2 | 8 / 11 ms | 19 / 48 ms |
| GenSpark `faa9e6c`, run 1 | 7 / 14 ms | 20 / 27 ms |
| GenSpark `faa9e6c`, run 2 | 7 / 15 ms | 19 / 29 ms |

Medians match, so there is no median regression. The p95 values vary by about 2× between
runs on both builds, so no tail claim is made. Real model speed: not measured.

## 5. Reference repositories: licence check (GitHub API, 2026-10-19)

| Repo | Licence (GitHub) | Use decided |
|---|---|---|
| `witschinger/jarvis` | **none** (no licence: all rights reserved) | Read-only analysis. No code copied. Pattern (client disconnect did not abort upstream calls) was used as a finding, implemented fresh in `fb5e4b8` |
| `Minhen96/Jarvis-Holographic-interface` | **none** | Read-only idea reference. No code copied. Its approach uses a 3D model, which the avatar-free HUD rule excludes |
| `Mann473/jarvis-ai-assistant` | MIT | Not reviewed in depth. No code copied |

## 6. Skills and tools

| Item | Licence | State in this repo |
|---|---|---|
| Spec Miner (`Jeffallan/claude-skills`, `skills/spec-miner`) | MIT | Present at `.agents/skills/spec-miner`, linked at `.claude/skills/spec-miner`. Frontmatter checked. **Activation unverified** |
| EncidXVII reverse-engineering skill | Apache-2.0 (LICENSE file; GitHub shows `NOASSERTION`) | **Not installed** |
| 19 UI and animation skills (`.claude/skills/`) | per upstream | All links resolve to `SKILL.md`. **Activation unverified** |
| `Roadmvn/linux-computer-use` | MIT | **Not installed**. Desktop-app guardrails are "planned"; control of your machine needs your approval (D-P5) |
| `Zetakai/desktop-mcp` | MIT | Not installed (same decision) |
| `rcoscali/mcp-desktop-control` | **none** | Not usable without a licence |
| ECC, Superpowers, public-apis, api-layer, CLI-Anything, PinchTab | — | Not re-verified in this request. See `docs/development-tools-evaluation.md` |

## 7. Incidents and corrections (this request)

- A bash command that wrote several files failed and wrote nothing. Re-done with single
  file writes; the eval scorer test file was then written and run.
- Test authoring mistakes, fixed: a selector that read the note bubble; a state read before
  the 2.5 s error-to-idle timer; a parity test that ignored the allowed link rule; a
  scorer test that matched the spoken note's word "code".
- The stream route bug (interrupted streams hung in `thinking`) was found by the browser
  run, not by unit tests, and fixed with two regression tests.
- A literal `<` at the end of a streamed answer was dropped. Found by comparing the stream
  and whole-reply paths over every split point. Fixed, with tests.
- A lone backtick at the end of a stream was spoken. Found by running GenSpark's speech
  cases on Arena's queue. Fixed.
- GenSpark's `verify-reconnect.mjs` started an API from another machine's home folder and
  left it running. Made portable: temp database, stopped at the end.
- GenSpark's branch moved from `f0e3d8a` to `b5f5e71` during this request. The eight newer
  commits were ported after the first snapshot (see `BRANCH_COMPARISON.md`).
- The port method deviated from `AGENT_COLLABORATION.md` §3.4 (cherry-pick). Recorded, not
  silently accepted. Decision D-P9.

## 8. Commits on the Arena branch (not pushed)

Newest first. From `f7af520` (pushed head) to `601d55d`:

```
601d55d scripts: verify.sh runs browser scenarios when CHROME_PATH is set
e250b37 web e2e: reconnect and settings scripts run anywhere (ported from GenSpark)
66d58eb docs: JARVIS analysis final (GenSpark b5f5e71)
bba27fb docs: overnight report, session 2 (GenSpark 74112e8)
5097baf docs: JARVIS reference analysis + Spec Miner (GenSpark 240c60e)
c719bd6 docs: feature audit (GenSpark e37be3d)
fc934b9 feat(web): auto-reconnect (GenSpark 14df0ff)
3b78c64 feat(web): settings panel, onboarding, export (GenSpark 7596f5d)
1037fac web: GenSpark speech cases as tests; stray backtick not spoken (0453a14 cases)
fb5e4b8 fix(server): client disconnects abort upstream calls (GenSpark 4d5a1ce)
0b35807 server: streamed answer keeps a literal '<' at end
c463eb8 web: display and speech parity test
8c00062 web: browser scenarios with scripted provider
13b4b62 server: streaming route ends with a terminal event; eval harness
7fb8fea web: speech matches the answer; interrupted and truncated replies visible
50296e9 server: reliable provider calls, token budget, truncation, date, Pidgin mode
faa9e6c port: GenSpark Tolesh app by path copy (at f0e3d8a)
dbbe34f chore: ignore runtime artifacts; document skill symlinks
```

## 9. Decisions waiting for you

See `docs/OPEN_DECISIONS_REQUEST_P.md`:
D-P1 Pidgin default · D-P2 Pidgin reviewers · D-P3 stream-interruption behaviour ·
D-P4 failed-turn persistence · D-P5 Linux control · D-P6 skill activation check ·
D-P7 model choice (needs a key) · D-P8 public API use · D-P9 port procedure and push.

## 10. Next steps, in order

1. Decide D-P9. Then push (`git push origin arena/fae714f3-tolesh-ai`) or rewrite first.
2. Set a Dahl key in `server/.env` on your machine. Run `node server/eval/run.mjs` three times.
3. Native-speaker review of Pidgin answers before any Pidgin default.
4. Check the skills in a Claude Code session to confirm activation.
5. HUD refinement (phase 6), avatar-free.
