/** Tests for the spoken copy of answer text (Markdown removed, words kept). */
import { describe, test, expect } from 'vitest';
import { toSpeechText, CODE_NOTE } from './speech-text';

describe('toSpeechText', () => {
  test('removes bold and italics markers, keeps the words', () => {
    expect(toSpeechText('This is **very** important.')).toBe('This is very important.');
    expect(toSpeechText('Make it *soft* now.')).toBe('Make it soft now.');
    expect(toSpeechText('__strong__ text')).toBe('strong text');
  });

  test('removes headings, bullets and blockquote markers', () => {
    expect(toSpeechText('## Plan')).toBe('Plan');
    expect(toSpeechText('- first item')).toBe('first item');
    expect(toSpeechText('> quoted line')).toBe('quoted line');
  });

  test('link labels are read, link targets are not', () => {
    expect(toSpeechText('See [the docs](https://example.com/a/b) for more.')).toBe('See the docs for more.');
  });

  test('raw URLs are replaced by a short phrase', () => {
    expect(toSpeechText('Visit https://example.com/path now')).toBe('Visit the link now');
  });

  test('inline code becomes plain words', () => {
    expect(toSpeechText('Run `npm test` first.')).toBe('Run npm test first.');
  });

  test('rule lines and punctuation-only chunks are dropped', () => {
    expect(toSpeechText('---')).toBe('');
    expect(toSpeechText('...')).toBe('');
    expect(toSpeechText('  ')).toBe('');
  });

  test('numbers and ordinary punctuation are preserved', () => {
    expect(toSpeechText('Pay ₦5,000 on 19 October.')).toBe('Pay ₦5,000 on 19 October.');
  });

  test('every word of the displayed text survives cleaning', () => {
    const shown = '## Steps\n- **Open** the app\n- Run `make build` then see [docs](https://x.y)';
    const spoken = toSpeechText(shown.replace(/\n/g, ' '));
    for (const word of ['Steps', 'Open', 'the', 'app', 'Run', 'make', 'build', 'then', 'see', 'docs']) {
      expect(spoken.split(/\s+/)).toContain(word);
    }
  });

  test('code note constant is a plain sentence', () => {
    expect(CODE_NOTE).toBe('The code is on your screen.');
  });
});
