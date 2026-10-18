# Tolesh AI

Personal AI companion — web-first MVP (JARVIS-style holographic interface, no avatar).
See [AGENTS.md](AGENTS.md) for the project brief, non-negotiables, and skills.

## Quick start

```bash
# 1. Backend (Node ≥ 22, uses built-in node:sqlite)
cd server
cp .env.example .env         # optional: add DAHL_API_KEY to enable live AI
npm install
npm start                    # http://localhost:8787

# 2. Frontend (new terminal)
cd web
npm install
npm run dev                  # http://localhost:5173 (proxies /api to :8787)
```

Without an AI provider key the UI works and the server answers honestly that no
provider is configured. With `DAHL_API_KEY` set in `server/.env`, chat replies come
from the live model (server-side only — keys never reach the browser).

## Tests & checks

```bash
cd server && npm test        # node:test units + HTTP integration (no network)
cd web && npm run typecheck  # tsc --noEmit
cd web && npm test           # vitest
cd web && npm run build      # typecheck + production build
```

## Layout

- `server/` — Express API: conversations (CRUD), chat via provider adapters, rate limit, localhost binding. `src/providers.js` is the only vendor touchpoint (Dahl = OpenAI-compatible schema; add adapters there).
- `web/` — TypeScript HUD: `src/hud.ts` (canvas orb + states), `src/voice.ts` (Web Speech: recognition, synthesis, feedback protection), `src/api.ts` (typed client), `src/main.ts` (state machine).
- `docs/` — specs, plans, and `OVERNIGHT_REPORT.md` (overnight build log).
- `.agents/skills/` + `.claude/skills/` — agent skills (see AGENTS.md).
