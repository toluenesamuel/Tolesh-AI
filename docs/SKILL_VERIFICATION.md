# Skill verification report

Date: 2026-10-14. Scope: `.agents/skills/` (18 directories), `AGENTS.md`, `CLAUDE.md`, `skills-lock.json`, and `docs/skill-setup.md`.
Method: read-only. Files were read, frontmatter was parsed, relative references were resolved, and the lockfile was compared with the directories. No skill was installed, no installer or remote script was run, and no new network fetch was made for this report.

## 1. Summary

| Question | Answer |
|---|---|
| Are the skill files present and complete? | **Yes.** All 18 directories contain a `SKILL.md` with valid YAML frontmatter. Each `name` matches its directory. Descriptions are present (`motion-design` uses a YAML block scalar, which is valid). Relative references resolve. |
| Are they in the lockfile? | **17 of 18.** `ui-ux-pro-max` has no entry. |
| Can Arena discover and activate them? | **Not verified.** This session has no skill registry or activation tool, so the only observable mechanism is reading files. `AGENTS.md` routes the agent to them by instruction. Native activation must not be claimed. |
| Does the lockfile prove integrity? | **No.** The `computedHash` values do not equal a plain SHA-256 of `SKILL.md` for any entry. The algorithm is not documented in the repository, so the hashes cannot be checked. |
| Anything broken? | Two provenance errors in the `AGENTS.md` routing table (fixed in this change, §5). No broken files. |
| Anything missing for the frontend plan? | Voice and audio, WebGL orb, Tauri and Capacitor, XState, and Playwright/axe testing. See §4. These need approval before any installation. |

## 2. Skill-by-skill table

Columns: local files; frontmatter `name` matches directory; lockfile entry and source; frontend relevance; activation status. "Activation" is always **not verified at platform level**; the instruction-routing column records whether `AGENTS.md` routes to it.

| Skill | Local files | Frontmatter OK | Lock entry (source) | Frontend relevance | Routed in AGENTS.md | Activation |
|---|---|---|---|---|---|---|
| `ui-ux-pro-max` | SKILL.md, data/, scripts/ | Yes | **Missing** | Design-system research; stack data (see §4) | Yes (design system) | Not verified |
| `frontend-design` | SKILL.md, LICENSE.txt | Yes | Yes (anthropics/skills) | Visual direction, anti-template rules | Yes | Not verified |
| `frontend-ui-engineering` | SKILL.md (uses `.agents/references/accessibility-checklist.md`) | Yes | Yes (addyosmani/agent-skills) | Component architecture, responsive, a11y | Yes | Not verified |
| `fixing-accessibility` | SKILL.md | Yes | Yes (ibelick/ui-skills) | WCAG review fixes | Yes | Not verified |
| `baseline-ui` | SKILL.md | Yes | Yes (ibelick/ui-skills) | Baseline UI rules | Yes | Not verified |
| `design-motion-principles` | SKILL.md, references/, workflows/ | Yes | Yes (kylezantos/design-motion-principles) | Motion principles; first stop for motion | Yes | Not verified |
| `motion-design` | SKILL.md, director/, patterns/, reference/ | Yes (block scalar) | Yes (LottieFiles/motion-design-skill) | Timing and choreography | Yes | Not verified |
| `fixing-motion-performance` | SKILL.md | Yes | Yes (ibelick/ui-skills) | Motion performance review | Yes | Not verified |
| `animation-performance` | SKILL.md | Yes | Yes (emilkowalski/skill) | Motion performance | Yes | Not verified |
| `emil-design-eng` | SKILL.md (674 lines) | Yes | Yes (emilkowalski/skill) | Motion and interaction detail (supplementary) | Yes | Not verified |
| `animate` | SKILL.md, RECIPES.md | Yes | Yes (emilkowalski/skill) | Motion recipes (supplementary) | Yes | Not verified |
| `review-animations` | SKILL.md, STANDARDS.md | Yes | Yes (emilkowalski/skill) | Motion review (supplementary) | Yes | Not verified |
| `improve-animations` | SKILL.md, AUDIT.md, PLAN-TEMPLATE.md | Yes | Yes (emilkowalski/skill) | Motion audit (supplementary) | Yes | Not verified |
| `gsap-core` | SKILL.md | Yes | Yes (greensock/gsap-skills) | Only if GSAP is adopted | Yes, conditional | Not verified; not needed for v1 |
| `gsap-timeline` | SKILL.md | Yes | Yes (greensock/gsap-skills) | Only if GSAP is adopted | Yes, conditional | Not verified; not needed for v1 |
| `gsap-react` | SKILL.md | Yes | Yes (greensock/gsap-skills) | Only if GSAP is adopted | Yes, conditional | Not verified; not needed for v1 |
| `gsap-performance` | SKILL.md | Yes | Yes (greensock/gsap-skills) | Only if GSAP is adopted | Yes, conditional | Not verified; not needed for v1 |
| `gsap-utils` | SKILL.md | Yes | Yes (greensock/gsap-skills) | Only if GSAP is adopted | Yes, conditional | Not verified; not needed for v1 |

