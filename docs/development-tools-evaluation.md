# Development tool evaluation

Date: 2026-10-14. Scope: evaluation only. No tool was installed, activated, or executed. No remote installer was run, no credentials were read or created, and no application code was written.

## Method and evidence

Each repository was cloned read-only (shallow) to `/home/user/tool-review/` outside the project, then its README, install documentation, license, and security or privacy statements were read. Package metadata was read with `npm view` (read-only registry lookup).

| Tool | Revision read | Package metadata |
|---|---|---|
| OmniRoute (`Gmagl/omniroute`) | `d6f315018af6ed59ff0df253f857ca17abad4974` | npm `omniroute` 3.8.51, MIT, Node `>=22.22.2 <23 \|\| >=24.0.0 <27` |
| Superpowers (`obra/superpowers`) | `bb92a77741419a4ab5f06e711a283343f1ada0c3` | MIT (LICENSE read) |
| Caveman (`JuliusBrussee/caveman`) | `d262ab3882952a59312ff3537cd86d894523c5ab` | npm `@caveman-ai/cli` 4.0.1, Apache-2.0, Node `>=22.13` |
| Claude Code (`anthropics/claude-code`) | `19eb0958df265ee24f59bd25163c175b4c6d4b43` | npm `@anthropic-ai/claude-code` 2.1.299; README says npm install is deprecated |
| Claude Security (`anthropics/claude-plugins-official`, plugin `claude-security`) | `641d925db5a662e72f8650cb1b7670a59dab1abc` | Plugin 0.12.0, Claude Code marketplace plugin |

Sandbox environment for comparison: Node v22.22.3, npm 10.9.8, Python 3.11.2. No `claude`, `omniroute`, or `caveman` command is present.

## Summary

| Tool | Runs inside Arena? | Needs separate host or service? | Benefit to Tolesh now | Recommendation |
|---|---|---|---|---|
| OmniRoute | Possible only as a separate local gateway | Yes: a long-running server on port 20128, with provider keys | Low now. Could later help route LLM calls, but Tolesh needs adapters it controls and tests | **Defer.** Do not add as an app dependency |
| Superpowers | No. It is a plugin for Claude Code, Codex, Cursor, and similar hosts | Yes: a supported coding-agent host | Medium for process discipline (brainstorm, plan, TDD, review). Overlaps existing `AGENTS.md` and `AGENT_COLLABORATION.md` | **Defer.** Consider only when a host is chosen. Do not copy its skills into the repo |
| Caveman | Partly: its skills could be copied, but its installer and hooks target hosts | Yes for its full value: a host agent, and an optional account for "Auto" | Low. It reduces agent output tokens, not product value. Its default telemetry and "Auto" cloud routing conflict with privacy rules | **Reject for this project.** Revisit only with telemetry off and no cloud routing |
| Claude Code | No. It is the host CLI | Yes: an Anthropic account, and an installed binary | High only if the user wants Claude Code as a coding host. It is not an Arena capability | **Optional external tool.** The user installs it on their own machine after approval |
| Claude Security | No. Installed inside a Claude Code session | Yes: Claude Code, Python 3.9+, and Anthropic model access | High later, for security review before any screen, voice, or agency code ships | **Plan for the security gate.** Install only after Claude Code is available and the user approves |

## 1. OmniRoute

- **Install:** `npm install -g omniroute` then `omniroute` (dashboard and API on `localhost:20128`). Docker, Termux, and source builds are also documented.
- **Dependencies:** very large (Next.js, Playwright, SQLite drivers, Monaco, and many more). It has a postinstall step that can write a local `.env`.
- **Security:** README states prompts are sent to whichever upstream provider is selected, credentials are encrypted at rest with AES-256-GCM, telemetry is off by default, and there is a prompt-injection guard and an opt-in credential-masking guardrail. It also exposes an MCP server and REST APIs that let a connected agent control the gateway itself, and includes a MITM/TPROXY decrypt feature. These are high-impact capabilities that would need review before use.
- **Arena compatibility:** the sandbox satisfies its Node range, but running it would be a long-lived service exposed to the preview system, holding provider keys. That is not appropriate without an explicit decision.
- **Fit for Tolesh:** Tolesh's provider decisions depend on evaluation results (see OPEN_DECISIONS.md D-05 and ARCHITECTURE_PLAN.md 3.6). A gateway would hide provider differences that must be measured per language. The provider adapter and capability manifest are a better fit.
- **Needed from user for any future install:** a decision on whether to route Tolesh through a gateway, and provider-key handling approved in `SECURITY_AND_PRIVACY_PLAN.md`.

## 2. Superpowers

- **Install:** by host. Claude Code: `/plugin install superpowers@claude-plugins-official` or the Superpowers marketplace. Codex, Cursor, Gemini CLI, Pi, Hermes, and others each have their own route. No route for Arena was found.
- **Content:** skills for brainstorming, writing plans, TDD, subagent-driven development, code review, debugging, and git worktrees. MIT licensed.
- **Security and privacy:** the plugin is prompt-driven and does not run its own network service. Its visual companion loads a logo from the Prime Radiant website, which includes the Superpowers version. It can be disabled with `SUPERPOWERS_DISABLE_TELEMETRY`, or with the host's `DISABLE_TELEMETRY` setting.
- **Arena compatibility:** not installable as a plugin here. Its SKILL files could be read as instructions, but that would duplicate the existing `AGENTS.md` process rules and risks conflicting guidance. Duplicating skills was ruled out by the brief.
- **Fit for Tolesh:** useful once a coding host is chosen. Its strict TDD and plan-first discipline matches the project's "no build until approved" rule, but the project's own collaboration rules must stay authoritative.

