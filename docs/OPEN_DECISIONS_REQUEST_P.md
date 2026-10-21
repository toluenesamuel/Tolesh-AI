# Open decisions — Request P (master recovery and intelligence upgrade)

Status: **waiting for the owner.** Nothing here has been decided on your behalf.
Each item says what conflicts, what I did in the meantime, and what I recommend.

## D-P1. Pidgin by default, or mirror the user

**Conflict.** Request P says "natural Nigerian Pidgin by default, for visible and spoken
answers". `AGENTS.md` line 38 says "Mirror the user; don't perform. No forced Pidgin or slang."
`AGENTS.md` line 48 says AI-written Pidgin "is **not authentic** until native speakers review it".

**Current behaviour.** `REPLY_LANGUAGE_MODE` defaults to `mirror`. The model answers in the
language the user writes in. `pidgin` is opt-in through the env file. The browser scenario
checks that the default is `mirror`.

**Options.**
1. Keep `mirror` as the default. Pidgin stays opt-in until native-speaker review. *(recommended)*
2. Make `pidgin` the default now. This needs your explicit approval, and the `AGENTS.md`
   rule must be amended or waived in writing.
3. Pidgin only for speech output, with text mirrored. Still needs review of the Pidgin text.

**Why I recommend 1.** No native-speaker review has happened, and the eval markers are
heuristics (see `docs/AI_QUALITY_REPORT.md`). The project's own rule says not to claim
Pidgin works until it has been tested and recorded.

## D-P2. Who reviews the Pidgin

The `AGENTS.md` authenticity rule needs human native speakers. I cannot supply them. The
review needs at least two Nigerian Pidgin speakers to rate a fixed set of answers, using
the cases in `server/eval/cases.json`. Please name reviewers, or confirm that Pidgin stays
opt-in until they are found.

## D-P3. Stream interruption now shows an error (behaviour change)

Before this request, a stream that dropped mid-answer could leave the page stuck in
`thinking` with the input disabled. The server now ends the stream with an honest
`error` event (raw error text is not sent), and the browser keeps the partial text. The
client also rejects an incomplete stream (no `done`) instead of resolving it. One earlier
test was changed on purpose.

**Please confirm** this behaviour. It is covered by browser checks and unit tests.

## D-P4. Failed turns with no reply

The user's message is saved before the provider is called. The assistant reply is saved
only on success. So a failed turn leaves a question with no answer in the history.

**Options.**
1. Keep the question in history and show the error (current). The next message is sent
   with the unanswered question in context.
2. Keep it in the history for display, but leave it out of the model's context.
3. Remove unanswered questions from history entirely.

**Recommendation.** Option 1 for now. It is honest about what happened. Revisit it after
live tests show whether the extra context harms answers.

## D-P5. Desktop and browser control (Linux)

Candidates: `Roadmvn/linux-computer-use` (MIT; primary in Request P),
`Zetakai/desktop-mcp` (MIT), `rcoscali/mcp-desktop-control` (**no licence**).

**Not installed.** This would give an AI agent control of your machine. No current feature
needs it. The primary candidate's own README says desktop-application guardrails
(AT-SPI, by element name) are "planned, not available yet". Browser-only control is
available there, with human takeover and fail-closed guardrails.

**Decision needed.** Do you want any desktop control at all? If yes: browser-only or desktop
apps too? Confirm the candidate, and confirm that it runs only on your own machine.

## D-P6. Skill activation

- **Spec Miner** (`Jeffallan/claude-skills`, MIT) is in the repo at `.agents/skills/spec-miner`
  with a `.claude/skills/spec-miner` link. The file and frontmatter were checked.
  **Activation in Claude Code is not verified here.** Check it in a Claude Code session.
- **19 UI and animation skills** in `.claude/skills/` all resolve to a `SKILL.md`. File-level only.
- **EncidXVII reverse-engineering skill** is Apache-2.0 (its LICENSE file; GitHub's
  detection said `NOASSERTION`). Not installed. Say if you want it.
- **ECC, Superpowers, public-apis, api-layer, CLI-Anything, PinchTab**: not re-verified in
  this request. See `docs/development-tools-evaluation.md` and `docs/SKILL_VERIFICATION.md`.

## D-P7. Model choice

Only the Dahl adapter is wired (`providers = [dahl]`). Model choice is `DAHL_MODEL` on the
Dahl gateway. Gemini, JEV, Gonka, DeepSeek, MiniMax and GLM are **not** wired as separate
adapters, and no provider key is configured here.

**Current pin:** `deepseek-ai/DeepSeek-V4-Flash-0731`, marked provisional. It comes from
the earlier GenSpark run and has not been re-measured.

**Decision needed.** Provide a Dahl key on your machine (set it in `server/.env`; never
paste it in chat), then run `node server/eval/run.mjs`. Then decide the model from the
report. Other providers would need an adapter and a licence or access check first.

## D-P8. Public APIs

None added. Request P asks for public APIs only where there is a clear use, with auth and
licence checked first and mocks tested first. No use has been named yet.
Tell me one use case (for example, a weather or exchange-rate answer), and I will review it.

## D-P9. Ambiguous conflict: branch ports (procedure)

`AGENT_COLLABORATION.md` section 3.4 says cross-branch transfers use path copy only, not
`cherry-pick`. Seven GenSpark ports were made with `cherry-pick`. The resulting files are
byte-identical to the GenSpark source wherever Arena did not edit them later (the table is
in `docs/PLANNING_PROVENANCE.md`). The branch is not pushed.

**Options.** (a) Keep the commits and record the deviation (current). (b) Recreate the
ports as strict path copies before pushing. Option (b) takes some time and rewrites
unpushed commits. Tell me which you want.
