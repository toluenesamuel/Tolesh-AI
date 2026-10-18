/**
 * API client tests — the honest-error contract. Mocked fetch, no network.
 * Verifies: success passthrough, server error-body mapping (kind + retryAfterMs),
 * fetch-failure → network ApiError, and that deliberate aborts are NOT
 * misreported as network failures (the Stop button depends on this).
 */
import { describe, test, expect, afterEach } from 'vitest';
import { api, ApiError } from '../src/api';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('api client', () => {
  test('health returns parsed JSON on ok', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch;
    await expect(api.health()).resolves.toEqual({ ok: true });
  });

  test('server error body maps to ApiError with kind and retryAfterMs', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: { kind: 'no_key', message: 'No AI provider key is configured on the server.', retryAfterMs: null } }),
        { status: 503 }
      )) as typeof fetch;
    const err = await api.health().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe('no_key');
    expect(err.status).toBe(503);
    expect(err.message).toMatch(/provider key/i);
  });

  test('rate_limit surfaces retryAfterMs', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: { kind: 'rate_limit', message: 'Too many requests.', retryAfterMs: 12000 } }),
        { status: 429, headers: { 'Retry-After': '12' } }
      )) as typeof fetch;
    const err = await api.chat('c', 'm').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe('rate_limit');
    expect(err.retryAfterMs).toBe(12000);
  });

  test('fetch failure → network ApiError', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    const err = await api.health().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe('network');
  });

  test('deliberate abort passes through as AbortError, not network', async () => {
    globalThis.fetch = (async (_url, init) => {
      // simulate the browser aborting the fetch
      return await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        );
      });
    }) as typeof fetch;
    const controller = new AbortController();
    const p = api.chat('c', 'm', controller.signal);
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    await expect(p).rejects.not.toMatchObject({ kind: 'network' });
  });
});
