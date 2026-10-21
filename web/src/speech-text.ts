/**
 * Turn answer text into something a speech engine can read aloud.
 *
 * The screen keeps the answer as written. Only the spoken copy is cleaned:
 * Markdown markers are removed, so the engine does not read "asterisk" or
 * "hash" aloud, and link targets are shortened. Words are never dropped.
 *
 * Pure string logic, so it is unit-testable in node.
 */

/** Spoken in place of a fenced code block: code is not read line by line. */
export const CODE_NOTE = 'The code is on your screen.';

/**
 * Remove Markdown markup from a sentence-sized chunk of answer text.
 * Returns '' when nothing speakable is left (e.g. a line of "---").
 */
export function toSpeechText(text: string): string {
  const cleaned = text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // image -> alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [label](url) -> label
    .replace(/https?:\/\/\S+/g, 'the link') // raw URLs are not read out
    .replace(/`([^`]+)`/g, '$1') // inline code -> plain words
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s*>\s?/gm, '') // blockquotes
    .replace(/^\s*[-*+]\s+/gm, '') // bullet markers
    .replace(/(\*\*|__)(.+?)\1/g, '$2') // bold
    .replace(/(^|[\s(])[*_](?=\S)([^*_\n]+?)(?<=\S)[*_](?=[\s).,!?:;]|$)/g, '$1$2') // italics
    .replace(/[*_#|~`]+/g, ' ') // stray markup characters, including a lone backtick
    .replace(/\s+/g, ' ')
    .trim();
  // A chunk of only punctuation (e.g. "---" or "...") has nothing to say.
  return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : '';
}
