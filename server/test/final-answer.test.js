/**
 * Tests for the single final-answer processing path every provider response
 * goes through before it may reach the UI, speech, or history.
 *
 * Cases come from the live provider probe (2026-10-18):
 * - MiniMax M2.x embeds reasoning inline in `content` inside a "think" tag pair.
 * - DeepSeek/GLM return reasoning in a separate `reasoning`/`reasoning_content`
 *   field (which must never be forwarded), with clean `content`.
 *
 * We avoid writing the literal tag names in comments/strings where they could
 * confuse tooling; they are assembled from parts in the tests below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFinalAnswer, createThinkFilter, stripThink } from '../src/final-answer.js';

const OPEN = '<' + 'think' + '>';
const CLOSE = '</' + 'think' + '>';

test('strips inline think blocks from content (MiniMax style)', () => {
  const out = extractFinalAnswer({
    content: OPEN + 'private plan' + CLOSE + '\n\nI dey o. How far?',
  });
  assert.equal(out.answer, 'I dey o. How far?');
  assert.equal(out.hadReasoning, true);
});

test('think tags with attributes are also stripped', () => {
  const out = extractFinalAnswer({ content: OPEN + ' rationale of x ' + CLOSE + 'answer' });
  assert.equal(out.answer, 'answer');
});

test('strips think tags even when unclosed (truncated response)', () => {
  const out = extractFinalAnswer({ content: OPEN + ' reasoning started but got cut off' });
  assert.equal(out.answer, '');
  assert.equal(out.hadReasoning, true);
});

test('keeps normal answer untouched (no tags, no reasoning fields)', () => {
  const out = extractFinalAnswer({ content: 'I dey o. You dey? How far? 😄' });
  assert.equal(out.answer, 'I dey o. You dey? How far? 😄');
  assert.equal(out.hadReasoning, false);
});

test('reasoning in a separate field is ignored entirely (GLM/DeepSeek shape)', () => {
  const out = extractFinalAnswer({
    content: 'I dey! Wetin happen?',
    reasoning: 'The user greeted me in Pidgin. Mirror it.',
    reasoning_content: 'another reasoning channel',
  });
  assert.equal(out.answer, 'I dey! Wetin happen?');
  assert.equal(out.hadReasoning, true); // detected, dropped, never surfaced
  assert.ok(!out.answer.includes('Pidgin'));
});

test('reasoning-only response (empty content) yields empty answer, not the reasoning', () => {
  const out = extractFinalAnswer({ reasoning: 'just deliberation', content: '' });
  assert.equal(out.answer, '');
  assert.equal(out.hadReasoning, true);
});

test('multiple think blocks are all removed, answer preserved', () => {
  const out = extractFinalAnswer({
    content: OPEN + ' first ' + CLOSE + 'Answer part one. ' + OPEN + ' more ' + CLOSE + 'Part two.',
  });
  assert.equal(out.answer, 'Answer part one. Part two.');
});

test('think block spanning the whole content yields empty answer', () => {
  const out = extractFinalAnswer({ content: OPEN + ' all reasoning no answer ' + CLOSE });
  assert.equal(out.answer, '');
});

test('unclosed think tag: everything from the tag on is dropped (truncated stream)', () => {
  const out = extractFinalAnswer({ content: 'Nice answer start ' + OPEN + ' reasoning cut' });
  assert.equal(out.answer, 'Nice answer start');
});

test('extractFinalAnswer on malformed/missing inputs returns empty, never throws', () => {
  assert.deepEqual(extractFinalAnswer(null), { answer: '', hadReasoning: false });
  assert.deepEqual(extractFinalAnswer({}), { answer: '', hadReasoning: false });
  assert.deepEqual(extractFinalAnswer({ content: 42 }), { answer: '', hadReasoning: false });
});

test('extractFinalAnswer trims whitespace-only answers to empty', () => {
  assert.equal(extractFinalAnswer({ content: '  \n  ' }).answer, '');
});

// ---- streaming filter ----

test('thinkFilter: passes clean text through untouched', () => {
  const f = createThinkFilter();
  assert.equal(f.push('I dey!'), 'I dey!');
  assert.equal(f.push(' still flowing'), ' still flowing');
  assert.equal(f.flush(), '');
});

test('thinkFilter: hides text until close tag arrives, then emits answer', () => {
  const f = createThinkFilter();
  assert.equal(f.push(OPEN + ' reasoning here'), '');
  assert.equal(f.push(' still reasoning' + CLOSE + 'answer!'), 'answer!');
  assert.equal(f.push(' more answer'), ' more answer');
  assert.equal(f.push(OPEN + ' fake second block' + CLOSE), '');
  assert.equal(f.push(' after'), ' after');
  assert.equal(f.flush(), '');
});

test('thinkFilter: partial tag at chunk edge is buffered, not leaked or reordered', () => {
  const f = createThinkFilter();
  assert.equal(f.push(OPEN + 'reasoning </thi'), ''); // in-think: partial close held
  assert.equal(f.push('nk>' + 'Answer'), 'Answer');
  assert.equal(f.push(' continues'), ' continues');
});

test('thinkFilter: split open tag across chunks is caught', () => {
  const f = createThinkFilter();
  assert.equal(f.push('hi <th'), 'hi '); // text before the tag releases; tag prefix held
  assert.equal(f.push('ink>hidden'), '');
  assert.equal(f.push('visible'), '');
  assert.equal(f.push(CLOSE + 'shown'), 'shown');
});

test('filter.delta: forwards answer deltas, never reasoning deltas', () => {
  const f = createThinkFilter();
  assert.equal(f.delta({ reasoning: 'private thoughts ' }), '');
  assert.equal(f.delta({ reasoning_content: 'more private' }), '');
  assert.equal(f.delta({ content: 'I dey' }), 'I dey');
  assert.equal(f.delta({ content: '!' }), '!');
  assert.equal(f.delta({}), '');
});

test('filter.delta: inline think opening inside content stream is withheld', () => {
  const f = createThinkFilter();
  assert.equal(f.delta({ content: 'Hello ' }), 'Hello ');
  assert.equal(f.delta({ content: OPEN + ' reasoning...' }), '');
  assert.equal(f.delta({ content: 'still hidden' }), '');
  assert.equal(f.delta({ content: CLOSE + 'rest' }), 'rest');
});

test('filter tracks hadReasoning across channels and tags', () => {
  const f = createThinkFilter();
  f.delta({ reasoning: 'x' });
  assert.equal(f.hadReasoning, true);
  const g = createThinkFilter();
  g.delta({ content: 'clean' });
  assert.equal(g.hadReasoning, false);
  const h = createThinkFilter();
  h.delta({ content: OPEN + 'reasoning' + CLOSE + 'answer' });
  assert.equal(h.hadReasoning, true);
});

/** Stream text through the filter, split at the given positions, and return the answer. */
function streamAnswer(text, splits) {
  const f = createThinkFilter();
  let out = '';
  let prev = 0;
  for (const s of [...splits, text.length]) {
    out += f.push(text.slice(prev, s));
    prev = s;
  }
  return out + f.flush();
}

