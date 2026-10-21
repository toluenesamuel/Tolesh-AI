/** Provider adapter tests — mocked fetch, no network. */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { dahl, resolveProvider, ProviderError, apiFetch } from '../src/providers.js';
import { buildModelMessages, SYSTEM_PROMPT } from '../src/persona.js';

const originalFetch = globalThis.fetch;

describe('providers', () => {
  beforeEach(() => {
    delete process.env.DAHL_API_KEY;
    delete process.env.DAHL_BASE_URL;
    delete process.env.MODEL_ID;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('dahl is unavailable without key and reports honestly', () => {
    const info = dahl.info();
    assert.equal(info.available, false);
    assert.equal(info.needsKey, true);
  });

  test('dahl becomes available with key + base url', () => {
    process.env.DAHL_API_KEY = 'test-key';
    process.env.DAHL_BASE_URL = 'https://example.invalid/v1';
    const info = dahl.info();
    assert.equal(info.available, true);
    assert.equal(info.id, 'dahl');
  });

  test('chat sends OpenAI-compatible payload and parses reply', async () => {
    process.env.DAHL_API_KEY = 'test-key';
    process.env.DAHL_BASE_URL = 'https://example.invalid/v1';
    let captured;
    globalThis.fetch = async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => ({
          model: 'dahl-large',
          choices: [{ message: { role: 'assistant', content: 'How far! I dey here.' } }],
          usage: { total_tokens: 10 },
        }),
      };
    };
    const result = await dahl.chat({ messages: [{ role: 'user', content: 'hey' }] });
    assert.equal(result.text, 'How far! I dey here.');
    assert.equal(result.model, 'dahl-large');
    const body = JSON.parse(captured.init.body);
    assert.equal(body.messages[0].role, 'user');
    assert.equal(captured.init.headers.Authorization, 'Bearer test-key');
    // Regression guard: the base URL's path (/v1) must survive the join —
    // `new URL('chat/completions', base)` alone would strip it.
    assert.equal(String(captured.url), 'https://example.invalid/v1/chat/completions');
  });

  test('no_key error is honest and safe to display', async () => {
    await assert.rejects(
      () => dahl.chat({ messages: [{ role: 'user', content: 'x' }] }),
      (err) => err instanceof ProviderError && err.kind === 'no_key'
    );
  });

  test('401 maps to auth error without leaking the key', async () => {
    process.env.DAHL_API_KEY = 'secret-value';
    process.env.DAHL_BASE_URL = 'https://example.invalid/v1';
    globalThis.fetch = async () => ({ ok: false, status: 401, headers: new Map(), text: async () => 'denied' });
    await assert.rejects(
      () => dahl.chat({ messages: [{ role: 'user', content: 'x' }] }),
      (err) => {
        assert.equal(err.kind, 'auth');
        assert.ok(!err.message.includes('secret-value'));
        return true;
      }
    );
  });

  test('resolveProvider falls back to first provider when requested id is unknown', () => {
    assert.equal(resolveProvider('nonexistent').info().id, 'dahl');
    assert.equal(resolveProvider().info().id, 'dahl');
  });
});

describe('persona', () => {
  test('buildModelMessages puts system prompt first and bounds history', () => {
    const history = Array.from({ length: 60 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: `msg ${i}`,
    }));
    const messages = buildModelMessages(history, 10);
    assert.equal(messages[0].role, 'system');
    assert.match(messages[0].content, /Tolesh/);
    assert.equal(messages.length, 11); // system + 10
    assert.equal(messages[messages.length - 1].content, 'msg 59');
  });

  test('system prompt contains non-negotiables', () => {
    assert.match(SYSTEM_PROMPT, /never claim to literally feel emotions/i);
    assert.match(SYSTEM_PROMPT, /Situation Gate/);
    assert.match(SYSTEM_PROMPT, /never invent a meaning/i);
  });
});
