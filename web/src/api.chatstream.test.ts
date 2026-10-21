/** Tests for api.chatStream — SSE client over mocked fetch. */
import { describe, test, expect, vi, afterEach } from 'vitest';
import { api } from './api';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  });
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api.chatStream', () => {
  test('streams answer deltas and resolves with the cleaned reply', async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse(['data: {"delta":"I "}\n\n', 'data: {"delta":"dey!"}\n\n', 'event: done\ndata: {"conversationId":"c1","model":"stub"}\n\n'])
    );
    const deltas: string[] = [];
    const result = await api.chatStream('c1', 'hey', { onDelta: (d) => deltas.push(d) });
    expect(deltas).toEqual(['I ', 'dey!']);
    expect(result.reply).toBe('I dey!');
    expect(result.model).toBe('stub');
  });

  test('HTTP error before stream → ApiError with kind and status', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(502, { error: { kind: 'provider', message: 'The model reasoned but returned no answer.', retryAfterMs: null } })
    );
    const onDelta = vi.fn();
    await expect(api.chatStream('c1', 'hi', { onDelta })).rejects.toMatchObject({
      kind: 'provider',
      status: 502,
      message: /reasoned but returned no answer/,
    });
    expect(onDelta).not.toHaveBeenCalled();
  });

  test('mid-stream SSE error event → ApiError carrying kind and message', async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse(['data: {"delta":"partial"}\n\n', 'event: error\ndata: {"error":{"kind":"provider","message":"boom"}}\n\n'])
    );
    const onDelta = vi.fn();
    await expect(api.chatStream('c1', 'hi', { onDelta })).rejects.toMatchObject({ kind: 'provider', message: 'boom' });
    expect(onDelta).toHaveBeenCalledWith('partial');
  });

  test('deltas without a done event are NOT a finished answer (interrupted stream rejects)', async () => {
    globalThis.fetch = vi.fn(async () => sseResponse(['data: {"delta":"x"}\n\n']));
    const seen: string[] = [];
    await expect(api.chatStream('c1', 'hi', { onDelta: (d) => seen.push(d) })).rejects.toMatchObject({
      kind: 'provider',
    });
    // Text that did arrive was still shown, so the user sees what was cut off.
    expect(seen).toEqual(['x']);
  });

  test('done event carries the truncated flag from the server', async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse(['data: {"delta":"Half"}\n\n', 'event: done\ndata: {"conversationId":"c1","truncated":true}\n\n'])
    );
    const result = await api.chatStream('c1', 'hi', {});
    expect(result.reply).toBe('Half');
    expect(result.truncated).toBe(true);
  });

  test('done event without the flag is not truncated', async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse(['data: {"delta":"Full"}\n\n', 'event: done\ndata: {"conversationId":"c1"}\n\n'])
    );
    const result = await api.chatStream('c1', 'hi', {});
    expect(result.truncated).toBe(false);
  });

  test('network failure maps to network ApiError', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(api.chatStream('c1', 'hi', {})).rejects.toMatchObject({ kind: 'network' });
  });

  test('abort signal aborts the fetch', async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn((_input: unknown, init?: RequestInit) => {
      // Simulate a hanging stream that honours abort.
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    }) as unknown as typeof fetch;
    const p = api.chatStream('c1', 'hi', { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toThrow();
  });
});