## 3. Caveman

- **Install:** `npx @caveman-ai/cli@latest` installs into detected agents, and writes hooks and settings. The one-liners fetch and run scripts from GitHub, and the README warns that piping them to a shell runs them unseen. Not run here.
- **Content:** shortens assistant replies, compresses tool output, and offers "Auto" model routing. It has an optional paid cloud service.
- **Security and privacy:** the CLI sends usage statistics by default (commands, token counts, a random install ID, OS, and IP address). It can be turned off with `caveman telemetry off` or `DO_NOT_TRACK=1`. With "Auto" enabled after sign-in, each request sends the latest prompt, the previous prompt, and related context to Caveman Cloud; a Caveman Cloud model routes the whole request. Its SECURITY.md also documents that a managed gateway sends repository and branch names. These conflict with Tolesh's privacy principles and its no-leak rule for user content.
- **Arena compatibility:** installer writes into agent configuration directories and hooks. Not appropriate for this session.
- **Fit for Tolesh:** the product does not benefit from terse coding-agent output. Its token claims are self-reported or from its own benchmarks; treat them as unverified.
- **Decision:** do not install. If the user wants it later for personal coding sessions, use the manual skill option with telemetry off and no cloud routing, and never on a branch that contains user data.

## 4. Claude Code

- **Install:** the README recommends `curl -fsSL https://claude.ai/install.sh | bash` on macOS/Linux, `irm https://claude.ai/install.ps1 | iex` on Windows, Homebrew, or WinGet. npm install is deprecated. **Not run.** Running a remote installer here would be an uninspected execution, which the brief forbids. Its install script was not inspected.
- **Requirements:** an Anthropic account or API access, and an interactive session. The CLI is a host for plugins and agents. It is not a library Tolesh can depend on.
- **Data:** the README links to Anthropic's data-usage policy and says feedback, including conversation data submitted with `/bug`, is collected. Users should review those policies before using it on private code.
- **Arena compatibility:** not verified. The CLI needs an interactive terminal and credentials, which this session must not handle.
- **Fit for Tolesh:** useful as an external coding assistant for the user's own machine. It is not a component of Tolesh and should not become an app dependency.

## 5. Claude Security

- **Install:** inside a Claude Code session: `/plugin install claude-security@claude-plugins-official`, then `/reload-plugins`. It requires Claude Code, Python 3.9 or newer, and a git checkout for diff-based scans.
- **What it does:** multi-agent security scans of a repository, with verification of each finding, and optional patch files. Reports (`CLAUDE-SECURITY-RESULTS.md`, `.jsonl`, `.sarif`) are written to the repository, with a `.gitignore` inside the report directory.
- **Security and privacy:** runs inside the user's session with the user's permissions, reads the repository, and its own README says the scanned code is trusted and that untrusted repositories should be scanned inside a sandbox. Findings and code are sent to the chosen Anthropic model. The plugin sends usage counts through Claude Code telemetry; `DISABLE_TELEMETRY=1` or `DO_NOT_TRACK=1` turns that off. Its SECURITY.md defines the reporting route for plugin vulnerabilities.
- **Arena compatibility:** cannot run in Arena without Claude Code. Not verified.
- **Fit for Tolesh:** high value before any feature that handles screen content, microphone audio, credentials, or computer control. `SECURITY_AND_PRIVACY_PLAN.md` section 12 requires security reviews before those features. Use it as an independent reviewer, not as the author of the code it reviews (see `AGENT_COLLABORATION.md`).

## Installation gate

A tool or plugin may be installed only when **all** of these are recorded in this file:

1. **Compatibility:** the host it needs exists and was checked (for example Claude Code on the user's machine, or Node within the tool's engine range).
2. **Permissions:** the user has approved, in writing, what the tool may read, write, execute and send over the network.
3. **Installation safety:** the official install route was read in full. Any remote script was downloaded, inspected, and then run by the user or with explicit approval. Pinned versions are recorded.
4. **Data and privacy:** the telemetry, cloud, and retention behaviour is known, and the opt-out is set before first run. No user content may flow to a service that is not approved in SECURITY_AND_PRIVACY_PLAN.md.
5. **Verification:** a post-install check proves it is installed and working. Until then it is reported as "not installed".

## Required user action (none taken)

1. Decide whether a coding host (Claude Code or another) will be used on the user's machine. Installation of any host or plugin must be done by the user or after explicit approval.
2. Decide whether to keep OmniRoute and Caveman out of the project permanently. Recommendation: keep them out for now.
3. Provide Anthropic or other provider access only through the user's own environment. Never paste keys into chat or commit them.

## Recommendations for Tolesh

- Adopt none of these five tools as application dependencies now.
- Keep the existing provider-adapter design. Do not route through a gateway by default.
- Plan Claude Security as a pre-release security gate for voice, screen, and agency work.
- Re-evaluate Superpowers' process methods after the stack is chosen.

## Not verified

- No install, startup, or functional test was run for any of the five tools.
- Vendor claims (token savings, benchmarks, user counts) were not independently reproduced.
- Remote installer scripts were not executed or fully audited.
