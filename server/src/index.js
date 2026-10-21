/**
 * Tolesh server — conversation API with provider adapters.
 * Binds localhost by default. All provider keys stay in env, server-side only.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { accessGate, originAllowed, parseAllowedOrigins } from './access.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.js';
import { resolveProvider, providers, ProviderError } from './providers.js';
import { buildModelMessages, replyLanguageMode } from './persona.js';
import { wireClientAbort } from './request-abort.js';
import { createChatRoute, createChatStreamRoute, providerErrorResponse } from './routes/chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1'; // localhost by default — never exposed without explicit config
const MAX_MESSAGE_CHARS = 8_000;
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 60);

const store = createStore(process.env.DB_PATH ?? path.join(__dirname, '..', 'data', 'tolesh.db'));

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
const EXTRA_ORIGINS = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
app.use(
  cors({
    origin: (origin, cb) => cb(null, originAllowed(origin, EXTRA_ORIGINS)),
  })
);
// Hosted deployments set TOLESH_ACCESS_TOKEN; local development leaves it unset.
app.use(accessGate(process.env.TOLESH_ACCESS_TOKEN));
// Client disconnects abort in-flight provider calls (req.abortSignal).
app.use(wireClientAbort());

// --- Health & capability ---
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/providers', (_req, res) => {
  res.json({
    providers: providers.map((p) => p.info()),
    active: resolveProvider().info().id,
    replyLanguageMode: replyLanguageMode(),
  });
});

// --- Conversations (user-controlled memory: list, read, delete) -----------
app.get('/api/conversations', (_req, res) => {
  res.json({ conversations: store.listConversations() });
});

app.post('/api/conversations', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.slice(0, 120) : undefined;
  res.status(201).json({ conversation: store.createConversation(title) });
});

app.get('/api/conversations/:id', (req, res) => {
  const conversation = store.getConversation(String(req.params.id));
  if (!conversation) {
    res.status(404).json({ error: { kind: 'not_found', message: 'Conversation not found.' } });
    return;
  }
  res.json({ conversation });
});

app.delete('/api/conversations/:id', (req, res) => {
  const ok = store.deleteConversation(String(req.params.id));
  if (!ok) {
    res.status(404).json({ error: { kind: 'not_found', message: 'Conversation not found.' } });
    return;
  }
  res.json({ ok: true });
});

// --- Chat -------------------------------------------------------------------
const chat = createChatRoute({ store, resolveProvider, buildModelMessages });
app.post('/api/chat', chat.handler);
const chatStream = createChatStreamRoute({ store, resolveProvider, buildModelMessages });
app.post('/api/chat/stream', chatStream.handler);

// --- Errors ---------------------------------------------------------------
app.use((err, _req, res, _next) => {
  if (err instanceof ProviderError) {
    providerErrorResponse(res, err);
    return;
  }
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    res.status(400).json({ error: { kind: 'bad_json', message: 'Invalid request body.' } });
    return;
  }
  console.error('[tolesh] unhandled error:', err?.message ?? err);
  res.status(500).json({ error: { kind: 'internal', message: 'Internal server error.' } });
});

const server = app.listen(PORT, HOST, () => {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : PORT;
  console.log(`[tolesh] server listening on http://localhost:${port}`);
  const active = resolveProvider().info();
  console.log(`[tolesh] provider: ${active.id} (available: ${active.available})`);
  if (active.available && !active.modelPinned) {
    // Without a pin the gateway chooses the model. The 2026-10-18 evidence showed
    // that default can emit reasoning inline, so say so at startup.
    console.warn(`[tolesh] warning: ${active.id} model is not pinned. Set DAHL_MODEL in server/.env.`);
  }
  console.log(`[tolesh] reply language mode: ${replyLanguageMode()}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close();
    store.close();
    process.exit(0);
  });
}

export { server, store };
