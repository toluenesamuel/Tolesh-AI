/**
 * Speech queue — speaks a streamed answer sentence-by-sentence so the first
 * audible sentence starts as soon as the text exists (not when the whole
 * reply finishes generating).
 *
 * Guarantees:
 *  - one utterance at a time — never overlapping or duplicated speech
 *  - cancel() stops audio immediately, clears pending text, fires nothing
 *  - onDone fires exactly once when everything queued has been spoken
 *  - HUD level pulses come from real utterance progress (onboundary events),
 *    the honest signal the Web Speech API offers — no random animation
 *
 * enqueue() receives stream DELTAS; the unfinished sentence fragment is
 * retained between calls, so decimals ("3." + "5") and abbreviations that
 * span deltas still split correctly. Before speech, fenced code blocks are
 * dropped and inline markdown markers stripped (spoken.ts) — the transcript
 * bubble keeps the raw markdown. The synth handle is injected for tests.
 */

import { takeSentences } from './sentences';
import { cleanSpokenText, createSpokenFilter } from './spoken';

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
  /** Utterance rate (Web Speech 0.5..2). Default 1.02. */
  rate?: number;
};

export function createSpeechQueue(
  synth: Pick<SpeechSynthesis, 'speak' | 'cancel' | 'speaking'>,
  opts: SpeechQueueOptions = {}
): SpeechQueue {
  const spoken = createSpokenFilter(); // streaming fence skipper
  const pending: string[] = [];
  let fragment = ''; // sentence still growing across deltas

  // A sentence that cleans down to nothing (stray markers) is not speech.
  const pushSpoken = (sentence: string) => {
    const clean = cleanSpokenText(sentence);
    if (clean) pending.push(clean);
  };
  let speaking = false;
  let finished = false; // finish() was called
  let done = false; // terminal: cancelled or fully drained

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
    const advance = () => {
      speaking = false;
      if (done) return;
      if (pending.length) startNext();
      else if (finished) {
        done = true;
        opts.onDone?.();
      }
      // else: queue idle but stream not finished — wait for more deltas
    };
    utter.onend = advance;
    utter.onerror = advance;
    synth.speak(utter);
  };

  return {
    enqueue(delta: string) {
      if (done || !delta) return;
      fragment += spoken.push(delta); // fenced code dropped here
      const { sentences, rest } = takeSentences(fragment, false);
      for (const s of sentences) pushSpoken(s);
      fragment = rest;
      if (!speaking) startNext();
    },
    finish() {
      if (done) return;
      finished = true;
      fragment += spoken.end(); // flush any held-back fence prefix
      for (const s of takeSentences(fragment, true).sentences) pushSpoken(s);
      fragment = '';
      if (!speaking) startNext(); // drains or fires onDone
    },
    cancel() {
      done = true;
      pending.length = 0;
      fragment = '';
      if (speaking || synth.speaking) synth.cancel();
      speaking = false;
    },
  };
}
