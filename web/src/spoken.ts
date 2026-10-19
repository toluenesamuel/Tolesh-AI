/**
 * Spoken-text shaping — what TTS says for markdown-formatted answers.
 *
 * The transcript bubble shows the raw streamed markdown (meant for eyes);
 * speech gets the shaped form:
 *  - fenced code blocks are never spoken (code is for eyes; reading
 *    `npm install --save-dev` aloud is noise) — skipped by a streaming
 *    filter because fences span deltas and sentences alike;
 *  - inline markers (bold, italics, inline code, links, heading/bullet
 *    prefixes) are stripped per complete sentence.
 *
 * The filter holds back at most a fence-prefix worth of characters, so the
 * first sentence still reaches TTS as early as it did before.
 */

/**
 * Streaming filter that drops fenced-code content.
 * push() returns the speakable text seen for that delta; end() flushes any
 * held-back fence prefix (and swallows everything inside an unclosed block).
 */
export function createSpokenFilter(): {
  push: (delta: string) => string;
  end: () => string;
} {
  let inCode = false;
  let atLineStart = true;
  let hold = ''; // held back while a line start might still grow into a fence

  return {
    push(delta: string): string {
      if (!delta) return '';
      const buf = hold + delta;
      hold = '';
      let out = '';
      let i = 0;
      for (;;) {
        if (inCode) {
          const nl = buf.indexOf('\n', i);
          if (nl === -1) {
            const line = buf.slice(i);
            if (/^[ \t]*`{0,3}$/.test(line)) {
              hold = line; // could still become the closing fence — wait
            }
            // Code content is dropped either way; newline tracking resumes
            // when the held fragment (or the next delta) completes the line.
            i = buf.length;
            break;
          }
          const line = buf.slice(i, nl + 1);
          if (/^[ \t]*```/.test(line)) inCode = false; // closing fence
          i = nl + 1; // fence/code line never spoken; newline kept
          continue;
        }
        if (atLineStart) {
          const rest = buf.slice(i);
          if (!rest.includes('\n') && /^[ \t]*`{0,3}$/.test(rest)) {
            hold = rest; // too early to tell "``" from "```" — wait
            i = buf.length;
            break;
          }
          if (/^[ \t]*```/.test(rest)) {
            // Opening fence (with optional info string): enter code mode.
            const nl = rest.indexOf('\n');
            i = nl >= 0 ? i + nl + 1 : buf.length;
            inCode = true;
            atLineStart = true;
            continue;
          }
        }
        const nl = buf.indexOf('\n', i);
        if (nl === -1) {
          out += buf.slice(i);
          i = buf.length;
          atLineStart = false;
          break; // delta ends mid-line — nothing left to scan this push
        } else {
          out += buf.slice(i, nl + 1);
          i = nl + 1;
          atLineStart = true;
        }
      }
      return out;
    },
    end(): string {
      if (inCode) {
        // Unclosed fence: everything after the opening fence is code.
        hold = '';
        return '';
      }
      const out = hold;
      hold = '';
      return out;
    },
  };
}

/**
 * Per-sentence inline cleanup for speech. Applied to complete sentences
 * (emphasis markers do not cross sentence boundaries), so partial markers
 * spanning deltas are not a concern here. Deliberately conservative: no
 * underscore-emphasis handling — `_snake_case_` words must not be mangled.
 */
export function cleanSpokenText(text: string): string {
  let s = text;
  s = s.replace(/`([^`]*)`/g, '$1'); // inline code → its content
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1'); // bold
  s = s.replace(/\*([^*]+)\*/g, '$1'); // italics
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'); // [label](url) → label
  s = s.replace(/^#{1,6}[ \t]+/, ''); // heading prefix
  s = s.replace(/^[-*+][ \t]+/, ''); // bullet prefix (space required: "-40" is safe)
  s = s.replace(/^\d+[.)][ \t]+/, ''); // ordered-list prefix
  s = s.replace(/[ \t]{2,}/g, ' '); // collapse runs of spaces
  return s.trim();
}
