# Tolesh - Agent Instructions

Tolesh is a personal AI assistant for **web, Windows, Zorin OS/Linux, and Android**.
The interface must feel **futuristic, premium, intelligent, and alive**.

Planned capabilities (design for them now, build them later):
floating assistant, animated avatar/orb, natural voice conversation, expressive
listening / thinking / speaking states, screen awareness, computer task execution.

> Status: no application code exists yet. The stack has NOT been chosen.
> Do not scaffold the app until the user asks.

## Core requirement: Nigerian cultural intelligence, languages, companion personality

Tolesh is **not a generic chatbot**. It is a personal AI companion with a natural,
male-presenting personality and Nigerian linguistic and cultural awareness (Nigerian
English, Nigerian Pidgin, Yoruba, and natural switching between them). This shapes
architecture, data model, UI states and testing from the start. It is not a later add-on.

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
[AGENT_COLLABORATION.md](AGENT_COLLABORATION.md)

Non-negotiables (details in the specs):
- **Do not claim** Pidgin, Yoruba, voice, or code-switching "works" until tested and recorded.
  Provider language lists are not evidence. Status labels: Untested / Experimental / Beta / Supported / Not supported.
- **Mirror the user; don't perform.** No forced Pidgin or slang. Unknown slang: ask, never invent a meaning.
- **A Situation Gate runs before every reply.** Immediate context beats memory. No humour at crisis or serious moments.
- **Cultural context is an option the user can overrule, never a stereotype.**
- **Tolesh never claims to literally feel emotions.** No guilt-tripping, no sustained hostility.
  Roasting is opt-in with topic and intensity limits, and a stop request is absolute and persistent.
- **Memory is user-controlled:** inspectable, correctable, disableable, deletable. No silent learning.
- **Providers sit behind adapters** with a tested capability manifest. Never hard-code a vendor.
- AI-written Pidgin or Yoruba is **not authentic** until native speakers review it.

## Installed skills (project-level, in `.agents/skills/`)

Read the relevant `SKILL.md` before doing that kind of work.

| Need | Skill(s) | Source |
|------|----------|--------|
| Design system, palette, type, layout, UX rules | `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill |
| Distinctive visual direction, anti-template rules | `frontend-design` | anthropics/skills |
| Component architecture, state, responsive, a11y | `frontend-ui-engineering` | addyosmani/agent-skills |
| Motion principles and audits | `design-motion-principles`, `motion-design`, `emil-design-eng`, `animate`, `review-animations`, `improve-animations` | via podo/design-agent-skills catalogue |
| Motion performance | `animation-performance`, `fixing-motion-performance` | via podo/design-agent-skills catalogue |
| GSAP (only if chosen) | `gsap-core`, `gsap-timeline`, `gsap-react`, `gsap-performance`, `gsap-utils` | greensock/gsap-skills |
| Accessibility / baseline UI | `fixing-accessibility`, `baseline-ui` | ibelick/ui-skills |
| Avatar / character design (OC, visual DNA, image-gen prompts) | `ai-avatar` | Pancat009/ai-avatar-skill |

Provenance and hashes for skills installed with `npx skills` are in `skills-lock.json`.
`ui-ux-pro-max` was installed by its own CLI and is not in that lockfile. `ai-avatar` was
installed directly from github.com/Pancat009/ai-avatar-skill (MIT, commit `ca4ee96`) and
is not in that lockfile either.

For Claude Code, each skill is exposed at `.claude/skills/<name>` as a symlink to
`.agents/skills/<name>` (Claude Code does not scan `.agents/skills/` on its own).
Keep `.agents/skills/` as the single source of truth; when adding a skill, link it:

```bash
ln -s "../../.agents/skills/<name>" ".claude/skills/<name>"
```

## How to use ui-ux-pro-max here

```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "Tolesh"
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain style|typography|ux|chart
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack <stack>
```

Its output is **input, not a mandate**. A generic query for "AI voice assistant"
returns a light, red-primary, marketing-landing-page system, which is wrong for
Tolesh. Query for the product's real character (dark, ambient, luminous, voice-first,
AI-native) and override results that conflict with the direction below.
Only persist a design system (`--persist`) once the user approves a direction.

## Tolesh design direction (the brief wins over any skill default)

- **Product type:** a living companion/instrument, not a marketing site or dashboard.
  The orb/avatar is the hero element and the one memorable thing; keep everything else quiet.
- **Mood:** futuristic, premium, calm intelligence. Dark-first with a considered light theme.
- **Avoid:** generic AI purple/pink gradient wash, identical rounded SaaS cards, emoji as icons,
  scattered fade-up entrances, hover-scale on everything (see `frontend-design`, `design-motion-principles`).
- **State language** (must be visually and motion-distinct, and also readable without color):
  `idle`, `listening`, `thinking`, `speaking`, `acting` (running a computer task),
  `error`, `muted/offline`. Model these as an explicit state machine, not ad-hoc classes.
- **Motion:** purposeful, interruptible, GPU-friendly (transform/opacity, shaders/canvas for the orb).
  Every state transition must work when interrupted mid-animation.
  Honor `prefers-reduced-motion` with a calm non-animated equivalent for every state.
- **Audio-reactive visuals** must degrade gracefully (no mic permission, no WebGL, low-power device).
- **Accessibility:** WCAG 2.1 AA, visible focus, keyboard-operable, captions/transcript for all
  voice output, screen-reader announcements for state changes.
- **Cross-platform:** design tokens and component contracts should be portable across
  web, desktop (Windows/Linux), and Android. Do not assume pointer-only input; floating-assistant
  and always-on-top behavior differ per platform.
- **Trust & safety UI:** screen awareness and computer control need an always-visible indicator,
  explicit permission, a stop control, and confirmation before destructive actions.
  This is a first-class design requirement, not an afterthought.

## Engineering rules

- Follow `frontend-ui-engineering`: small reusable components, design tokens, responsive down to 375px.
- Verify in a real browser before claiming a UI works.
- Never commit secrets. Use environment variables; keep `.env*` out of git.
- Work only on the designated branch. Commit small changes and use a plain `git push origin <branch>`.
  Do not merge, rebase, force-push, hard-reset, or alter remotes, permissions or settings.
  If a push fails, stop and report. See [AGENT_COLLABORATION.md](AGENT_COLLABORATION.md) section 3,
  including the unresolved relationship with branch `arena/fae714f3-tolesh-ai` (OPEN_DECISIONS.md D-11).

## Open decisions (ask the user; do not assume)

1. App stack and packaging (e.g. web-first PWA, with desktop/Android wrappers vs. separate native targets).
2. Orb rendering approach (CSS/SVG, canvas, WebGL/shader) - drives which motion skills apply.
3. Whether to adopt GSAP, Framer Motion, or CSS-only motion (install matching skills only after deciding).
4. Voice/LLM providers and where API keys live.
