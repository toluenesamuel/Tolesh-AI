/**
 * Speech queue — speaks a streamed answer sentence-by-sentence so the first
 * audible sentence starts as soon as the text exists (not when the whole
 * reply finishes generating).
 *
 * Guarantees:
 *  - one utterance at a time — never overlapping or duplicated speech
 *  - cancel() stops audio immediately, clears pending text, fires nothing
 *  - onDone fires exactly once when everything queued has been spoken
 *  - a watchdog advances past an utterance whose end event never arrives
 *    (Chromium can stop a long utterance without firing onend/onerror).
 *    Otherwise the queue would wait forever and the HUD would stay "speaking".
 *  - HUD level pulses come from real utterance progress (onboundary events),
 *    the honest signal the Web Speech API offers — no random animation
 *  - the spoken copy is cleaned of Markdown; fenced code is replaced by one
 *    note (CODE_NOTE) instead of being read line by line
 *
 * enqueue() receives stream DELTAS; the unfinished sentence fragment is
 * retained between calls, so decimals ("3." + "5") and abbreviations that
 * span deltas still split correctly. The synth handle is injected for tests.
 */

import { takeSentences } from './sentences';
import { CODE_NOTE, toSpeechText } from './speech-text';

export type SpeechQueue = {
  /** Feed the next stream delta (verbatim answer text). */
  enqueue: (delta: string) => void;
  /** No more text is coming; flush any held-back fragment. */
  finish: () => void;
  /** Stop speaking now and drop everything pending. Fires nothing. */
  cancel: () => void;
};

export type SpeechQueueOptions = {
  /** The first utterance actually started (HUD → speaking state). */
  onSpeakStart?: () => void;
  /** 0..1 speech-progress pulse from utterance boundary events. */
  onLevel?: (level: number) => void;
  /** All queued text has been spoken. Not fired after cancel(). */
  onDone?: () => void;
  /** Timer hooks, injectable for tests. */
  timers?: {
    set: (fn: () => void, ms: number) => unknown;
    clear: (handle: unknown) => void;
  };
  /** Utterance rate (Web Speech 0.5..2). Default 1.02. */
  rate?: number;
};

/** Upper bound on how long one utterance may run before the watchdog moves on. */
export function watchdogMs(text: string): number {
  // Typical speech runs ~60-75 ms per character; 110 ms leaves a wide margin.
  return Math.max(4000, text.length * 110 + 2000);
}

export function createSpeechQueue(
  synth: Pick<SpeechSynthesis, 'speak' | 'cancel' | 'speaking'>,
  opts: SpeechQueueOptions = {}
): SpeechQueue {
  const timers = opts.timers ?? {
    set: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clear: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
  const pending: string[] = [];
  let fragment = ''; // sentence still growing across deltas
  let inFence = false; // inside a fenced code block: nothing from it is spoken
  let speaking = false;
  let finished = false; // finish() was called
  let done = false; // terminal: cancelled or fully drained

  const pushSpeech = (raw: string, flush: boolean) => {
    const { sentences, rest } = takeSentences(raw, flush);
    for (const s of sentences) {
      const spoken = toSpeechText(s);
      if (spoken) pending.push(spoken);
    }
    return rest;
  };

  const startNext = () => {
    if (done || speaking) return;
    if (pending.length === 0) {
      if (finished) {
        done = true;
        opts.onDone?.();
      }
      return; // idle: more stream text may still arrive
    }
    const text = pending.shift()!;
    speaking = true;
    opts.onSpeakStart?.();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = navigator.language || 'en-NG';
    utter.rate = opts.rate ?? 1.02;
    // HUD pulse from real utterance progress: boundary events fire as the
    // engine advances through the text. Engines without boundary support
    // still get the onSpeakStart pulse.
    utter.onboundary = (e: SpeechSynthesisEvent) => {
      if (done) return;
      const progress = utter.text.length ? Math.min(1, (e.charIndex || 0) / utter.text.length) : 0;
      opts.onLevel?.(0.25 + 0.3 * progress);
    };

    // Each utterance settles exactly once: by its end event, by its error
    // event, or by the watchdog. Late events from a stale utterance are ignored.
    let settled = false;
    let timer: unknown = null;
    const afterSettle = () => {
      speaking = false;
      if (done) return;
      if (pending.length) startNext();
      else if (finished) {
        done = true;
        opts.onDone?.();
      }
      // else: queue idle but stream not finished — wait for more deltas
    };
    const settle = () => {
      if (settled) return;
      settled = true;
      if (timer !== null) timers.clear(timer);
      afterSettle();
    };
    utter.onend = settle;
    utter.onerror = settle;
    timer = timers.set(() => {
      if (settled) return;
      settled = true;
      synth.cancel(); // may fire onend on the stuck utterance; ignored (settled)
      afterSettle();
    }, watchdogMs(text));
    synth.speak(utter);
  };

  return {
    enqueue(delta: string) {
      if (done || !delta) return;
      let buf = fragment + delta;
      fragment = '';
      for (;;) {
        if (inFence) {
          const close = buf.indexOf('```');
          if (close < 0) {
            // Still inside the code block: drop it, say nothing. Keep a trailing
            // partial fence ("`" or "``") in case the closing ``` arrives split.
            buf = /`{1,2}$/.exec(buf)?.[0] ?? '';
            break;
          }
          buf = buf.slice(close + 3);
          inFence = false;
          pending.push(CODE_NOTE);
          continue;
        }
        const open = buf.indexOf('```');
        if (open < 0) break;
        // Text before the code block is complete for speech purposes.
        pushSpeech(buf.slice(0, open), true);
        buf = buf.slice(open + 3);
        inFence = true;
      }
      if (buf) fragment = pushSpeech(buf, false);
      if (!speaking) startNext();
    },
    finish() {
      if (done) return;
      finished = true;
      if (inFence) {
        // The stream ended inside a code block: note it once, speak nothing else from it.
        inFence = false;
        pending.push(CODE_NOTE);
      }
      pushSpeech(fragment, true);
      fragment = '';
      if (!speaking) startNext(); // drains or fires onDone
    },
    cancel() {
      done = true;
      pending.length = 0;
      fragment = '';
      inFence = false;
      if (speaking || synth.speaking) synth.cancel();
      speaking = false;
    },
  };
}
