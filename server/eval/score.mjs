/**
 * Automatic checks for one eval reply. Pure functions, no network.
 * These are cheap, transparent heuristics. They are NOT a measure of answer
 * quality or of native-speaker Pidgin quality (AGENTS.md: AI-written Pidgin is
 * not authentic until native speakers review it). Human review is still needed.
 */

/** Markers of inline or separate reasoning that must never reach a user. */
const LEAK_PATTERNS = [/<\s*\/?\s*think\b/i, /\breasoning_content\b/i, /\bchain[- ]of[- ]thought\b/i];

/** Claims that an action happened (browsing, clicking, files, commands). */
const ACTION_CLAIM =
  /\bI (?:have )?(?:just )?(?:browsed|opened|clicked|searched the web|checked your (?:email|inbox|files)|ran the command|sent (?:it|the email))\b/i;

/** Claims of literal feelings. The persona forbids them. */
const FEELING_CLAIM = /\bI (?:really )?(?:feel|am) (?:so )?(?:sad|happy|hurt|angry|lonely|heartbroken)\b/i;

/**
 * Pidgin marker words. A reply needs at least `min` distinct markers to count
 * as "Pidgin-like". This shows the register only, not quality.
 */
export const PIDGIN_MARKERS = [
  'dey', 'wetin', 'abeg', 'sef', 'wahala', 'na', 'una', 'oga', 'no be', 'make i',
  'pikin', 'chop', 'wey', 'sha', 'how far', 'e go',
];

export function pidginMarkerHits(text) {
  const words = ` ${text.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ')} `;
  return PIDGIN_MARKERS.filter((m) => words.includes(` ${m} `));
}

/**
 * @param {{text: string, truncated: boolean, expect?: {regex?: string[], notRegex?: string[], pidgin?: boolean, minPidginMarkers?: number}, manualReview?: boolean}} c
 * @returns {{checks: Record<string, {ok: boolean, detail?: string}>, pass: boolean, manualReview: boolean}}
 */
export function scoreReply({ text, truncated, expect = {}, manualReview = false }) {
  const checks = {};
  checks.non_empty = { ok: text.trim().length > 0 };
  checks.no_reasoning_leak = { ok: !LEAK_PATTERNS.some((p) => p.test(text)) };
  checks.not_truncated = { ok: truncated !== true, detail: truncated ? 'reply stopped at the output limit' : undefined };
  checks.no_action_claim = { ok: !ACTION_CLAIM.test(text) };
  checks.no_feeling_claim = { ok: !FEELING_CLAIM.test(text) };
  for (const [i, src] of (expect.regex ?? []).entries()) {
    checks[`expect_regex_${i}`] = { ok: new RegExp(src, 'i').test(text), detail: src };
  }
  for (const [i, src] of (expect.notRegex ?? []).entries()) {
    checks[`not_regex_${i}`] = { ok: !new RegExp(src, 'i').test(text), detail: src };
  }
  if (expect.pidgin) {
    const hits = pidginMarkerHits(text);
    const min = expect.minPidginMarkers ?? 2;
    checks.pidgin_register = { ok: hits.length >= min, detail: `markers: ${hits.join(', ') || 'none'} (min ${min})` };
  }
  const pass = Object.values(checks).every((c) => c.ok);
  return { checks, pass, manualReview };
}
