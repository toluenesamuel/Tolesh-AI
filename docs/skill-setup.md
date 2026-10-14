# Frontend skill compatibility and setup

Audited: 2026-10-14. Scope: instructions only; no application scaffold, runtime dependencies, visual design selection, or platform implementation.

## Supported mechanism

This checkout already contained `AGENTS.md`, a `CLAUDE.md` pointer, 18 local `SKILL.md` directories under `.agents/skills/`, UI/UX search scripts/data, and an inherited skills lockfile. Python 3, Node, npm and npx are available. This Arena session exposes file reading and command execution, but no native skill installation/activation registry or Claude Code plugin interface. Therefore the supported, verifiable approach here is **explicit project-level instruction configuration**, not a claim of native plugin installation or automatic discovery. Future agents must read `AGENTS.md` and the relevant local skill files.

All four upstream README installation sections were read before changes. Read-only upstream clones were kept outside the project. No installer or remote skill script was executed; only the existing local UI/UX Python validator and search were run. No credentials were needed or inspected.

## Priority skills

| Requested area | Evidence and documented installation route | Result in this task |
|---|---|---|
| UI/UX Pro Max | [README](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill#installation) documents its CLI (`uipro init --ai universal` for `.agents/skills/`; npm package `ui-ux-pro-max-cli`) and Python 3 standard-library searches. | Existing `ui-ux-pro-max` retained and explicitly configured. Local data validator and search passed. Not reinstalled; previous installer/version is not independently verified. |
| Frontend Design | [README](https://github.com/anthropics/skills#try-in-claude-code-claudeai-and-the-api) documents Claude marketplace/plugin, Claude.ai and API routes. | Native Claude plugin route is not available in this session. Existing `frontend-design/SKILL.md` exactly matches the reviewed upstream file and includes its license. Configured as explicitly read project guidance instead. |
| Frontend Engineering | [README](https://github.com/addyosmani/agent-skills#quick-start) documents selective `npx skills add addyosmani/agent-skills --skill frontend-ui-engineering`, plain-Markdown use by other agents, and copying missing shared references. | Existing `frontend-ui-engineering/SKILL.md` exactly matches reviewed upstream. Configured; restored the shared accessibility checklist at its existing relative target, `.agents/references/accessibility-checklist.md`, with upstream license. |
| Animation and Motion | [README](https://github.com/podo/design-agent-skills#install) documents project-scoped catalogue installation and on-demand upstream installation. It is a catalogue/router, not one monolithic animation skill. | Configured routing to existing full `design-motion-principles`, `motion-design`, and `fixing-motion-performance` instructions. Did not install the whole catalogue or claim its absent pointers are installed. |

**New native skill/plugin installations: none. All four requested areas are configured through existing local instructions.** No priority skill's text is inherently incompatible. Host-specific plugin activation is unsupported here; framework-specific implementation advice is conditional, not universally compatible.

## Motion boundaries

Existing supplementary skills include `animate`, `animation-performance`, `emil-design-eng`, `review-animations`, `improve-animations`, accessibility/baseline guidance, and five GSAP skills. They were retained, not newly installed or independently upgraded in this task. Motion implementation sources are recorded in the inherited lockfile (including kylezantos, LottieFiles, emilkowalski, ibelick and greensock); their full installation histories were not revalidated.

GSAP, React/Framer Motion, WebGL, Lottie and native platform runtime compatibility cannot be established until a stack is selected. Merely having Markdown instructions does not install any library. No tool-specific commands, browser automation, screen-control capabilities, or voice services are enabled by these files.

Removed five stale lockfile entries with no corresponding local `SKILL.md`: `emilkowalski-skill`, `framer-motion-skills`, `gsap-skills`, `motion-catalogue`, `motion-design-skill`. Their implementation counterparts, where present, remain untouched. The lockfile now describes 17 present skills; UI/UX Pro Max is the eighteenth, outside that lockfile. Existing hashes were preserved, not newly certified.

## Reviewed upstream revisions

These identify the installation documentation reviewed, not necessarily the revision used for every inherited file:

- nextlevelbuilder/ui-ux-pro-max-skill: `7246805992a42b7bba37d4cac83b01416f0c6c44`
- anthropics/skills: `dbd4588f9e1033efb41dad4bef2f7947c8993d44`
- addyosmani/agent-skills: `aeac41d4d005999432bb7312f7ff06383a91d59d`
- podo/design-agent-skills: `c3fac4cb09ba2ac92ebf0b35572b9e85e06db4f8`

The restored checklist and `LICENSE.addyosmani` are copied unchanged from the listed Addy Osmani revision. The checklist is supplementary guidance, not an accessibility certification; validate standards and code examples before using them.

## Verification

From the repository root:

```sh
python3 .agents/skills/ui-ux-pro-max/scripts/validate_data.py
python3 .agents/skills/ui-ux-pro-max/scripts/search.py 'reduced motion' --domain ux --max-results 1
```

Results: validator passed for 12 domain files, 22 stack files, and `ui-reasoning.csv`; search returned the relevant reduced-motion guidance. No design system was persisted. Frontend Design and Frontend Engineering skill bodies matched the reviewed upstream files byte-for-byte. These checks verify local resources, not UI behavior or native host activation.

## Next steps — require user approval, not part of setup

1. Choose web-first versus separate native architecture and packaging for Windows, Zorin OS/Linux and Android. Define platform limits for overlays, microphone access, screen awareness and task execution.
2. Approve a compact visual design contract: typography, semantic colors, spacing, responsive behavior and a distinctive orb/avatar direction. Dark-first is a proposed project direction, not an approved palette.
3. Specify idle/listening/thinking/speaking/acting/error/muted/offline states, interrupted transitions, transcripts, keyboard/touch behavior and reduced-motion equivalents. Include visible capture indicators, permission flows and an immediate stop control.
4. Choose the rendering and motion stack against low-power/mobile requirements; only then review/install additional framework-specific skills or libraries.
5. Once explicitly authorized, build a small accessible prototype and test it in real browsers and target platforms. Keep provider secrets out of client bundles and committed files.
