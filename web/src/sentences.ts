/**
 * Streaming sentence extraction for TTS: given the accumulated answer text,
 * return the sentences that are safely complete (so speech can start at the
 * first sentence instead of waiting for the full reply) and the remainder
 * that is still growing.
 *
 * Pure string logic — no browser APIs — so it is unit-testable in node.
 */

/** Abbreviations that should not end a sentence despite the trailing dot. */
const ABBREVIATIONS = new Set([
  'dr', 'mr', 'mrs', 'ms', 'st', 'vs', 'etc', 'eg', 'ie', 'jr', 'sr',
  'prof', 'capt', 'gen', 'col', 'lt', 'sgt', 'hon', 'rev',
]);

const PUNCT = /[.!?]/;
const CLOSER = /["'”’)\]]/;
const WS = /\s/;

/**
 * @param {string} buf accumulated text so far
 * @param {boolean} final true when the stream is done — flushes the tail
 * @returns {{ sentences: string[], rest: string }}
 */
export function takeSentences(buf: string, final = false): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let start = 0;
  let i = 0;
  const emit = (end: number) => {
    const chunk = buf.slice(start, end).trim();
    if (chunk) sentences.push(chunk);
  };
  while (i < buf.length) {
    const ch = buf.charAt(i);
    if (ch === '\n') {
      emit(i);
      i += 1;
      start = i;
      continue;
    }
    if (PUNCT.test(ch)) {
      let j = i;
      while (j < buf.length && PUNCT.test(buf.charAt(j))) j += 1;
      // An ellipsis ("..." or mixed dots) is a pause, not a sentence end.
      if (j - i >= 2) {
        i = j;
        continue;
      }
      // Optional closing quote/bracket directly after the punctuation.
      while (j < buf.length && CLOSER.test(buf.charAt(j))) j += 1;
      const followedBySpace = j < buf.length && WS.test(buf.charAt(j));
      const atEnd = j >= buf.length;

      // Word immediately before the punctuation (abbreviation check).
      let wStart = i;
      while (wStart > start && !WS.test(buf.charAt(wStart - 1))) wStart -= 1;
      const word = buf.slice(wStart, i).toLowerCase();
      const isAbbrev = j - i === 1 && ABBREVIATIONS.has(word.replace(/\./g, ''));

      // A numbered-list marker that opens a sentence ("1. Do this", or "... Done. 2. Next")
      // is not a sentence end. Digits mid-sentence ("I have 3. Next") still split.
      const isListMarker = j - i === 1 && /^\d{1,3}$/.test(word) && wStart === start;

      if (isAbbrev || isListMarker) {
        i = j;
        continue;
      }
      if (followedBySpace) {
        emit(j);
        i = j;
        while (i < buf.length && WS.test(buf.charAt(i))) i += 1;
        start = i;
        continue;
      }
      if (atEnd) {
        // Punctuation at the buffer end: hold until we know what follows
        // (a later chunk could turn "3." into "3.5") — unless final.
        if (final) {
          emit(j);
          start = j;
        }
        break;
      }
      i = j;
      continue;
    }
    i += 1;
  }
  const rest = buf.slice(start);
  if (final && rest.trim()) sentences.push(rest.trim());
  return { sentences, rest: final ? '' : rest };
}
