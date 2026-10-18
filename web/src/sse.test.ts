/** Tests for readSse — SSE framing parser over a fetch Response body. */
import { describe, test, expect } from 'vitest';
import { readSse } from './sse';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

describe('readSse', () => {
  test('dispatches delta data lines and named events', async () => {
    const body = streamOf([
      'data: {"delta":"I "}\n\n',
      'data: {"delta":"dey!"}\n\n',
      'event: done\ndata: {"conversationId":"c1","model":"m"}\n\n',
    ]);
    const events: Array<{ name: string; data: unknown }> = [];
    await readSse(
      { body } as unknown as Response,
      (name, data) => events.push({ name, data })
    );
    expect(events).toEqual([
      { name: 'message', data: { delta: 'I ' } },
      { name: 'message', data: { delta: 'dey!' } },
      { name: 'done', data: { conversationId: 'c1', model: 'm' } },
    ]);
  });

  test('handles events split across chunk boundaries', async () => {
    const body = streamOf([
      'data: {"del',
      'ta":"he',
      'llo"}\n\nevent: done\nda',
      'ta: {}\n\n',
    ]);
    const events: Array<{ name: string; data: unknown }> = [];
    await readSse({ body } as unknown as Response, (name, data) => events.push({ name, data }));
    expect(events).toEqual([
      { name: 'message', data: { delta: 'hello' } },
      { name: 'done', data: {} },
    ]);
  });

  test('non-JSON data is delivered as a raw string (API layer filters it)', async () => {
    const body = streamOf(['data: not-json\n\ndata: {"delta":"ok"}\n\n']);
    const events: Array<{ name: string; data: unknown }> = [];
    await readSse({ body } as unknown as Response, (name, data) => events.push({ name, data }));
    expect(events).toEqual([
      { name: 'message', data: 'not-json' },
      { name: 'message', data: { delta: 'ok' } },
    ]);
  });

  test('flushes a trailing event that lacks a final blank line', async () => {
    const body = streamOf(['data: {"delta":"x"}\n\n', 'event: done\ndata: {"a":1}']);
    const events: Array<{ name: string; data: unknown }> = [];
    await readSse({ body } as unknown as Response, (name, data) => events.push({ name, data }));
    expect(events.length).toBe(2);
    expect(events[1]).toEqual({ name: 'done', data: { a: 1 } });
  });

  test('throws on a missing body', async () => {
    await expect(readSse({ body: null } as unknown as Response, () => {})).rejects.toThrow(/no stream body/i);
  });

  test('multi-line data fields join with newlines; non-JSON falls back to raw string', async () => {
    const body = streamOf(['data: line1\ndata: line2\n\n']);
    const events: Array<{ name: string; data: unknown }> = [];
    await readSse({ body } as unknown as Response, (name, data) => events.push({ name, data }));
    expect(events).toEqual([{ name: 'message', data: 'line1\nline2' }]);
  });
});
