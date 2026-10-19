/**
 * Spoken-text shaping — what TTS should say for markdown-formatted answers.
 * The transcript bubble shows raw streamed markdown (meant for eyes); speech
 * gets the cleaned form. Code fences are never spoken; inline markers are
 * stripped. Stateful fence-skipping across deltas + per-sentence cleanup.
 */
import { describe, test, expect } from 'vitest';
import { createSpokenFilter, cleanSpokenText } from './spoken';

/** Feed deltas through the filter, return the concatenated spoken text. */
function filtered(deltas: string[]): string {
  const f = createSpokenFilter();
  let out = '';
  for (const d of deltas) out += f.push(d);
  out += f.end();
  return out;
}

describe('createSpokenTextFilter (streaming fence skip)', () => {
  test('plain text passes through unchanged, split across deltas', () => {
    expect(filtered(['Hello ', 'the', 're!'])).toBe('Hello there!');
  });

  test('fenced code block content is never spoken', () => {
    const out = filtered(['Here you go:\n', '```bash\n', 'npm install\n', '```\n', 'That is it.']);
    expect(out).toBe('Here you go:\nThat is it.');
  });

  test('fence with language tag dropped, code content dropped', () => {
    const out = filtered(['```python\n', 'print("hello")\n', 'x = 1\n', '```\n', 'Done.']);
    expect(out).toBe('Done.');
  });

  test('fence markers split across deltas still toggle', () => {
    const out = filtered(['text\n`', '``\ncode\n', '``', '`\nmore']);
    expect(out).toBe('text\nmore');
  });

  test('unclosed fence: nothing after it is spoken', () => {
    const out = filtered(['Answer:\n```js\nconst x = 1;']);
    expect(out).toBe('Answer:\n');
  });

  test('stream ending right after a lone backtick does not lose it', () => {
    const f = createSpokenFilter();
    const out = f.push('wait for it`');
    expect(out + f.end()).toBe('wait for it`');
  });

  test('indented text that is not a fence is kept', () => {
    expect(filtered(['  ```\n  code\n  ```\n'])).toBe('');
    expect(filtered(['- normal bullet\n'])).toBe('- normal bullet\n');
  });
});

describe('cleanSpokenText (per-sentence cleanup)', () => {
  test('plain sentences untouched', () => {
    expect(cleanSpokenText('It costs 3.50 naira, e.g. at Dr. Smith’s shop.')).toBe(
      'It costs 3.50 naira, e.g. at Dr. Smith’s shop.'
    );
  });

  test('bold, italics and inline code markers stripped', () => {
    expect(cleanSpokenText('**Very** good and *handy* plus `npm test`')).toBe(
      'Very good and handy plus npm test'
    );
  });

  test('links keep only their label', () => {
    expect(cleanSpokenText('See [the docs](https://example.com/x) for more.')).toBe(
      'See the docs for more.'
    );
  });

  test('heading and list prefixes stripped', () => {
    expect(cleanSpokenText('## Summary')).toBe('Summary');
    expect(cleanSpokenText('- first item')).toBe('first item');
    expect(cleanSpokenText('1. Step one')).toBe('Step one');
  });
});
