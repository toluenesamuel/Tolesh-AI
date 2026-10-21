/**
 * Speech queue: watchdog (stuck engine) and code-block handling.
 * Uses a fake engine that can be stuck on purpose and manual timers, so every
 * step is deterministic.
 */
import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import { createSpeechQueue, watchdogMs } from './speech-queue';
import { CODE_NOTE } from './speech-text';

type Utt = { text: string; onend: (() => void) | null; onerror: (() => void) | null; onboundary: unknown };

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

/** Engine where each utterance finishes only when `finish()` is called by the test. */
function manualEngine() {
  let current: Utt | null = null;
  const spoken: string[] = [];
  const engine = {
    get speaking() {
      return current !== null;
    },
    cancel: vi.fn(() => {
      const c = current;
      current = null;
      c?.onend?.(); // browsers fire onend after cancel
    }),
    speak: vi.fn((u: Utt) => {
      current = u;
      spoken.push(u.text);
    }),
    /** The test ends the current utterance normally. */
    finishCurrent() {
      const c = current;
      current = null;
      c?.onend?.();
    },
  };
  return { engine, spoken };
}

/** Manual timers: the test decides when a watchdog fires. */
function manualTimers() {
  const pending = new Map<number, { fn: () => void; ms: number }>();
  let next = 1;
  return {
    timers: {
      set: (fn: () => void, ms: number) => {
        const id = next++;
        pending.set(id, { fn, ms });
        return id;
      },
      clear: (h: unknown) => {
        pending.delete(h as number);
      },
    },
    fireAll() {
      const list = [...pending.entries()];
      pending.clear();
      for (const [, t] of list) t.fn();
    },
    count: () => pending.size,
    lastMs: () => [...pending.values()].at(-1)?.ms ?? null,
  };
}

describe('watchdog', () => {
  test('a stuck utterance is advanced past when the watchdog fires', () => {
    const { engine, spoken } = manualEngine();
    const t = manualTimers();
    const onDone = vi.fn();
    const q = createSpeechQueue(engine as unknown as SpeechSynthesis, { onDone, timers: t.timers });
    q.enqueue('First sentence here. Second sentence here. ');
    expect(spoken).toEqual(['First sentence here.']); // engine stuck: no end event
    t.fireAll(); // watchdog for the stuck utterance
    expect(engine.cancel).toHaveBeenCalled();
    expect(spoken).toEqual(['First sentence here.', 'Second sentence here.']);
    q.finish();
    engine.finishCurrent(); // second utterance ends normally
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('a late end event from a watchdog-settled utterance does not advance twice', () => {
    const { engine, spoken } = manualEngine();
    const t = manualTimers();
    const q = createSpeechQueue(engine as unknown as SpeechSynthesis, { timers: t.timers });
    q.enqueue('One here. Two here. Three here. ');
    const stuck = engine as unknown as { speak: { mock: { calls: Utt[][] } } };
    const firstUtt = stuck.speak.mock.calls[0]![0]!;
    t.fireAll(); // watchdog moves to "Two here."
    firstUtt.onend?.(); // stale event for the stuck utterance arrives late
    firstUtt.onerror?.();
    expect(spoken).toEqual(['One here.', 'Two here.']); // not three, no skipped sentence
  });

  test('a normal end clears the watchdog timer', () => {
    const { engine } = manualEngine();
    const t = manualTimers();
    const q = createSpeechQueue(engine as unknown as SpeechSynthesis, { timers: t.timers });
    q.enqueue('Short one. ');
    expect(t.count()).toBe(1);
    engine.finishCurrent();
    expect(t.count()).toBe(0);
    q.cancel();
  });

  test('watchdog allows a generous margin over typical speech speed', () => {
    expect(watchdogMs('x'.repeat(100))).toBeGreaterThan(100 * 75); // typical ~70 ms/char
    expect(watchdogMs('short')).toBeGreaterThanOrEqual(4000);
  });
});

describe('code blocks are not read line by line', () => {
  test('a fenced block in one delta is replaced by a single note', () => {
    const { engine, spoken } = manualEngine();
    const t = manualTimers();
    const q = createSpeechQueue(engine as unknown as SpeechSynthesis, { timers: t.timers });
    q.enqueue('Use this:\n```py\nprint(1)\nprint(2)\n```\nThat is all. ');
    engine.finishCurrent();
    engine.finishCurrent();
    engine.finishCurrent();
    q.finish();
    expect(spoken).toEqual(['Use this:', CODE_NOTE, 'That is all.']);
    expect(spoken.join(' ')).not.toContain('print');
  });

  test('a fence split across deltas drops the code and keeps the prose', () => {
    const { engine, spoken } = manualEngine();
    const t = manualTimers();
    const q = createSpeechQueue(engine as unknown as SpeechSynthesis, { timers: t.timers });
    for (const d of ['Here: ', '``', '`js\nconst x = ', '1;\n``', '`\nAfter it. ']) q.enqueue(d);
    q.finish();
    for (let k = 0; k < 4; k++) engine.finishCurrent();
    expect(spoken.join(' | ')).not.toContain('const');
    expect(spoken).toContain(CODE_NOTE);
    expect(spoken.join(' ')).toContain('After it.');
  });

  test('an unclosed fence at end of stream still gives one note and no code', () => {
    const { engine, spoken } = manualEngine();
    const t = manualTimers();
    const q = createSpeechQueue(engine as unknown as SpeechSynthesis, { timers: t.timers });
    q.enqueue('Look:\n```\nunterminated code');
    q.finish();
    for (let k = 0; k < 3; k++) engine.finishCurrent();
    expect(spoken).toEqual(['Look:', CODE_NOTE]);
  });

  test('markdown is cleaned before speaking', () => {
    const { engine, spoken } = manualEngine();
    const t = manualTimers();
    const q = createSpeechQueue(engine as unknown as SpeechSynthesis, { timers: t.timers });
    q.enqueue('**Good** news. ');
    q.finish();
    expect(spoken[0]).toBe('Good news.');
    engine.finishCurrent();
  });
});
