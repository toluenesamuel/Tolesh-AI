# Tolesh

See [AGENTS.md](./AGENTS.md) for the project brief, design direction, installed skills,
and open decisions. Skills live in `.agents/skills/`; read the relevant `SKILL.md` before
doing design, motion, or frontend work.

Claude Code discovers these skills via `.claude/skills/<name>` symlinks pointing back to
`.agents/skills/<name>` (Claude Code does not scan `.agents/skills/` on its own).
`.agents/skills/` remains the single source of truth: install new skills there and add a
matching symlink under `.claude/skills/`.
