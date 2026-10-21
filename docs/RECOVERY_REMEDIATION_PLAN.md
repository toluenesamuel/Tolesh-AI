# Recovery remediation plan (Phases 1 to 4)

Status: **plan only. Nothing here has been committed, pushed, rewritten or deployed.**
Date: 2026-10-21. Branch: `arena/fae714f3-tolesh-ai`.

## 1. What is true in this sandbox

| Item | Value | Source |
| --- | --- | --- |
| Local branch HEAD | `c5e83ca` (not the Request P tip `5273733`) | `git rev-parse HEAD` |
| Remote Arena branch | `f7af520` (21 commits total; `c5e83ca` is an ancestor) | `git fetch` (read only) |
| Remote GenSpark branch | `b5f5e71`; full history fetched (the clone had been shallow) | `git fetch --unshallow` (read only) |
| Request P commits (`601d55d`…`5273733`) | **Not in this `.git`.** They were lost when the clone was re-created. Their content survives only in the working tree. | `git cat-file -t` returns missing |
| Working tree vs `f7af520` | 92 added paths, 3 modified (`.gitignore`, `CLAUDE.md`, `docs/PLANNING_PROVENANCE.md`) | `/tmp/phase1-vs-f7af.txt` |
| Working-tree tree object | `9d0bd466233af4f46819a9343dea2d60e42ef379` (excludes the 2 untracked PNGs, see §3) | `git write-tree` on a temporary index |
| Backup | `/home/user/Tolesh-AI-backup-phase1-20261021-114847/Tolesh-AI-full.tar` (35 MB) | restore not yet tested |

Content check: 25 of 29 blob IDs recorded in `docs/PLANNING_PROVENANCE.md` match the files on disk exactly. The 4 non-matches are explained: `docs/FEATURE_AUDIT.md` and `docs/OVERNIGHT_REPORT.md` were edited after the table was written, and the `spec-miner` entry is a symlink. **So the content survived. The commit history did not.** Git cannot confirm the original commits any more; the evidence is the provenance document and the blob comparison.

## 2. Phase 1 finding: the seven cherry-picks

`docs/PLANNING_PROVENANCE.md` records that commits `fb5e4b8`, `3b78c64`, `fc934b9`, `c719bd6`, `5097baf`, `bba27fb` and `66d58eb` used `git cherry-pick`, which `AGENT_COLLABORATION.md` §3.4 forbids (path copy only). **Those commits no longer exist locally, so git can no longer show this.** The deviation rests on the provenance record. The file contents themselves are the same as path copies would produce (see §1).

## 3. Dry run (temporary index, no refs or working files changed)

Started from `f7af520`. Each GenSpark step copies blobs at path level, the equivalent of `git show <sha>:<path>`.

1. **Port A** (`c5e83ca..f0e3d8a`): 81 paths. Excluding the 7 conflicting paths in §4 leaves **74 paths** → tree `e0926eab3663ab0709c87c34b1f0e41ea9a62d73`.
2. **Port B** (`f0e3d8a..b5f5e71`): 22 paths, excluding `web/src/spoken.ts` and `spoken.test.ts` (not ported by decision) → tree `b0b26b35e66787e8028f66f2ef5bd877a85b6113`.
3. **Arena residual** on top of B → **42 paths** (16 added, 23 modified, 3 deleted), which reach the working-tree tree `9d0bd46…`.

Untracked `spikes/cloud-avatar/stills/states/probe-idle.png` and `probe-listening-mic-on.png` are **not** part of this work. They must stay out of any commit.

Overlap check: no path was changed by both GenSpark (Port B) and Arena since `c5e83ca`. Port A has 18 overlapping paths; see §4.

## 4. Decisions needed: 7 governance files changed on both sides

For 11 of the 18 overlapping paths, Arena and GenSpark already have identical content, so there is nothing to decide. The remaining **7 differ**, and a blind path copy would overwrite Arena's version:

`AGENTS.md`, `AGENT_COLLABORATION.md`, `ARCHITECTURE_PLAN.md`, `DEVELOPMENT_ROADMAP.md`, `MASTER_IMPLEMENTATION_PLAN.md`, `OPEN_DECISIONS.md`, `docs/PERSONALITY_AND_EMOTION_SPEC.md`.

Across these, the GenSpark version differs by 95 insertions and 279 deletions. Some changes **weaken governance text**. For example, GenSpark's `AGENTS.md`:
- removes the "male-presenting persona" requirement;
- replaces "planning only; do not build or install until the user explicitly approves" with "Do not scaffold the app until the user asks".

**Recommendation: keep Arena's versions** (the current working tree does this). Any change must be taken file by file and approved by the user. The files stay three-way (base `c5e83ca`, Arena, GenSpark) until then.

## 5. Options (need your approval)

- **A. Rebuild a clean path-copy history (recommended).** Create new commits on top of `f7af520`, using `git commit-tree` and `git update-ref` with the old value checked. Commit order: Port A (74 paths, with a message stating the GenSpark source SHA) → Port B → Arena residual split by area (server, web, e2e, docs, skills). The final tree must equal `9d0bd46…`; check it before the ref moves. Nothing is force-pushed. The old unpushed SHAs cannot be restored; the new commits will carry a note about this.
- **B. One snapshot commit** of the working tree on top of `f7af520`, with `PLANNING_PROVENANCE.md` as the audit trail. Simpler, but it is not a path copy and the cherry-pick deviation stays in the record.
- **C. Keep everything uncommitted for now.** Lowest risk of more change, but the work is exposed to loss until a commit exists.

Either way, **pushing** to `origin/arena/fae714f3-tolesh-ai` needs a separate, explicit approval.

## 6. Phase 3 result (verification)

`scripts/verify.sh` exit 0 with a real Chromium 131 (rebuilt into `/tmp`, because `/tmp` had been reset):
- server tests 84/84, smoke test 5/5 (including the honest `503 no_key`);
- web typecheck, vitest 86/86, production build;
- browser scenarios 14/14, no unexpected console errors.

Not run: live provider evaluation (no provider key in this sandbox, so **BLOCKED**).

## 7. Phase 4 result (Vercel): no deployment made

- Connector: validated. Account `olawumilase-5217`, team `olawumilase-gmailcom's projects`, Hobby plan.
- The team has **one** project, `v0-mercadotube-clone`, which is unrelated. **No Tolesh project exists.** It was not touched.
- **The backend must not be deployed publicly yet.** It has no authentication: `GET/POST/DELETE /api/conversations` and `POST /api/chat(/stream)` are open to anyone who can reach the server. CORS limits browsers only. A public deploy would expose private conversations and let strangers spend the provider keys.
- A frontend-only preview was considered and **not made**. The static build (33 KB: `index.html`, one JS, one CSS; no secrets, no `localhost`) can't be uploaded through the connector without retyping minified code, and it would show a UI with no working backend. That is not an honest deployment.
- Honest deployment needs a decision: (1) backend authentication first; (2) a host for the Express + SQLite + SSE server (not Vercel serverless as-is); (3) a same-origin rewrite from the Vercel frontend to that backend, and a test that SSE streams through it; (4) creating a new Vercel project `tolesh-ai`; (5) keeping SSO protection on previews.

## 8. Approval gate

1. Remediation: A, B or C (recommend A).
2. The 7 governance files: keep Arena (recommend) or take GenSpark per file.
3. Vercel: approve creating a `tolesh-ai` project for a *frontend-only* preview, or wait until the backend has authentication and a host.
4. Do not push or deploy until these are answered.
