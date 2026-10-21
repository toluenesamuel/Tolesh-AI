/**
 * Reliability and context tests (2026-10-19). Mocked fetch only — no network.
 * Covers: bounded retries, token budget + one escalation, truncation detection,
 * incomplete streams, model pinning, date context, Pidgin mode and history budget.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { dahl, apiFetch, ProviderError, MAX_TOKENS_CEILING } from '../src/providers.js';
import { buildModelMessages, dateContext, replyLanguageMode, PIDGIN_RULES, SYSTEM_PROMPT } from '../src/persona.js';
import { createStore } from '../src/store.js';
import { createChatRoute, createChatStreamRoute } from '../src/routes/chat.js';

const originalFetch = globalThis.fetch;
const ENV_KEYS = ['DAHL_API_KEY', 'DAHL_BASE_URL', 'DAHL_MODEL', 'MODEL_ID', 'MODEL_MAX_TOKENS', 'REPLY_LANGUAGE_MODE', 'TOLESH_TIMEZONE'];

function jsonRes(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map(Object.entries(headers)),
    json: async () => body,
  };
}

function sseBody(lines) {
  let sent = false;
  return {
    getReader() {
      return {
        read: async () => {
          if (sent) return { done: true };
          sent = true;
          return { done: false, value: Buffer.from(lines.join('\n') + '\n') };
        },
        cancel: async () => {},
      };
    },
  };
}

describe('reliability', () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.DAHL_API_KEY = 'test-key';
    process.env.DAHL_BASE_URL = 'https://example.invalid/v1';
    process.env.DAHL_MODEL = 'pinned-model';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const k of ENV_KEYS) delete process.env[k];
  });

  test('401 is never retried (one call)', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return jsonRes(401, {});
    };
    await assert.rejects(() => dahl.chat({ messages: [{ role: 'user', content: 'x' }] }), (e) => e.kind === 'auth');
    assert.equal(calls, 1);
  });

  test('400 is never retried (one call)', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return jsonRes(400, {});
    };
    await assert.rejects(() => dahl.chat({ messages: [{ role: 'user', content: 'x' }] }), (e) => e.kind === 'provider');
    assert.equal(calls, 1);
  });

  test('429 is retried up to maxRetries, honouring Retry-After', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return jsonRes(429, {}, { 'retry-after': '0' });
    };
    await assert.rejects(() => apiFetch('https://example.invalid/x', { apiKey: 'k', maxRetries: 2, method: 'POST' }), (e) => e.kind === 'rate_limit');
    assert.equal(calls, 3); // first try + 2 retries
  });

  test('503 is retried, then succeeds', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls < 2) return jsonRes(503, {}, { 'retry-after': '0' });
      return jsonRes(200, { model: 'm', choices: [{ message: { content: 'Ok' }, finish_reason: 'stop' }] });
    };
    const res = await dahl.chat({ messages: [{ role: 'user', content: 'x' }] });
    assert.equal(res.text, 'Ok');
    assert.equal(calls, 2);
  });

  test('network failure is retried and then reported as network', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new TypeError('fetch failed');
    };
    await assert.rejects(() => apiFetch('https://example.invalid/x', { apiKey: 'k', maxRetries: 1, method: 'POST' }), (e) => e.kind === 'network');
    assert.equal(calls, 2);
  });

  test('client cancellation is not retried and maps to cancelled', async () => {
    let calls = 0;
    const ac = new AbortController();
    globalThis.fetch = async (_url, init) => {
      calls++;
      ac.abort();
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };
    await assert.rejects(
      () => apiFetch('https://example.invalid/x', { apiKey: 'k', maxRetries: 2, method: 'POST', signal: ac.signal }),
      (e) => e instanceof ProviderError && e.kind === 'cancelled'
    );
    assert.equal(calls, 1);
  });

  test('non-stream: max_tokens is always sent (configured budget)', async () => {
    process.env.MODEL_MAX_TOKENS = '1500';
    let body;
    globalThis.fetch = async (_u, init) => {
      body = JSON.parse(init.body);
      return jsonRes(200, { model: 'm', choices: [{ message: { content: 'Ok' }, finish_reason: 'stop' }] });
    };
    await dahl.chat({ messages: [{ role: 'user', content: 'x' }] });
    assert.equal(body.max_tokens, 1500);
    assert.equal(body.model, 'pinned-model');
  });

  test('empty reply that ran out of room is retried once with a doubled budget', async () => {
    process.env.MODEL_MAX_TOKENS = '1000';
    const budgets = [];
    globalThis.fetch = async (_u, init) => {
      const b = JSON.parse(init.body);
      budgets.push(b.max_tokens);
      if (budgets.length === 1) {
        return jsonRes(200, { model: 'm', choices: [{ message: { content: '', reasoning: 'long thoughts' }, finish_reason: 'length' }] });
      }
      return jsonRes(200, { model: 'm', choices: [{ message: { content: 'Done' }, finish_reason: 'stop' }] });
    };
    const res = await dahl.chat({ messages: [{ role: 'user', content: 'x' }] });
    assert.deepEqual(budgets, [1000, 2000]);
    assert.equal(res.text, 'Done');
  });

  test('retry escalation is bounded: a second truncation fails with kind truncated', async () => {
    process.env.MODEL_MAX_TOKENS = '1000';
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return jsonRes(200, { model: 'm', choices: [{ message: { content: '' }, finish_reason: 'length' }] });
    };
    await assert.rejects(() => dahl.chat({ messages: [{ role: 'user', content: 'x' }] }), (e) => e.kind === 'truncated');
    assert.equal(calls, 2);
  });

  test('a budget above the ceiling is clamped', async () => {
    process.env.MODEL_MAX_TOKENS = '999999';
    assert.equal(dahl.info().maxTokens, MAX_TOKENS_CEILING);
  });

  test('answer that stopped at the limit is returned and flagged truncated (no retry)', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return jsonRes(200, { model: 'm', choices: [{ message: { content: 'The first half of the' }, finish_reason: 'length' }] });
    };
    const res = await dahl.chat({ messages: [{ role: 'user', content: 'x' }] });
    assert.equal(res.truncated, true);
    assert.equal(res.text, 'The first half of the');
    assert.equal(calls, 1);
  });

  test('stream without [DONE] or finish_reason is flagged truncated', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Map(),
      body: sseBody(['data: {"choices":[{"delta":{"content":"Partial answer"}}]}', '']),
    });
    const deltas = [];
    const res = await dahl.stream({ messages: [{ role: 'user', content: 'x' }] }, (d) => deltas.push(d));
    assert.equal(res.truncated, true);
    assert.equal(res.text, 'Partial answer');
  });

  test('clean stream with [DONE] is not truncated', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Map(),
      body: sseBody([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}',
        '',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
        '',
        'data: [DONE]',
        '',
      ]),
    });
    const res = await dahl.stream({ messages: [{ role: 'user', content: 'x' }] }, () => {});
    assert.equal(res.truncated, false);
  });

  test('stream: empty truncated reply before any delta is retried with a larger budget', async () => {
    process.env.MODEL_MAX_TOKENS = '1000';
    const budgets = [];
    globalThis.fetch = async (_u, init) => {
      budgets.push(JSON.parse(init.body).max_tokens);
      if (budgets.length === 1) {
        return { ok: true, status: 200, headers: new Map(), body: sseBody(['data: {"choices":[{"delta":{"reasoning":"x"},"finish_reason":"length"}]}', '']) };
      }
      return { ok: true, status: 200, headers: new Map(), body: sseBody(['data: {"choices":[{"delta":{"content":"Ok"},"finish_reason":"stop"}]}', '', 'data: [DONE]', '']) };
    };
    const deltas = [];
    const res = await dahl.stream({ messages: [{ role: 'user', content: 'x' }] }, (d) => deltas.push(d));
    assert.deepEqual(budgets, [1000, 2000]);
    assert.deepEqual(deltas, ['Ok']);
    assert.equal(res.text, 'Ok');
  });

  test('stream: truncation after output was sent is NOT retried (would duplicate text)', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return { ok: true, status: 200, headers: new Map(), body: sseBody(['data: {"choices":[{"delta":{"content":"Half"}}]}', '', 'data: {"choices":[{"delta":{},"finish_reason":"length"}]}', '']) };
    };
    const deltas = [];
    const res = await dahl.stream({ messages: [{ role: 'user', content: 'x' }] }, (d) => deltas.push(d));
    assert.equal(calls, 1);
    assert.equal(res.truncated, true);
    assert.deepEqual(deltas, ['Half']);
  });

  test('model pin: reported honestly and sent in the request', async () => {
    delete process.env.DAHL_MODEL;
    assert.equal(dahl.info().modelPinned, false);
    process.env.DAHL_MODEL = 'pinned-model';
    assert.equal(dahl.info().modelPinned, true);
    assert.equal(dahl.info().defaultModel, 'pinned-model');
    process.env.MODEL_ID = 'override-model';
    assert.equal(dahl.info().defaultModel, 'override-model');
    let body;
    globalThis.fetch = async (_u, init) => {
      body = JSON.parse(init.body);
      return jsonRes(200, { model: 'm', choices: [{ message: { content: 'Ok' }, finish_reason: 'stop' }] });
    };
    await dahl.chat({ messages: [{ role: 'user', content: 'x' }] });
    assert.equal(body.model, 'override-model');
  });

  test('model unpinned: no model field is sent (gateway default) and info says so', async () => {
    delete process.env.DAHL_MODEL;
    let body;
    globalThis.fetch = async (_u, init) => {
      body = JSON.parse(init.body);
      return jsonRes(200, { model: 'm', choices: [{ message: { content: 'Ok' }, finish_reason: 'stop' }] });
    };
    await dahl.chat({ messages: [{ role: 'user', content: 'x' }] });
    assert.equal('model' in body, false);
  });
});

describe('persona and context', () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });

  test('date context is injected in the configured timezone', () => {
    const now = new Date('2026-10-19T05:30:00Z'); // 06:30 in Lagos
    const text = dateContext(now);
    assert.match(text, /Monday, 19 October 2026/);
    assert.match(text, /Africa\/Lagos/);
    const messages = buildModelMessages([{ role: 'user', content: 'what day is it' }], { now });
    assert.match(messages[0].content, /Monday, 19 October 2026/);
  });

  test('default reply mode is mirror (AGENTS.md rule) and Pidgin rules are absent', () => {
    assert.equal(replyLanguageMode(), 'mirror');
    const messages = buildModelMessages([{ role: 'user', content: 'hi' }], { now: new Date() });
    assert.ok(!messages[0].content.includes(PIDGIN_RULES));
    assert.match(messages[0].content, /Never force Pidgin or slang/);
  });

  test('pidgin mode adds the Pidgin default and keeps code and identifiers exact', () => {
    process.env.REPLY_LANGUAGE_MODE = 'pidgin';
    assert.equal(replyLanguageMode(), 'pidgin');
    const messages = buildModelMessages([{ role: 'user', content: 'hi' }], { now: new Date() });
    assert.ok(messages[0].content.includes(PIDGIN_RULES));
    assert.match(PIDGIN_RULES, /Nigerian Pidgin by default/);
    assert.match(PIDGIN_RULES, /Keep code, file names, commands, error messages, API field names/);
    assert.match(PIDGIN_RULES, /exact quotations/);
    assert.ok(messages[0].content.includes(SYSTEM_PROMPT));
  });

  test('history budget keeps the newest message and says when earlier turns were dropped', () => {
    const history = [
      { role: 'user', content: 'a'.repeat(1000) },
      { role: 'assistant', content: 'b'.repeat(1000) },
      { role: 'user', content: 'latest question' },
    ];
    const messages = buildModelMessages(history, { maxChars: 1100, now: new Date() });
    assert.equal(messages[messages.length - 1].content, 'latest question');
    assert.equal(messages.length, 3); // system + b(1000) + latest... budget keeps newest first
    assert.match(messages[0].content, /earlier message\(s\) in this conversation are not included/);
  });

  test('no omission note when everything fits', () => {
    const messages = buildModelMessages([{ role: 'user', content: 'hi' }], { now: new Date() });
    assert.ok(!messages[0].content.includes('not included here'));
  });

  test('maxMessages default is 40 (old 24-message cap removed)', () => {
    const history = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
    const messages = buildModelMessages(history, { now: new Date() });
    assert.equal(messages.length, 41); // system + 40
  });
});

describe('every provider path receives the same persona', () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });

  test('chat route passes the Pidgin-mode system message to whichever adapter is resolved', async () => {
    process.env.REPLY_LANGUAGE_MODE = 'pidgin';
    const store = createStore(':memory:');
    const conv = store.createConversation('t');
    const seen = [];
    const fallbackAdapter = {
      info: () => ({ id: 'fallback', available: true }),
      chat: async ({ messages }) => {
        seen.push(messages);
        return { text: 'Wetin dey?', model: 'x', truncated: false };
      },
    };
    const route = createChatRoute({ store, resolveProvider: () => fallbackAdapter, buildModelMessages });
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    await route.handler({ body: { conversationId: conv.id, message: 'hello' }, ip: '1.1.1.1' }, res);
    assert.equal(res.body.reply, 'Wetin dey?');
    assert.equal(seen[0][0].role, 'system');
    assert.ok(seen[0][0].content.includes(PIDGIN_RULES));
    store.close();
  });

  test('stream route reports truncated in the done event and persists the cleaned text', async () => {
    const store = createStore(':memory:');
    const conv = store.createConversation('t');
    const adapter = {
      info: () => ({ id: 'a', available: true }),
      stream: async (_req, onDelta) => {
        onDelta('Half answer');
        return { text: 'Half answer', model: 'm', truncated: true };
      },
    };
    const route = createChatStreamRoute({ store, resolveProvider: () => adapter, buildModelMessages });
    const written = [];
    const res = {
      headersSent: false,
      writableEnded: false,
      status() { return this; },
      setHeader() {},
      flushHeaders() { this.headersSent = true; },
      write(chunk) { written.push(chunk); },
      end() { this.writableEnded = true; },
      json() {},
    };
    await route.handler({ body: { conversationId: conv.id, message: 'hello' }, ip: '2.2.2.2' }, res);
    const done = written.find((c) => c.startsWith('event: done'));
    assert.ok(done, 'done event sent');
    assert.match(done, /"truncated":true/);
    assert.equal(store.getConversation(conv.id).messages.at(-1).content, 'Half answer');
    store.close();
  });
});

describe('stream route never leaves the browser waiting', () => {
  test('a non-ProviderError after streaming started ends the stream with an error event', async () => {
    const store = createStore(':memory:');
    const conv = store.createConversation('t');
    const adapter = {
      info: () => ({ id: 'a', available: true }),
      stream: async (_req, onDelta) => {
        onDelta('Partial before the cut');
        throw new TypeError('terminated'); // what the HTTP client raises when the socket drops
      },
    };
    const route = createChatStreamRoute({ store, resolveProvider: () => adapter, buildModelMessages });
    const written = [];
    let ended = false;
    const res = {
      headersSent: false,
      writableEnded: false,
      status() { return this; },
      setHeader() {},
      flushHeaders() { this.headersSent = true; },
      write(chunk) { written.push(chunk); },
      end() { this.writableEnded = true; ended = true; },
      json() {},
    };
    await route.handler({ body: { conversationId: conv.id, message: 'hello' }, ip: '3.3.3.3' }, res);
    assert.equal(ended, true, 'response must be ended');
    const errorEvent = written.find((c) => c.startsWith('event: error'));
    assert.ok(errorEvent, 'an error event must reach the browser');
    assert.match(errorEvent, /interrupted before it finished/);
    assert.ok(!errorEvent.includes('terminated'), 'raw error text must not leak to the client');
    // The partial answer is not persisted as a finished reply.
    assert.equal(store.getConversation(conv.id).messages.filter((m) => m.role === 'assistant').length, 0);
    store.close();
  });

  test('a non-ProviderError before any output returns an honest 502 JSON', async () => {
    const store = createStore(':memory:');
    const conv = store.createConversation('t');
    const adapter = {
      info: () => ({ id: 'a', available: true }),
      stream: async () => {
        throw new TypeError('socket hang up');
      },
    };
    const route = createChatStreamRoute({ store, resolveProvider: () => adapter, buildModelMessages });
    let statusCode = null;
    let body = null;
    const res = {
      headersSent: false,
      writableEnded: false,
      status(c) { statusCode = c; return this; },
      setHeader() {},
      flushHeaders() {},
      write() {},
      end() { this.writableEnded = true; },
      json(b) { body = b; return this; },
    };
    await route.handler({ body: { conversationId: conv.id, message: 'hello' }, ip: '4.4.4.4' }, res);
    assert.equal(statusCode, 502);
    assert.equal(body.error.kind, 'provider');
    store.close();
  });
});