test('streamed answer equals whole-reply answer for a trailing "<" or partial tag', () => {
  // A literal "<" that never completes into a tag must appear, as in the whole-reply path.
  const cases = ['Price is <', 'x <thi', 'ok <', 'a <think foo', 'use a < b'];
  for (const c of cases) {
    const whole = stripThink(c).text;
    assert.equal(whole, c, `whole-reply keeps ${JSON.stringify(c)}`);
    // Every single split point, and the all-chars split.
    for (let i = 0; i <= c.length; i++) {
      assert.equal(streamAnswer(c, [i]), whole, `split ${i} of ${JSON.stringify(c)}`);
    }
    assert.equal(streamAnswer(c, [...c.slice(0, -1)].map((_, i) => i + 1)), whole);
  }
});

test('streamed reasoning residue is still dropped at flush (unclosed reasoning)', () => {
  // An unclosed reasoning block swallows the rest, in both paths.
  const text = 'Answer. ' + OPEN + 'still thinking <';
  assert.equal(stripThink(text).text, 'Answer. ');
  for (let i = 0; i <= text.length; i++) {
    assert.equal(streamAnswer(text, [i]), 'Answer. ', `split ${i}`);
  }
});

test('streamed and whole-reply answers agree over many chunkings of a mixed reply', () => {
  const text = 'Use a < b, then ' + OPEN + 'plan' + CLOSE + 'done. Tag <x> is literal, end <';
  const whole = stripThink(text).text;
  assert.equal(whole, 'Use a < b, then done. Tag <x> is literal, end <');
  for (let i = 0; i <= text.length; i++) {
    for (let j = i; j <= text.length; j += 7) {
      assert.equal(streamAnswer(text, [i, j]), whole, `splits ${i},${j}`);
    }
  }
});
