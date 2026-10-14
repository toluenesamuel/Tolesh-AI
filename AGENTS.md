# Tolesh - Agent Instructions

Tolesh is a personal AI assistant for **web, Windows, Zorin OS/Linux, and Android**.
The interface must feel **futuristic, premium, intelligent, and alive**.

Planned capabilities (design for them now, build them later):
floating assistant, animated avatar/orb, natural voice conversation, expressive
listening / thinking / speaking states, screen awareness, computer task execution.

> Status: no application code exists yet. The stack has NOT been chosen.
> Do not scaffold the app until the user asks.

## Local skill instructions (project-level, in `.agents/skills/`)

Read the relevant `SKILL.md` before doing that kind of work. These files were
already present at the start of this setup audit. Arena native activation and
auto-discovery are not verified; explicitly read them as project instructions.
See [the compatibility report](docs/skill-setup.md) for evidence and limitations.
No skill workflow authorizes building before the user requests implementation.

| Need | Skill(s) | Source |
|------|----------|--------|
| Design system, palette, type, layout, UX rules | `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill |
| Distinctive visual direction, anti-template rules | `frontend-design` | anthropics/skills |
| Component architecture, state, responsive, a11y | `frontend-ui-engineering` | addyosmani/agent-skills |
| Motion principles and audits | `design-motion-principles`, `motion-design`, `emil-design-eng`, `animate`, `review-animations`, `improve-animations` | via podo/design-agent-skills catalogue |
| Motion performance | `animation-performance`, `fixing-motion-performance` | via podo/design-agent-skills catalogue |
| GSAP (only if chosen) | `gsap-core`, `gsap-timeline`, `gsap-react`, `gsap-performance`, `gsap-utils` | greensock/gsap-skills |
| Accessibility / baseline UI | `fixing-accessibility`, `baseline-ui` | ibelick/ui-skills |

The inherited `skills-lock.json` records sources and hashes; it is not proof of
native activation or of which installer previously ran. Missing catalogue pointer
entries were removed during the audit. `ui-ux-pro-max` has no lockfile entry.
Preserve local resources; do not run bulk upgrades or install catalogue suggestions
without reviewing their instructions, dependencies, and fit to the chosen stack.

### Skill routing and precedence

- Use `ui-ux-pro-max` for design-system research, then `frontend-design` for visual direction.
- Use `frontend-ui-engineering` for component contracts and implementation quality.
  Its shared checklist is `.agents/references/accessibility-checklist.md`.
- For motion, start with `design-motion-principles`; use `motion-design` for timing
  and state choreography, then `fixing-motion-performance` for performance review.
- Other existing motion skills are supplementary, not competing mandatory workflows.
  GSAP/React/Framer-specific examples are conditional on an approved stack;
  their presence does not install or select those runtime libraries.
- User requirements and project accessibility, privacy, and platform constraints
  take precedence over aesthetic defaults. Skill examples are illustrative, not
  tested production components. Adapt host-specific tool names to available tools;
  never claim browser or platform validation without performing it.

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

- Follow `frontend-ui-engineering`: small reusable components, design tokens, responsive down to 320px.
- Verify in a real browser before claiming a UI works.
- Never commit secrets. Use environment variables; keep `.env*` out of git.
- Work only on the session branch `arena/fae714f3-tolesh-ai`. Do not switch branches.
- User preference: before starting a work task, fetch origin and check
  `origin/genspark_ai_developer` for new commits. Bring new changes into this
  session branch when present, preserving existing work. Review changes before
  integrating; ask before resolving ambiguous conflicts or discarding work.
  Never switch to or push directly to the original branch. This check occurs
  during active work, not as background monitoring between messages.
- User preference: after completing and checking changes, commit and push them to
  GitHub using `git push origin arena/fae714f3-tolesh-ai`. Report any push failure;
  never claim changes are pushed unless the command succeeds. Do not include secrets.

## Open decisions (ask the user; do not assume)

1. App stack and packaging (e.g. web-first PWA, with desktop/Android wrappers vs. separate native targets).
2. Orb rendering approach (CSS/SVG, canvas, WebGL/shader) - drives which motion skills apply.
3. Whether to adopt GSAP, Framer Motion, or CSS-only motion (install matching skills only after deciding).
4. Voice/LLM providers and where API keys live.
