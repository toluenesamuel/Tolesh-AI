/**
 * Display and speech must carry the same answer. The UI feeds the same stream
 * deltas to the on-screen bubble and to the speech queue. This test runs both
 * over one streamed answer, in many random chunkings, and compares words.
 *
 * Allowed differences (and only these): Markdown markers are not spoken, a link
 * is spoken as its label (its target is not read), and fenced code is replaced by
 * one note. Everything else must match word for word, in order.
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

const ANSWER =
  '## Plan\n\n' +
  '- **Open** the app and check `status`.\n' +
  '- Read [the guide](https://example.com/guide) before you start.\n' +
  '1. Wait 2.5 seconds for the sync. Dr. Adeyemi said so.\n' +
  '```bash\nnpm run build\n```\n' +
  'Then deploy it. Done!';

/** Split text into n random chunks (deterministic PRNG). */
function chunk(text: string, seed: number): string[] {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const len = 1 + Math.floor(rnd() * 12);
    out.push(text.slice(i, i + len));
    i += len;
  }
  return out;
}

/** Words of a text, lower-cased, markup and punctuation removed. */
const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean);

describe('display and speech carry the same answer', () => {
  test('spoken words equal displayed prose words, across many chunkings', async () => {
    // Displayed text: every delta, joined. This is what the bubble shows.
    const expectedProse = words(
      ANSWER.replace(/```[\s\S]*?```/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    );
    for (let seed = 1; seed <= 40; seed++) {
      const deltas = chunk(ANSWER, seed);
      const shown = deltas.join('');
      expect(shown).toBe(ANSWER); // the screen receives every character, in order

      const spoken = await collectSpoken(deltas);
      const spokenWords = words(spoken.filter((s) => s !== CODE_NOTE).join(' '));
      // The spoken prose matches the displayed prose, word for word, in order.
      expect(spokenWords).toEqual(expectedProse);
      // Code is replaced by one note, never read out.
      expect(spoken.filter((s) => s === CODE_NOTE).length).toBe(1);
      expect(spoken.join(' ')).not.toMatch(/npm run build/);
      // No Markdown markers reach the speech engine.
      expect(spoken.join(' ')).not.toMatch(/[*`#]|\]\(/);
    }
  });

  test('a stream that is cut off speaks only what it received (no invented ending)', async () => {
    const deltas = chunk('The answer is forty two and', 7);
    const spoken = await collectSpoken(deltas);
    expect(spoken.join(' ')).toContain('forty two');
    expect(spoken.join(' ')).not.toContain('Done');
  });
});

/** Speak the deltas through the real queue and return the spoken utterances in order. */
function collectSpoken(deltas: string[]): Promise<string[]> {
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
