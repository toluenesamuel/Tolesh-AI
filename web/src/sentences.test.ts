/** Tests for takeSentences — streaming TTS sentence extraction. */
import { describe, test, expect } from 'vitest';
import { takeSentences } from './sentences';

describe('takeSentences', () => {
  test('emits a complete sentence and holds the fragment', () => {
    const { sentences, rest } = takeSentences('I dey! How ');
    expect(sentences).toEqual(['I dey!']);
    expect(rest).toBe('How ');
  });

  test('emits multiple complete sentences at once', () => {
    const { sentences, rest } = takeSentences('One. Two! Three? Four');
    expect(sentences).toEqual(['One.', 'Two!', 'Three?']);
    expect(rest).toBe('Four');
  });

  test('does not split decimals', () => {
    const { sentences, rest } = takeSentences('It costs 3.50 naira');
    expect(sentences).toEqual([]);
    expect(rest).toBe('It costs 3.50 naira');
  });

  test('does not split common abbreviations', () => {
    const { sentences, rest } = takeSentences('Dr. Smith met Mr. Ade at e.g. the market. Then left.');
    expect(sentences).toEqual(['Dr. Smith met Mr. Ade at e.g. the market.']);
    expect(rest).toBe('Then left.');
  });

  test('does not split ellipsis mid-thought until real end', () => {
    const { sentences, rest } = takeSentences('Wait... let me think. Ok');
    expect(sentences).toEqual(['Wait... let me think.']);
    expect(rest).toBe('Ok');
  });

  test('newlines end a sentence chunk', () => {
    const { sentences, rest } = takeSentences('First line\nSecond line');
    expect(sentences).toEqual(['First line']);
    expect(rest).toBe('Second line');
  });

  test('splits after punctuation even when followed by a quote', () => {
    const { sentences, rest } = takeSentences('He said "go." Then he left. End');
    expect(sentences).toEqual(['He said "go."', 'Then he left.']);
    expect(rest).toBe('End');
  });

  test('trailing punctuation at buffer end is held until final', () => {
    // A later chunk could turn "3." into "3.5" — so hold it.
    expect(takeSentences('Ok.')).toEqual({ sentences: [], rest: 'Ok.' });
  });

  test('empty and whitespace buffers emit nothing', () => {
    expect(takeSentences('').sentences).toEqual([]);
    expect(takeSentences('   ').sentences).toEqual([]);
  });

  test('final=true flushes everything including the incomplete tail', () => {
    const { sentences, rest } = takeSentences('Done. Almost there', true);
    expect(sentences).toEqual(['Done.', 'Almost there']);
    expect(rest).toBe('');
  });

  test('chunks are trimmed and preserve all words + punctuation', () => {
    const text = 'Hello there! How are you? I am fine... ok? Yes.';
    const { sentences, rest } = takeSentences(text, true);
    expect(sentences.join(' ')).toBe(text);
    expect(rest).toBe('');
  });
});

describe('numbered list markers', () => {
  test('a list marker at the start is not a sentence end', () => {
    const r = takeSentences('1. Open the app.', true);
    expect(r.sentences).toEqual(['1. Open the app.']);
  });

  test('list markers after a finished sentence stay attached to their item', () => {
    const r = takeSentences('Here are the steps. 2. Then restart it. ', true);
    expect(r.sentences).toEqual(['Here are the steps.', '2. Then restart it.']);
  });

  test('a digit mid-sentence still splits', () => {
    const r = takeSentences('I have 3. Next thing. ', true);
    expect(r.sentences).toEqual(['I have 3.', 'Next thing.']);
  });
});
