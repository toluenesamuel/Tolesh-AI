/**
 * The single final-answer processing path: every provider response —
 * non-streaming or streamed — passes through here before it may reach the
 * UI, the speech pipeline, or persisted history.
 *
 * Evidence (live probe 2026-10-18, Dahl gateway, three models):
 * - MiniMax M2.x emits reasoning inline in `content` inside "think" tag pairs
 *   (occasionally unclosed when the response is truncated).
 * - DeepSeek / GLM emit reasoning in separate `reasoning` / `reasoning_content`
 *   response fields and keep `content` clean.
 *
 * Contract: whatever leaves this module is user-facing answer text only.
 * Reasoning is dropped at the source — never hidden with CSS, never spoken.
 */

/** Matches an opening reasoning tag, with or without attributes. */
const OPEN_RE = /<think(?:\s[^>]*)?>/i;
const CLOSE_RE = /<\/think\s*>/i;
const OPEN_BASE = '<' + 'think' + '>';
const CLOSE_BASE = '</' + 'think' + '>';

/**
 * Extract the user-facing final answer from a chat-completion message.
 * Reasoning in dedicated fields (`reasoning`, `reasoning_content`) is detected
 * for the hadReasoning flag but never returned. Inline think blocks are
 * stripped; a trailing unclosed open tag drops everything after it (a
 * truncated reasoning phase has no answer following it).
 *
 * @param {{content?: unknown, reasoning?: unknown, reasoning_content?: unknown} | null | undefined} message
 * @returns {{answer: string, hadReasoning: boolean}}
 */
export function extractFinalAnswer(message) {
  if (!message || typeof message !== 'object') return { answer: '', hadReasoning: false };
  const content = typeof message.content === 'string' ? message.content : '';
  const separate =
    (typeof message.reasoning === 'string' && message.reasoning.length > 0) ||
    (typeof message.reasoning_content === 'string' && message.reasoning_content.length > 0);
  const cleaned = stripThink(content);
  return {
    answer: cleaned.text.trim(),
    hadReasoning: separate || cleaned.sawTag,
  };
}

/**
 * Remove every complete think block; a trailing unclosed open tag drops the
 * remainder (truncated reasoning has no answer after it).
 * @param {string} content
 * @returns {{text: string, sawTag: boolean}}
 */
export function stripThink(content) {
  let text = '';
  let sawTag = false;
  let rest = content;
  for (;;) {
    const m = OPEN_RE.exec(rest);
    if (!m) {
      text += rest;
      break;
    }
    sawTag = true;
    text += rest.slice(0, m.index);
    const afterOpen = rest.slice(m.index + m[0].length);
    const c = CLOSE_RE.exec(afterOpen);
    if (!c) {
      // Unclosed: everything from the open tag on is (truncated) reasoning.
      rest = '';
      break;
    }
    rest = afterOpen.slice(c.index + c[0].length);
  }
  return { text, sawTag };
}

/**
 * Streaming filter for one assistant turn. Reasoning deltas
 * (`reasoning` / `reasoning_content`) are dropped outright. Content deltas go
 * through the same think-tag rule; a chunk suffix that could still become part
 * of a tag is held back until it resolves, so nothing leaks and order is kept.
 * Text before a tag releases immediately (streaming latency), reasoning text
 * is never released.
 *
 * @returns {{
 *   push: (chunk: string) => string,
 *   delta: (d: {content?: unknown, reasoning?: unknown, reasoning_content?: unknown}) => string,
 *   flush: () => string,
 *   readonly hadReasoning: boolean,
 * }}
 */
export function createThinkFilter() {
  let inThink = false;
  let pending = ''; // held-back text: a possible partial tag, or in-think residue
  let hadReasoningFlag = false;

  /** Largest suffix of s that is a proper prefix of tag. */
  function holdback(s, tag) {
    for (let h = Math.min(tag.length - 1, s.length); h >= 1; h--) {
      if (tag.startsWith(s.slice(s.length - h))) return h;
    }
    return 0;
  }

  /** Could s still be the beginning of an open tag (possibly with attributes)? */
  function couldBecomeOpen(s) {
    return OPEN_BASE.startsWith(s) || (s.startsWith(OPEN_BASE) && !s.includes('>'));
  }

  /**
   * @param {string} chunk
   */
  function push(chunk) {
    let buf = pending + chunk;
    pending = '';
    let out = '';
    for (;;) {
      if (inThink) {
        const c = CLOSE_RE.exec(buf);
        if (c) {
          buf = buf.slice(c.index + c[0].length);
          inThink = false;
          continue;
        }
        // Still reasoning: drop everything except a possible partial close tag.
        const hold = Math.min(CLOSE_BASE.length - 1, buf.length);
        let h = 0;
        for (let k = hold; k >= 1; k--) {
          if (CLOSE_BASE.startsWith(buf.slice(buf.length - k))) {
            h = k;
            break;
          }
        }
        pending = h > 0 ? buf.slice(buf.length - h) : '';
        return out;
      }
      const lt = buf.indexOf('<');
      if (lt < 0) {
        // No tag start in sight: release all but a possible tag-prefix suffix.
        let h = 0;
        for (let k = Math.min(OPEN_BASE.length, buf.length); k >= 1; k--) {
          if (OPEN_BASE.startsWith(buf.slice(buf.length - k))) {
            h = k;
            break;
          }
        }
        out += buf.slice(0, buf.length - h);
        pending = buf.slice(buf.length - h);
        return out;
      }
      out += buf.slice(0, lt);
      buf = buf.slice(lt);
      const m = OPEN_RE.exec(buf);
      if (m && m.index === 0) {
        inThink = true;
        hadReasoningFlag = true;
        buf = buf.slice(m[0].length);
        continue;
      }
      if (couldBecomeOpen(buf)) {
        pending = buf; // possible partial open tag — hold everything
        return out;
      }
      // A literal '<' that is not a think tag: release it and keep scanning.
      out += buf[0];
      buf = buf.slice(1);
    }
  }

  return {
    get hadReasoning() {
      return hadReasoningFlag;
    },
    /** Fold a raw content chunk through the tag filter. @param {string} chunk */
    push(chunk) {
      return push(chunk);
    },
    /**
     * Fold one provider stream delta. Reasoning channels are dropped entirely;
     * content goes through the tag filter.
     * @param {{content?: unknown, reasoning?: unknown, reasoning_content?: unknown}} d
     */
    delta(d) {
      if (!d || typeof d !== 'object') return '';
      if (
        (typeof d.reasoning === 'string' && d.reasoning) ||
        (typeof d.reasoning_content === 'string' && d.reasoning_content)
      ) {
        hadReasoningFlag = true;
        return '';
      }
      if (typeof d.content !== 'string' || !d.content) return '';
      return push(d.content);
    },
    /**
     * End of stream. Held text means different things by state:
     * - inside reasoning: it is reasoning residue (or a partial close tag) — dropped;
     * - outside reasoning: it is a literal '<' or partial tag text that never
     *   completed, e.g. "Price is <". The whole-reply rule (stripThink) keeps it,
     *   so the stream must release it too, or the two paths disagree.
     * @returns {string} text to append to the answer
     */
    flush() {
      const tail = inThink ? '' : pending;
      pending = '';
      return tail;
    },
  };
}
