# Planning document provenance

This file records where each planning document came from and how it was reconciled. It is the audit trail for the path-copy procedure in AGENT_COLLABORATION.md section 3.4.

## Sources

| Item | Value |
|---|---|
| Planning source branch | `genspark_ai_developer` |
| Source head used for this reconciliation | `469ba8a` (commit message "docs: add Nigerian cultural intelligence, language and companion-personality planning") |
| Source base shared with Arena | `c5e83ca` (`chore(skills): add project-level frontend design, engineering, and motion skills`) |
| Arena head before this reconciliation | `a18e7fb` |
| Arena commit containing this reconciliation | Recorded in the git history of `arena/fae714f3-tolesh-ai` (the commit that adds this file). The final SHA is reported in the handoff. |
| Method | `git show origin/genspark_ai_developer:<path>` written to the working tree, then committed on Arena. No merge, rebase, cherry-pick or branch checkout. |

## Files

Source blob = the `genspark_ai_developer` blob ID at `469ba8a`. Arena blob = the working-tree blob at the time this file was written, so later edits will change it.

| File | Source blob | Arena blob (at write time) | Transfer and reconciliation |
|---|---|---|---|
| `AGENT_COLLABORATION.md` | 9ee3e3e | 9f81b54 | reconciled (section 3 rewritten for the Arena branch; sections 1-2 and 4-9 unchanged) |
| `ARCHITECTURE_PLAN.md` | 1e37b24 | 0d491a9 | reconciled (voice configuration bullet added in 3.9) |
| `DEVELOPMENT_ROADMAP.md` | 74086ea | d588032 | reconciled (Phase 0 decision list aligned with OPEN_DECISIONS decision order; D-21 and D-22 items added) |
| `MASTER_IMPLEMENTATION_PLAN.md` | f361452 | be47a10 | reconciled (Phase 0 decision reference, quality bar, document map, new sections 10-11) |
| `OPEN_DECISIONS.md` | 9f14c27 | 7312599 | reconciled (D-11 workflow recommendation; new D-21, D-22, D-23; decision order) |
| `SECURITY_AND_PRIVACY_PLAN.md` | 1dfac80 | 1dfac80 | verbatim |
| `docs/MEMORY_AND_PERSONALIZATION_SPEC.md` | 13aa9aa | 13aa9aa | verbatim |
| `docs/NIGERIAN_LANGUAGE_AND_SPEECH_RESEARCH.md` | b0ded22 | b0ded22 | verbatim |
| `docs/NIGERIAN_LANGUAGE_EVALUATION_PLAN.md` | 662b4c0 | 662b4c0 | verbatim |
| `docs/PERSONALITY_AND_EMOTION_SPEC.md` | 15a7c60 | 4e128c0 | reconciled (voice block added to the persona example in section 8) |
| `AGENTS.md` | 047f5d2 | 6bb3586 | reconciled by hand from genspark AGENTS.md (core requirement block kept) and Arena AGENTS.md (skill routing and branch rules kept); responsive rule and git rules updated |
| `docs/development-tools-evaluation.md` | n/a (Arena-only) | a9a1571 | Arena-only file; genspark reference replaced; installation gate added |

## Conflicts and decisions

- No Arena-only edits were overwritten. The Arena AGENTS.md was rewritten on purpose and both branch versions of it are preserved in their commits.
- The GenSpark copy of `skills-lock.json` still lists five stale pointer entries. The Arena version removed them. The Arena version was kept, and the planning documents do not depend on the entries.
- The base commit and GenSpark `AGENTS.md` both said responsive "down to 375px". The `frontend-ui-engineering` skill tests at 320 px. Resolved as D-21 (recommended), applied in AGENTS.md.
- Decision-order conflict: the roadmap said Phase 0 would resolve D-01 to D-06, while OPEN_DECISIONS.md said D-02, D-03 and D-04 follow Phase 0 results. The roadmap and master plan now follow OPEN_DECISIONS.md.
- Branch workflow D-11 is recommended, not accepted. No branch was merged or changed.

## Re-sync rule

When `genspark_ai_developer` changes, repeat AGENT_COLLABORATION.md section 3.4. Record the new source head here. Do not overwrite a reconciled file unless the change is a clear, reviewed update to the same text.


## Request P ports (2026-10-19)

Source branch: `origin/genspark_ai_developer`. Source head read this session: `b5f5e71`.
Arena base before these ports: `0b35807`. Method: see the deviation note below.

Port commits, in order, with the source commit each one came from. The table lists every
path a port commit touched. Blob IDs are short git blob hashes; "HEAD" is the Arena
branch at the time this table was written.

