/**
 * Behaviour cases ported from GenSpark's spoken.test.ts (commit 0453a14), run
 * against Arena's speech queue. The code is not ported: Arena already has one
 * speech path. These cases check what the engine actually says.
 *
 * Intentional differences from the GenSpark expectations:
 * - Markdown markers are not spoken (a bullet or a backtick is not read out).
 * - A fenced code block is replaced by one spoken note (CODE_NOTE), not silence.
 */
import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import { createSpeechQueue } from './speech-queue';
import { CODE_NOTE } from './speech-text';

class FakeUtt {
  text: string;
  lang = '';
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onboundary: unknown = null;
  constructor(text: string) {
    this.text = text;
  }
}
beforeAll(() => {
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtt;
});
afterAll(() => {
  delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;
});

/** Stream deltas through the real queue; resolve with everything spoken, in order. */
function spokenFor(deltas: string[]): Promise<string[]> {
  return new Promise((resolve) => {
    const spoken: string[] = [];
    let current: FakeUtt | null = null;
    let finished = false;
    const synth = {
      get speaking() {
        return current !== null;
      },
      cancel: vi.fn(() => {
        current = null;
      }),
      speak: vi.fn((u: FakeUtt) => {
        current = u;
        spoken.push(u.text);
        queueMicrotask(() => {
          if (current === u) {
            current = null;
            u.onend?.();
          }
        });
      }),
    };
    const q = createSpeechQueue(synth as unknown as SpeechSynthesis, {
      timers: { set: () => 0, clear: () => {} },
      onDone: () => {
        if (!finished) {
          finished = true;
          resolve(spoken);
        }
      },
    });
    for (const d of deltas) q.enqueue(d);
    q.finish();
  });
}

/** Spoken text with the code note removed, whitespace collapsed. */
async function say(deltas: string[]): Promise<string> {
  const parts = await spokenFor(deltas);
  return parts
    .filter((p) => p !== CODE_NOTE)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('speech behaviour carried over from GenSpark spoken.test.ts', () => {
  test('plain text passes through, split across deltas', async () => {
    expect(await say(['Hello ', 'the', 're!'])).toBe('Hello there!');
  });

  test('fenced code is never spoken; one note replaces it', async () => {
    const deltas = ['Here you go:\n', '```bash\n', 'npm install\n', '```\n', 'That is it.'];
    const parts = await spokenFor(deltas);
    expect(parts.join(' ')).not.toMatch(/npm install/);
    expect(parts.filter((p) => p === CODE_NOTE)).toHaveLength(1);
    expect(await say(deltas)).toBe('Here you go: That is it.');
  });

  test('fence with a language tag: code content dropped', async () => {
    const parts = await spokenFor(['```python\n', 'print("hello")\n', 'x = 1\n', '```\n', 'Done.']);
    expect(parts.join(' ')).not.toMatch(/print|x = 1/);
    expect(await say(['```python\n', 'print("hello")\n', 'x = 1\n', '```\n', 'Done.'])).toBe('Done.');
  });

  test('fence markers split across deltas still toggle', async () => {
    const deltas = ['text\n`', '``\ncode\n', '``', '`\nmore'];
    expect(await say(deltas)).toBe('text more');
    // The code note is allowed; the code words themselves must not be spoken.
    expect((await spokenFor(deltas)).filter((p) => p !== CODE_NOTE).join(' ')).not.toMatch(/\bcode\b/);
  });

  test('unclosed fence: nothing after it is spoken', async () => {
    const deltas = ['Answer:\n```js\nconst x = 1;'];
    expect(await say(deltas)).toBe('Answer:');
    expect((await spokenFor(deltas)).join(' ')).not.toMatch(/const/);
  });

  test('a stream ending on a lone backtick does not lose the words before it', async () => {
    // The backtick is markup and is not spoken; the words are kept.
    expect(await say(['wait for it`'])).toBe('wait for it');
  });

  test('a bullet line keeps its words (bullet marker not spoken)', async () => {
    expect(await say(['- normal bullet\n'])).toBe('normal bullet');
  });
});
