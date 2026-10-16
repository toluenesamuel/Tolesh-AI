# Tolesh - Agent Instructions

Tolesh is a personal AI companion and authorised digital assistant for **web, Windows, Zorin OS/Linux, and Android**.
It has a male-presenting persona, and its interface must feel **futuristic, premium, intelligent, and alive**.

Planned capabilities (design for them now, build them later):
floating assistant, animated avatar (the approved white cloud), natural voice conversation with interruption handling,
expressive listening / thinking / speaking states, screen awareness, authorised computer task execution,
user-controlled memory, and replaceable model and speech providers.

> Status: **planning only.** No application code exists. The stack has NOT been chosen.
> Do not scaffold, build, or install application dependencies until the user explicitly approves
> implementation (MASTER_IMPLEMENTATION_PLAN.md section 11, OPEN_DECISIONS.md).

## Core requirement: Nigerian cultural intelligence, languages, companion personality

Tolesh is **not a generic chatbot**. It is a personal AI companion with a natural, male-presenting
personality and Nigerian linguistic and cultural awareness (Nigerian English, Nigerian Pidgin, Yoruba,
and natural switching between them). This shapes architecture, data model, UI states and testing from
the start. It is not a later add-on.

Read before touching conversation, voice, memory, or avatar work:
[MASTER_IMPLEMENTATION_PLAN.md](MASTER_IMPLEMENTATION_PLAN.md) ·
[ARCHITECTURE_PLAN.md](ARCHITECTURE_PLAN.md) ·
[docs/PERSONALITY_AND_EMOTION_SPEC.md](docs/PERSONALITY_AND_EMOTION_SPEC.md) ·
[docs/MEMORY_AND_PERSONALIZATION_SPEC.md](docs/MEMORY_AND_PERSONALIZATION_SPEC.md) ·
[docs/NIGERIAN_LANGUAGE_EVALUATION_PLAN.md](docs/NIGERIAN_LANGUAGE_EVALUATION_PLAN.md) ·
[docs/NIGERIAN_LANGUAGE_AND_SPEECH_RESEARCH.md](docs/NIGERIAN_LANGUAGE_AND_SPEECH_RESEARCH.md) ·
[SECURITY_AND_PRIVACY_PLAN.md](SECURITY_AND_PRIVACY_PLAN.md) ·
[DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) ·
[OPEN_DECISIONS.md](OPEN_DECISIONS.md) ·
[AGENT_COLLABORATION.md](AGENT_COLLABORATION.md) ·
[docs/development-tools-evaluation.md](docs/development-tools-evaluation.md)

Non-negotiables (details in the specs):
- **Do not claim** Pidgin, Yoruba, voice, or code-switching "works" until tested and recorded.
  Provider language lists are not evidence. Status labels: Untested / Experimental / Beta / Supported / Not supported.
- **Mirror the user; don't perform.** No forced Pidgin or slang. Unknown slang: ask, never invent a meaning.
- **A Situation Gate runs before every reply.** Immediate context beats memory. No humour at crisis or serious moments.
- **Cultural context is an option the user can overrule, never a stereotype.**
- **Tolesh never claims to literally feel emotions.** No guilt-tripping, no sustained hostility.
  Playful anger is a brief beat. Teasing and roasting are opt-in with topic and intensity limits;
  a stop request is absolute and persistent.
- **Memory is user-controlled:** inspectable, correctable, disableable, deletable. No silent learning.
- **Providers sit behind adapters** with a tested capability manifest. Never hard-code a vendor.
- **Computer control and screen awareness** need explicit permission, a visible indicator, a stop control,
  and confirmation before destructive actions. They are later phases, not v1.
- AI-written Pidgin or Yoruba is **not authentic** until native speakers review it.

## Local skill instructions (project-level, in `.agents/skills/`)

Read the relevant `SKILL.md` before doing that kind of work. These files were already present at the
start of the setup audit. Arena native activation and auto-discovery are not verified; read them
explicitly as project instructions. See [the compatibility report](docs/skill-setup.md) for evidence
and limitations. No skill workflow authorises building before the user requests implementation.

