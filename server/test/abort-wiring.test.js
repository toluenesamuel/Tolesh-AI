/**
 * Client-disconnect → upstream-abort integration tests.
 * The chat routes pass `req.abortSignal` to the provider adapter; a middleware
 * must actually wire that signal to client disconnects so an interrupted turn
 * cancels the upstream provider call (no orphaned generation, no wasted tokens).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createStore } from '../src/store.js';
import { createChatRoute, createChatStreamRoute } from '../src/routes/chat.js';
import { wireClientAbort } from '../src/request-abort.js';

/** Provider stub that watches its signal and resolves only once aborted. */
function abortAwareProvider() {
  const state = { aborted: false, sawSignal: false };
  /** @param {any} req */
  async function waitForAbort(req) {
    const signal = req?.signal;
    if (!signal) throw new Error('provider received no signal');
    if (signal.aborted) return;
    await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
  }
  return {
    state,
    /** JSON path */
    chat: async (req) => {
      state.sawSignal = Boolean(req.signal);
      await waitForAbort(req);
      state.aborted = req.signal.aborted;
      return { text: 'never seen', model: 'stub' };
    },
    /** SSE path: one delta (starts the stream), then wait for the disconnect. */
    stream: async (req, onDelta) => {
      state.sawSignal = Boolean(req.signal);
      onDelta('partial ');
      await waitForAbort(req);
      state.aborted = req.signal.aborted;
      return { text: 'partial never-seen', hadReasoning: false, model: 'stub' };
    },
  };
}

/** App mirroring index.js's stack: json body → abort wiring → chat routes. */
function buildApp(providerImpl) {
  const store = createStore(':memory:');
  const resolveProvider = () => ({
    info: () => ({ id: 'stub', available: true }),
    chat: providerImpl.chat,
    stream: providerImpl.stream,
  });
  const app = express();
  app.use(express.json());
  app.use(wireClientAbort());
  app.post('/api/chat', createChatRoute({ store, resolveProvider, buildModelMessages: (h) => h, rateLimit: 100 }).handler);
  app.post('/api/chat/stream', createChatStreamRoute({ store, resolveProvider, buildModelMessages: (h) => h, rateLimit: 100 }).handler);
  return { app, store };
}

/** Create a conversation and return a POST sender bound to its id. */
function sendFor(store, base, path) {
  const conv = store.createConversation();
  /** @param {{signal?: AbortSignal}} [init] */
  return ({ signal } = {}) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conv.id, message: 'hi' }),
      signal,
    });
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
    // Aborted turns leave a half-open socket; don't let teardown wait on it.
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
  }
}

/** Poll until fn() is true or the deadline passes (ms). */
async function waitFor(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return fn();
}

describe('client disconnect aborts the upstream provider call', () => {
  test('JSON route: aborting the fetch aborts the provider signal', async () => {
    const provider = abortAwareProvider();
    const { app, store } = buildApp(provider);
    await withServer(app, async (base) => {
      const post = sendFor(store, base, '/api/chat');
      const clientAbort = new AbortController();
      const pending = post({ signal: clientAbort.signal }).then((res) => res.text()).catch(() => {});
      // Provider is now blocked waiting on its signal — cut the client off.
      await waitFor(() => provider.state.sawSignal);
      clientAbort.abort();
      const aborted = await waitFor(() => provider.state.aborted);
      assert.equal(aborted, true, 'provider signal must abort when the client disconnects');
      await pending;
    });
  });

  test('stream route: aborting mid-stream aborts the provider', async () => {
    const provider = abortAwareProvider();
    const { app, store } = buildApp(provider);
    await withServer(app, async (base) => {
      const post = sendFor(store, base, '/api/chat/stream');
      const clientAbort = new AbortController();
      const pending = post({ signal: clientAbort.signal }).then((res) => res.text()).catch(() => {});
      await waitFor(() => provider.state.sawSignal);
      clientAbort.abort();
      const aborted = await waitFor(() => provider.state.aborted);
      assert.equal(aborted, true, 'stream provider signal must abort on client disconnect');
      await pending;
    });
  });

  test('normal completion does NOT abort the provider signal', async () => {
    const state = { abortedAtEnd: null };
    const provider = {
      chat: async (req) => {
        state.abortedAtEnd = req.signal?.aborted ?? null;
        return { text: 'fine', model: 'stub' };
      },
    };
    const { app, store } = buildApp(provider);
    await withServer(app, async (base) => {
      const post = sendFor(store, base, '/api/chat');
      const res = await post();
      assert.equal(res.status, 200);
      assert.equal(state.abortedAtEnd, false, 'signal must still be live when the provider finishes');
    });
  });
});