Also present: `.agents/references/accessibility-checklist.md` and `LICENSE.addyosmani`, both used by `frontend-ui-engineering`. `CLAUDE.md` is a short pointer to `AGENTS.md`; it is readable and correct.

## 3. Duplicates and overlaps

- **Motion cluster (8 skills).** `design-motion-principles`, `motion-design`, `emil-design-eng`, `animate`, `review-animations`, `improve-animations`, `animation-performance`, and `fixing-motion-performance` overlap. `AGENTS.md` already designates primary and supplementary skills. Nothing is removed. Removing any of them needs your approval.
- **Accessibility.** `fixing-accessibility`, `baseline-ui`, and the checklist in `frontend-ui-engineering` overlap. Acceptable: they are complementary.
- **Design direction.** `ui-ux-pro-max` and `frontend-design` both give design guidance. `AGENTS.md` sets an order (research first, then direction) and the brief overrides both.
- **Duplicate installs:** none found. There is one copy of each skill directory.

## 4. Missing or incompatible for the frontend plan

**Coverage gaps (checked in the local `ui-ux-pro-max` data):**
- `stacks/react.csv` exists and returns results for React performance and accessibility. No Vite stack file exists. The only Tailwind stack file is `html-tailwind.csv`. No React Aria entry was found.
- `stacks/threejs.csv` exists, but its query for orb and glow returned no matches.
- `ux-guidelines.csv` returned no matches for "voice assistant orb".
- `styles.csv`'s "AI-Native UI" style suggests a neutral base with a single `#6366F1` (AI purple) accent. This conflicts with the brief, and `AGENTS.md` already says the brief overrides skill defaults. The overlap is recorded here so it is not applied by accident.
- `google-font-licenses.json` lists Sora, Inter, JetBrains Mono and Space Grotesk as OFL (active). It also lists Orbitron, a cyberpunk default that the plan avoids.
- `data-provenance.json` shows the UI data generated 2026-08-13. It is within the 90-day `needs-review` window (62 days old on 2026-10-14).

**Capabilities with no local skill (need approval before any installation):**
- Voice and audio pipeline (AudioWorklet, VAD, barge-in).
- WebGL2 orb shader.
- Tauri 2 and Capacitor shells, including the Zorin OS and Android gates.
- XState state machine.
- Playwright and axe testing beyond `fixing-accessibility`'s guidance.
- Vite, TanStack, React Aria and Tailwind 4 specifics.
- Security review: the `claude-security` plugin from the upstream reviewed in the earlier audit is a Claude plugin with its own telemetry and install path. It is not installed and would need a separate decision.

**Incompatibilities:** none in the local files. Host-specific plugins (Claude marketplace) are unsupported in this session. Framework-specific skills (GSAP, React) are conditional on the stack decision.

## 5. Recommended fixes

Only fixes that are necessary are listed.

| # | Problem | Fix | Status |
|---|---|---|---|
| F-1 | `AGENTS.md` routing table attributes `design-motion-principles`, `motion-design`, `animation-performance`, and `fixing-motion-performance` to podo, but the lockfile records kylezantos, LottieFiles, emilkowalski and ibelick. | Correct the Source column to the lockfile sources. | **Done in this change.** |
| F-2 | `AGENTS.md` does not warn that UI-skill stack and voice coverage is partial, or that its AI-purple default is overridden. | Add a short note under the routing table. | **Done in this change.** |
| F-3 | `ui-ux-pro-max` has no lockfile entry. | Adding an entry needs its integrity hash, and the hash algorithm is unknown. Creating one now would invent an integrity claim. Leave as a documented gap. | Not changed. Needs your decision if you want locked integrity. |
| F-4 | The `computedHash` algorithm is undocumented, so the 17 hashes cannot be checked. | Do not regenerate them. Ask the upstream owners, or accept that the lockfile records sources only. | Not changed. Needs your decision. |
| F-5 | No local skill for voice, WebGL, Tauri, Capacitor, XState or Playwright. | Install only after the stack is approved, and after reviewing each upstream's installation instructions and licence. | Not changed. Needs approval. |

Not recommended now: removing overlapping motion skills, or installing new ones. Both need your approval first.

## 6. What this report does not establish

- It does not show that Arena discovers or activates any skill. Only file reads were possible in this session.
- It does not verify that the upstream files are unchanged since the earlier byte-for-byte check. That check covered only `frontend-design` and `frontend-ui-engineering`.
- It does not verify the output quality of the UI skill's suggestions. Its outputs are inputs to the plan, not decisions.
- It does not verify WCAG conformance of any design. Contrast ratios in the plan were calculated, not tested in a browser.
