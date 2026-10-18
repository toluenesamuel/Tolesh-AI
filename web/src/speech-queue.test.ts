/** Tests for SpeechQueue — sentence-by-sentence TTS fed by a live stream. */
import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import { createSpeechQueue } from './speech-queue';

type FakeUtterance = {
  text: string;
  onend: (() => void) | null;
  onboundary: ((e: { charIndex: number }) => void) | null;
};

/** Minimal fake speechSynthesis: one utterance at a time, boundary events per step, then onend. */
function fakeSynth() {
  let current: FakeUtterance | null = null;
  const spoken: string[] = [];
  const synth = {
    get speaking() {
      return current !== null;
    },
    cancel: vi.fn(() => {
      const c = current;
      current = null;
      if (c) c.onend?.(); // browsers fire onend after cancel
    }),
    speak: vi.fn((u: FakeUtterance) => {
      current = u;
      spoken.push(u.text);
      // simulate progressive speech: boundaries, then end — async so the
      // queue is genuinely mid-utterance when the next delta arrives
      queueMicrotask(() => {
        if (current !== u) return;
        u.onboundary?.({ charIndex: 0 });
        u.onboundary?.({ charIndex: Math.max(0, u.text.length - 1) });
        if (current === u) {
          current = null;
          u.onend?.();
        }
      });
    }),
  };
  return { synth, spoken };
}

/** Node has no SpeechSynthesisUtterance — provide a minimal stand-in. */
class FakeSpeechSynthesisUtterance {
  text: string;
  lang = '';
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onboundary: ((e: { charIndex: number }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

beforeAll(() => {
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = FakeSpeechSynthesisUtterance;
});

afterAll(() => {
  delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;
});

function makeQueue() {
  const { synth, spoken } = fakeSynth();
  const onSpeakStart = vi.fn();
  const onLevel = vi.fn();
  const onDone = vi.fn();
  const queue = createSpeechQueue(synth as unknown as SpeechSynthesis, {
    onSpeakStart,
    onLevel,
    onDone,
  });
  return { queue, spoken, onSpeakStart, onLevel, onDone };
}

describe('speech queue', () => {
  test('speaks each sentence as its own utterance, in order', async () => {
    const { queue, spoken } = makeQueue();
    queue.enqueue('One. Two! Three? ');
    queue.enqueue('Four.');
    queue.finish();
    await vi.waitFor(() => expect(spoken).toEqual(['One.', 'Two!', 'Three?', 'Four.']));
  });

  test('enqueued text mid-utterance is queued, not spoken over', async () => {
    const { queue, spoken, onDone } = makeQueue();
    queue.enqueue('First sentence. ');
    queue.enqueue('Second one.'); // arrives while the first is "speaking"
    queue.finish();
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(spoken).toEqual(['First sentence.', 'Second one.']);
  });

  test('finish() flushes a trailing fragment without ending punctuation', async () => {
    const { queue, spoken, onDone } = makeQueue();
    queue.enqueue('Done. Almost there');
    queue.finish();
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(spoken).toEqual(['Done.', 'Almost there']);
  });

  test('deltas split mid-decimal stay intact (fragment retention)', async () => {
    const { queue, spoken } = makeQueue();
    queue.enqueue('It costs 3.');
    queue.enqueue('50 now.');
    queue.finish();
    await vi.waitFor(() => expect(spoken).toEqual(['It costs 3.50 now.']));
  });

  test('cancel() stops speech and clears pending sentences; onDone not fired', async () => {
    const { queue, spoken, onDone } = makeQueue();
    queue.enqueue('First. Second.');
    await vi.waitFor(() => expect(spoken.length).toBe(1));
    queue.cancel();
    expect(onDone).not.toHaveBeenCalled();
    // nothing more is spoken after cancel even if enqueue races in
    queue.enqueue('Third.');
    await new Promise((r) => setTimeout(r, 10));
    expect(spoken).toEqual(['First.']);
  });

  test('onDone fires exactly once after the last sentence finishes', async () => {
    const { queue, onDone } = makeQueue();
    queue.enqueue('Hello there. How are you?');
    queue.finish();
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  test('empty stream (finish with nothing) fires onDone immediately', async () => {
    const { queue, onDone, onSpeakStart } = makeQueue();
    queue.enqueue('');
    queue.finish();
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onSpeakStart).not.toHaveBeenCalled();
  });

  test('onLevel pulses from boundary events (0..1)', async () => {
    const { queue, onLevel } = makeQueue();
    queue.enqueue('Hello world.');
    queue.finish();
    await vi.waitFor(() => expect(onLevel).toHaveBeenCalled());
    for (const args of onLevel.mock.calls) {
      const v = args[0] as number;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