| Need | Skill(s) | Source |
|------|----------|--------|
| Design system, palette, type, layout, UX rules | `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill |
| Distinctive visual direction, anti-template rules | `frontend-design` | anthropics/skills |
| Component architecture, state, responsive, a11y | `frontend-ui-engineering` | addyosmani/agent-skills |
| Motion principles and audits | `design-motion-principles` (kylezantos), `motion-design` (LottieFiles), `emil-design-eng`, `animate`, `review-animations`, `improve-animations` (emilkowalski/skill) | per `skills-lock.json` |
| Motion performance | `animation-performance` (emilkowalski/skill), `fixing-motion-performance` (ibelick/ui-skills) | per `skills-lock.json` |
| GSAP (only if chosen) | `gsap-core`, `gsap-timeline`, `gsap-react`, `gsap-performance`, `gsap-utils` | greensock/gsap-skills |
| Accessibility / baseline UI | `fixing-accessibility`, `baseline-ui` | ibelick/ui-skills |
| Avatar / character identity (the approved white cloud avatar, D-19, and its prompts) | `ai-avatar` | Pancat009/ai-avatar-skill (MIT, commit ca4ee96); see `.agents/skills/ai-avatar/SOURCE.md`. Design proposal: `docs/AVATAR_DESIGN.md` |

The inherited `skills-lock.json` records sources and hashes; it is not proof of native activation or of
which installer previously ran. Missing catalogue pointer entries were removed during the audit.
`ui-ux-pro-max` has no lockfile entry. Preserve local resources; do not run bulk upgrades or install
catalogue suggestions without reviewing their instructions, dependencies, and fit to the chosen stack.
Full per-skill verification: [docs/SKILL_VERIFICATION.md](docs/SKILL_VERIFICATION.md).

**Limits of `ui-ux-pro-max` data:** it has React and HTML-Tailwind stack files only (no Vite or React Aria file,
no Three.js or voice coverage that matched the orb or voice queries). Its "AI-Native" style suggests AI purple
(`#6366F1`); that default is overridden by the Tolesh direction below. Use the frontend plan for those areas:
[docs/FRONTEND_IMPLEMENTATION_PLAN.md](docs/FRONTEND_IMPLEMENTATION_PLAN.md).

### Skill routing and precedence

- Use `ui-ux-pro-max` for design-system research, then `frontend-design` for visual direction.
- Use `frontend-ui-engineering` for component contracts and implementation quality.
  Its shared checklist is `.agents/references/accessibility-checklist.md`.
- For motion, start with `design-motion-principles`; use `motion-design` for timing and state
  choreography, then `fixing-motion-performance` for performance review.
- Other existing motion skills are supplementary, not competing mandatory workflows.
  GSAP/React/Framer-specific examples are conditional on an approved stack; their presence does not
  install or select those runtime libraries.
- User requirements and project accessibility, privacy, and platform constraints take precedence over
  aesthetic defaults. Skill examples are illustrative, not tested production components. Adapt
  host-specific tool names to available tools; never claim browser or platform validation without
  performing it.

## How to use ui-ux-pro-max here

```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "Tolesh"
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain style|typography|ux|chart
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack <stack>
```

Its output is **input, not a mandate**. A generic query for "AI voice assistant" returns a light,
red-primary, marketing-landing-page system, which is wrong for Tolesh. Query for the product's real
character (dark, ambient, luminous, voice-first, AI-native) and override results that conflict with the
direction below. Only persist a design system (`--persist`) once the user approves a direction.

## Tolesh design direction (the brief wins over any skill default)

- **Product type:** a living companion/instrument, not a marketing site or dashboard.
  The cloud avatar is the hero element and the one memorable thing; keep everything else quiet.
