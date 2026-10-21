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
| Working-tree tree object | `9d0bd466233af4f46819a9343dea2d60e42ef379` (**includes** the 2 untracked PNGs; excludes the plan file, which was written later). The payload without the PNGs and plan file is `0defc861fb0d4b962275783da6af6f2e99f05b79`. | `git write-tree` on a temporary index |
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

## 9. Option A execution record (local only, 2026-10-21)

Status: **executed locally. Not pushed. Not deployed.** Branch `arena/fae714f3-tolesh-ai`
moved from `c5e83ca` to `953f5b1` (fast-forward, `update-ref` with the old value checked).
`c5e83ca` is an ancestor, so nothing was dropped. The old tip `f7af520` is unchanged on origin.

### Environment changes found before starting (recorded, not hidden)
- The sandbox was re-created at 12:27. The clone was again shallow at `b5f5e71`, and `origin/arena` was not fetched.
- The §1 backup (`Tolesh-AI-backup-phase1-20261021-114847`) and the `/tmp` evidence files were **gone**.
  The working tree was the only copy, so a fresh backup was taken first:
  `/home/user/Tolesh-AI-backup-phase2-20261021T122747Z/Tolesh-AI-full.tar` (SHA-256 in `SHA256SUMS.txt`).
  A restore check showed it identical to the working tree. Refs before the rebuild are in `refs-before-rebuild.txt`.
- Read-only fetches restored `origin/arena` (`f7af520`) and the full GenSpark history (`f0e3d8a`).
- The working tree content matched the recorded state exactly (tree `9d0bd46…` once the plan file is excluded).

### Commit sequence (`f7af520` → `953f5b1`, 22 commits)

| # | Commit | Source | Content |
|---|---|---|---|
| A1 | `a60c476` | GenSpark `469ba8a` | path copy, 4 paths; 7 governance paths skipped (Arena kept) |
| A2 | `2ba760c` | `f17f4ff` | path copy, 30 paths; `AGENTS.md` skipped |
| A3 | `e04dd43` | `a714d60` | **no payload change** (its only change was to `AGENTS.md`, skipped). Kept so the source stays visible |
| A4 | `2c0b5e7` | `4e15650` | 28 paths |
| A5 | `475e707` | `ec8f945` | 1 path |
| A6 | `2375c94` | `e39f995` | 5 paths |
| A7 | `a572005` | `81fa7bd` | 7 paths |
| A8 | `110100a` | `e62f3e3` | 11 paths |
| A9 | `c58c1e0` | `f0e3d8a` | 1 path (end of Port A) |
| B1 | `4c6fe88` | `4d5a1ce` | 3 paths |
| B2 | `e3da5ce` | `0453a14` | 2 paths; `spoken.ts` and `spoken.test.ts` **not ported** (documented decision) |
| B3 | `5efdb38` | `7596f5d` | 7 paths |
| B4 | `44a1c1b` | `e37be3d` | 1 path |
| B5 | `ba6afb9` | `14df0ff` | 4 paths |
| B6 | `a380a46` | `240c60e` | 7 paths |
| B7 | `2719eb0` | `74112e8` | 1 path |
| B8 | `50b2fb5` | `b5f5e71` | 2 paths (end of Port B) |
| R1 | `77a84a7` | Arena | server residual, 13 paths |
| R2 | `2ec87d7` | Arena | web residual, 17 paths |
| R3 | `fe737a0` | Arena | scripts and repo config, 2 paths |
| R4 | `3f9134c` | Arena | skills and docs, 10 paths (42 residual paths in total) |
| P | `953f5b1` | Arena | `docs/RECOVERY_REMEDIATION_PLAN.md` (recovery documentation, separate) |

Every Port commit (A1–B8) uses **path copy**: each changed path is written from its source commit's blob. No cherry-pick, merge or rebase was used.

### Checks run before reporting
- **Tree comparison.** Port A (after A9) equals the earlier dry-run tree `e0926ea…`. Port B (after B8) equals `b0b26b3…`.
  The residual brings the tree to the payload `0defc861…`, which matches exactly.
- **Against the recorded tree.** Final tree versus `9d0bd466…`: the only differences are the plan file (added) and the two PNG previews (removed).
  They are not in any commit, as §3 requires. They remain untracked in the working tree.
- **Path-level check.** 103 changed paths across the Port commits all equal their source blobs. None are unexplained.
- **Governance.** No new commit touches the seven governance files. Their blobs equal the Arena versions and the working tree.
- **Spoken.** No commit touches `web/src/spoken.ts` or `spoken.test.ts`.
- **Secret scan.** The scan of every path added relative to `f7af520` found no key-like strings.
- **Working tree.** Byte-identical to the backup, excluding `.git`, `node_modules` and `dist`. `git status` shows only the two untracked PNGs.
- **`scripts/verify.sh`** (real Chromium 131, deps reinstalled from lockfiles): exit 0, all phases passed. Server 84/84, smoke 5/5, web typecheck, vitest 86/86, production build, browser 14/14 (no unexpected console errors).

### Corrections
- §1: the tree `9d0bd466…` includes the PNG previews. An earlier line in this document said it excluded them. That was wrong, and it is corrected above.
- The 94 paths that differ from `f7af520` = 95 earlier (92 added and 3 modified), minus the 2 PNGs, plus the plan file.

### Remaining risks and open items
- The **original Request P commit SHAs** (`601d55d`…`5273733`) cannot be restored. These commits are new objects with new SHAs and timestamps. The commit messages cite the GenSpark sources, and the provenance document is the link to the old commits.
- The seven cherry-picks are **not** in this history. The new history uses path copy only. Their earlier deviation stays recorded in `docs/PLANNING_PROVENANCE.md`.
- **Not pushed.** `origin/arena` is still at `f7af520`. Pushing needs separate explicit approval. A push will be a fast-forward (`f7af520` is an ancestor of `953f5b1`), so no force is needed.
- The two PNG previews are untracked on purpose. Decide whether they belong in the repo, or add them to `.gitignore`.
- The seven governance files still need a decision: keep Arena's versions (current state) or take GenSpark's per file.
- Live provider evaluation remains **BLOCKED** (no key in this sandbox).
- The Vercel decisions in §7 are unchanged. Nothing was deployed.