| Source → Arena commit | Path | Source blob | Arena blob (HEAD) | Status |
|---|---|---|---|---|
| `4d5a1ce` → `fb5e4b8` | `server/src/index.js` | `be5b860` | `508feea` | Arena-edited after port |
| `4d5a1ce` → `fb5e4b8` | `server/src/request-abort.js` | `ec43553` | `ec43553` | identical to source |
| `4d5a1ce` → `fb5e4b8` | `server/test/abort-wiring.test.js` | `1213adf` | `1213adf` | identical to source |
| `7596f5d` → `3b78c64` | `web/e2e/verify-settings.mjs` | `57a5a5c` | `a990676` | Arena-edited after port |
| `7596f5d` → `3b78c64` | `web/src/main.ts` | `b29b917` | `f0749d3` | Arena-edited after port |
| `7596f5d` → `3b78c64` | `web/src/settings.test.ts` | `4180ff0` | `4180ff0` | identical to source |
| `7596f5d` → `3b78c64` | `web/src/settings.ts` | `69ecf94` | `69ecf94` | identical to source |
| `7596f5d` → `3b78c64` | `web/src/speech-queue.test.ts` | `63c565a` | `67e518a` | Arena-edited after port |
| `7596f5d` → `3b78c64` | `web/src/speech-queue.ts` | `fab304c` | `24b550e` | Arena-edited after port |
| `7596f5d` → `3b78c64` | `web/src/styles.css` | `c0c7f32` | `c0c7f32` | identical to source |
| `14df0ff` → `fc934b9` | `web/e2e/verify-reconnect.mjs` | `ddcbb99` | `3377059` | Arena-edited after port |
| `14df0ff` → `fc934b9` | `web/src/main.ts` | `9c24b5b` | `f0749d3` | Arena-edited after port |
| `14df0ff` → `fc934b9` | `web/src/reconnect.test.ts` | `b9d2cb2` | `b9d2cb2` | identical to source |
| `14df0ff` → `fc934b9` | `web/src/reconnect.ts` | `4df08d9` | `4df08d9` | identical to source |
| `e37be3d` → `c719bd6` | `docs/FEATURE_AUDIT.md` | `41bbe80` | `ea1ff22` | identical to GenSpark tip (later GenSpark commit) |
| `240c60e` → `5097baf` | `.agents/skills/spec-miner/SKILL.md` | `54a922e` | `54a922e` | identical to source |
| `240c60e` → `5097baf` | `.agents/skills/spec-miner/references/analysis-checklist.md` | `2986b34` | `2986b34` | identical to source |
| `240c60e` → `5097baf` | `.agents/skills/spec-miner/references/analysis-process.md` | `d918aba` | `d918aba` | identical to source |
| `240c60e` → `5097baf` | `.agents/skills/spec-miner/references/ears-format.md` | `6de8a9e` | `6de8a9e` | identical to source |
| `240c60e` → `5097baf` | `.agents/skills/spec-miner/references/specification-template.md` | `f250074` | `f250074` | identical to source |
| `240c60e` → `5097baf` | `.claude/skills/spec-miner` | `044014b` | `044014b` | identical to source |
| `240c60e` → `5097baf` | `docs/JARVIS_REFERENCE_ANALYSIS.md` | `836900b` | `dcf6b22` | identical to GenSpark tip (later GenSpark commit) |
| `74112e8` → `bba27fb` | `docs/OVERNIGHT_REPORT.md` | `2d90626` | `2d90626` | identical to source |
| `b5f5e71` → `66d58eb` | `docs/FEATURE_AUDIT.md` | `ea1ff22` | `ea1ff22` | identical to source |
| `b5f5e71` → `66d58eb` | `docs/JARVIS_REFERENCE_ANALYSIS.md` | `dcf6b22` | `dcf6b22` | identical to source |
| `0453a14` → `(not ported: code)` | `web/src/speech-queue.test.ts` | `bf0d08f` | `67e518a` | Arena-edited after port |
| `0453a14` → `(not ported: code)` | `web/src/speech-queue.ts` | `6aa85e1` | `24b550e` | Arena-edited after port |
| `0453a14` → `(not ported: code)` | `web/src/spoken.test.ts` | `641e6b7` | `absent` | not ported (duplicate speech path) |
| `0453a14` → `(not ported: code)` | `web/src/spoken.ts` | `29f3776` | `absent` | not ported (duplicate speech path) |

**Deviation (recorded).** Port commits `fb5e4b8`, `3b78c64`, `fc934b9`, `c719bd6`,
`5097baf`, `bba27fb`, `66d58eb` were made with `git cherry-pick`. `AGENT_COLLABORATION.md`
section 3.4 says path copy only, with no cherry-pick. The commits are unpushed. Options are
in `docs/OPEN_DECISIONS_REQUEST_P.md` (D-P9).

**Not ported by design.** `0453a14` `web/src/spoken.ts` and `spoken.test.ts`: Arena already
has one speech path (`speech-text.ts` plus the queue with watchdog). The test cases of
`spoken.test.ts` were ported as `web/src/speech-behaviour.test.ts` and run against Arena's
queue (commit `1037fac`).

**Arena commits that are not ports, in this request:** `13b4b62`, `8c00062`, `0b35807`,
`c463eb8`, `1037fac` (test and small fix), `601d55d` (verify.sh), `e250b37` (portable e2e
scripts). See `docs/BRANCH_COMPARISON.md`.