- **Mood:** futuristic, premium, calm intelligence. Dark-first with a considered light theme.
- **Avoid:** generic AI purple/pink gradient wash, identical rounded SaaS cards, emoji as icons,
  scattered fade-up entrances, hover-scale on everything (see `frontend-design`, `design-motion-principles`).
- **State language** (must be visually and motion-distinct, and also readable without colour):
  `idle`, `listening`, `thinking`, `speaking`, `acting` (running a computer task), `error`, `muted/offline`.
  Model these as an explicit state machine, not ad-hoc classes.
- **Motion:** purposeful, interruptible, GPU-friendly (transform/opacity; SVG for the cloud avatar).
  Every state transition must work when interrupted mid-animation.
  Honour `prefers-reduced-motion` with a calm non-animated equivalent for every state.
- **Audio-reactive visuals** must degrade gracefully (no mic permission, no WebGL, low-power device).
- **Accessibility:** WCAG 2.2 AA (approved target; includes 2.1 AA), visible focus, keyboard-operable, captions/transcript for all voice
  output, screen-reader announcements for state changes.
- **Cross-platform:** design tokens and component contracts should be portable across web, desktop
  (Windows/Linux), and Android. Do not assume pointer-only input; floating-assistant and always-on-top
  behaviour differ per platform.
- **Trust & safety UI:** screen awareness and computer control need an always-visible indicator,
  explicit permission, a stop control, and confirmation before destructive actions.
  This is a first-class design requirement, not an afterthought.

## Engineering rules

- Follow `frontend-ui-engineering`: small reusable components, design tokens.
- **Responsive baseline (D-21, recommended, in effect until the user decides otherwise):** content must
  reflow without horizontal scrolling at **320 CSS px** (WCAG 1.4.10) and at 400% zoom. Design
  mobile-first around **360-390 px** phone widths. Test at 320, 360, 375, 768, 1024 and 1440 px.
  The earlier "down to 375px" rule is replaced: 375 px stays as a test width and design reference, and the 320 px floor is the reflow minimum.
- Verify in a real browser before claiming a UI works.
- Never commit secrets. Use environment variables; keep `.env*` out of git.
- Do not install tools or skills unless compatibility, permissions and installation safety are established
  (see docs/development-tools-evaluation.md).

## Git and branch rules (decided, OPEN_DECISIONS.md D-11)

- Work only on the session branch `arena/fae714f3-tolesh-ai`. Do not switch branches, merge, rebase,
  cherry-pick across branches, force-push, hard-reset, or change remotes, permissions or authentication.
- `genspark_ai_developer` is the planning source and is read-only for this agent. Bring its planning
  changes into this branch only by path copy, recorded in docs/PLANNING_PROVENANCE.md. Report conflicts
  rather than resolving them silently.
- User preference: before starting a work task, fetch origin and check `origin/genspark_ai_developer` for
  new commits. Bring new changes into this session branch when present, preserving existing work. Review
  changes before integrating; ask before resolving ambiguous conflicts or discarding work. This check is
  performed during active work, not as background monitoring between messages.
- User preference: after completing and checking changes, commit and push them with
  `git push origin arena/fae714f3-tolesh-ai`. Report any push failure; never claim changes are pushed
  unless the command succeeds. Do not include secrets.
- Pull requests are opened for review only. Only the user decides on merging.

## Open decisions (ask the user; do not assume)

Full list with options and blocking effect: [OPEN_DECISIONS.md](OPEN_DECISIONS.md). In particular:

1. App stack and packaging (D-02, D-03, D-24, D-25). Recommendations are in docs/FRONTEND_IMPLEMENTATION_PLAN.md §11.
2. Avatar rendering (D-19, white cloud approved; device performance confirmed in F1) - drives which motion skills apply.
3. Whether to adopt GSAP, Framer Motion, or CSS-only motion (install matching skills only after deciding).
4. Voice and LLM providers, where API keys live, and the configurable male-presenting voice scope (D-05, D-22).
5. Responsive baseline acceptance (D-21) and the branch collaboration workflow (D-11).
