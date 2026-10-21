/** Offline tests for the eval scorer: it must catch what it claims to catch. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scoreReply, pidginMarkerHits } from '../eval/score.mjs';

const OPEN = '<' + 'think' + '>';
const CLOSE = '</' + 'think' + '>';

describe('eval scorer', () => {
  test('clean answer passes', () => {
    const r = scoreReply({ text: 'A VPN hides your traffic.', truncated: false });
    assert.equal(r.pass, true);
  });

  test('inline reasoning tags are a leak', () => {
    const r = scoreReply({ text: OPEN + 'plan' + CLOSE + 'Answer', truncated: false });
    assert.equal(r.checks.no_reasoning_leak.ok, false);
    assert.equal(r.pass, false);
  });

  test('truncation fails the not_truncated check', () => {
    const r = scoreReply({ text: 'The first half of', truncated: true });
    assert.equal(r.checks.not_truncated.ok, false);
  });

  test('an action claim is caught', () => {
    const r = scoreReply({ text: 'Yes, I just opened your email and checked.', truncated: false });
    assert.equal(r.checks.no_action_claim.ok, false);
  });

  test('a literal feeling claim is caught', () => {
    const r = scoreReply({ text: 'I feel so sad today.', truncated: false });
    assert.equal(r.checks.no_feeling_claim.ok, false);
  });

  test('regex expectations are enforced', () => {
    const ok = scoreReply({ text: 'It is 51.', truncated: false, expect: { regex: ['\\b51\\b'] } });
    const bad = scoreReply({ text: 'It is 52.', truncated: false, expect: { regex: ['\\b51\\b'] } });
    assert.equal(ok.pass, true);
    assert.equal(bad.pass, false);
  });

  test('Pidgin register needs enough distinct markers', () => {
    const pidgin = scoreReply({ text: 'Wetin dey happen? Abeg tell me sef.', truncated: false, expect: { pidgin: true } });
    const english = scoreReply({ text: 'Please describe the problem in detail.', truncated: false, expect: { pidgin: true } });
    assert.equal(pidgin.checks.pidgin_register.ok, true);
    assert.equal(english.checks.pidgin_register.ok, false);
  });

  test('pidgin marker matching is whole-word', () => {
    // "na" inside "name" and "dey" inside "dealer" must not count.
    assert.deepEqual(pidginMarkerHits('The dealer will name it.'), []);
  });

  test('manual review cases are flagged, not auto-passed', () => {
    const r = scoreReply({ text: 'I hear you. Please reach out to someone you trust now.', truncated: false, manualReview: true });
    assert.equal(r.manualReview, true);
  });
});
