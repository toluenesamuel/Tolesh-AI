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
