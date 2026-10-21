/**
 * Chat route integration tests — real express app over in-memory store,
 * with a mocked provider. No network. Covers validation, persistence,
 * rate limiting, and honest provider-error mapping.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';
import { createStore } from '../src/store.js';
import { createChatRoute, createChatStreamRoute } from '../src/routes/chat.js';

const originalFetch = globalThis.fetch;

/** Build a minimal app with a stubbed provider resolver. */
function buildApp(providerImpl) {
  const store = createStore(':memory:');
  const resolveProvider = () => ({
    info: () => ({ id: 'stub', available: true }),
    chat: providerImpl.chat,
    stream: providerImpl.stream,
  });
  const app = express();
  app.use(express.json());
  const chat = createChatRoute({ store, resolveProvider, buildModelMessages: (h) => h, rateLimit: 3 });
  app.post('/api/chat', chat.handler);
  const chatStream = createChatStreamRoute({ store, resolveProvider, buildModelMessages: (h) => h, rateLimit: 3 });
  app.post('/api/chat/stream', chatStream.handler);
  return { app, store };
}

async function withServer(app, fn) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('happy path: persists user+assistant messages, returns reply', async () => {
    const provider = {
      chat: async () => ({ text: 'I dey here!', model: 'stub-1' }),
    };
    const { app, store } = buildApp(provider);
    await withServer(app, async (base) => {
      const conv = store.createConversation();
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conv.id, message: 'you dey?' }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.reply, 'I dey here!');
      assert.equal(body.conversationId, conv.id);
      const got = store.getConversation(conv.id);
      assert.equal(got.messages.length, 2);
      assert.equal(got.messages[0].role, 'user');
      assert.equal(got.messages[1].role, 'assistant');
    });
  });

  test('missing fields → 400; unknown conversation → 404', async () => {
    const { app, store } = buildApp({ chat: async () => ({ text: 'x', model: null }) });
    await withServer(app, async (base) => {
      const bad = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'no conversation id' }),
      });
      assert.equal(bad.status, 400);
      const missing = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: 'does-not-exist', message: 'hi' }),
      });
      assert.equal(missing.status, 404);
    });
  });

  test('provider no_key → 503 with kind, nothing fake returned', async () => {
    const err = new (Error)('No AI provider key is configured on the server. Add one to enable live responses.');
    err.name = 'ProviderError';
    err.kind = 'no_key';
    const { app, store } = buildApp({ chat: async () => { throw err; } });
    await withServer(app, async (base) => {
      const conv = store.createConversation();
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conv.id, message: 'hi' }),
      });
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.error.kind, 'no_key');
      assert.match(body.error.message, /provider key/i);
    });
  });

  test('rate limit: 4th request within a minute → 429', async () => {
    const { app, store } = buildApp({ chat: async () => ({ text: 'ok', model: null }) });
    await withServer(app, async (base) => {
      const conv = store.createConversation();
      for (let i = 0; i < 3; i++) {
        const res = await fetch(`${base}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: conv.id, message: `msg ${i}` }),
        });
        assert.equal(res.status, 200);
      }
      const limited = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conv.id, message: 'one too many' }),
      });
      assert.equal(limited.status, 429);
      const body = await limited.json();
      assert.equal(body.error.kind, 'rate_limit');
    });
  });

  test('stream: SSE with reasoning events then answer deltas → client sees answer only, cleaned text persisted', async () => {
    // Provider that mimics DeepSeek: reasoning deltas, then answer deltas.
    const provider = {
      stream: async (req, onDelta) => {
        onDelta('I ');
        onDelta('dey!');
        return { text: 'I dey!', hadReasoning: true, model: 'stub-stream', finishReason: 'stop' };
      },
    };
    const { app, store } = buildApp(provider);
    await withServer(app, async (base) => {
      const conv = store.createConversation();
      const res = await fetch(`${base}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conv.id, message: 'you dey?' }),
      });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/);
      const body = await res.text();
      // The user-facing stream must never contain reasoning text…
      assert.ok(!body.includes('reasoning'));
      // …and must carry answer deltas as SSE events.
      assert.match(body, /data: \{"delta":"I "\}/);
      assert.match(body, /data: \{"delta":"dey!"\}/);
      assert.match(body, /event: done/);
      const got = store.getConversation(conv.id);
      assert.equal(got.messages.length, 2);
      assert.equal(got.messages[1].role, 'assistant');
      assert.equal(got.messages[1].content, 'I dey!');
    });
  });

  test('stream: provider reasoning-only failure → SSE error event, honest kind', async () => {
    const err = new Error('The model reasoned but returned no answer.');
    err.name = 'ProviderError';
    err.kind = 'provider';
    const { app, store } = buildApp({
      stream: async () => {
        throw err;
      },
    });
    await withServer(app, async (base) => {
      const conv = store.createConversation();
      const res = await fetch(`${base}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conv.id, message: 'hi' }),
      });
      assert.equal(res.status, 502);
      const body = await res.json();
      assert.equal(body.error.kind, 'provider');
    });
  });

  test('stream: validation and rate limit still apply', async () => {
    const provider = { stream: async () => ({ text: 'x', hadReasoning: false, model: 's' }) };
    const { app, store } = buildApp(provider);
    await withServer(app, async (base) => {
      const conv = store.createConversation();
      const bad = await fetch(`${base}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'no id' }),
      });
      assert.equal(bad.status, 400);
    });
  });
});
