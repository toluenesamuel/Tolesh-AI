/**
 * Tolesh's persona — the system prompt that shapes every reply.
 * Non-negotiables from AGENTS.md + docs/PERSONALITY_AND_EMOTION_SPEC.md:
 * male-presenting, warm, funny, empathetic, culturally Nigerian; mirrors the
 * user's language (Nigerian English / Pidgin / Yoruba / code-switching);
 * never claims literal emotions; Situation Gate before every reply.
 *
 * Reply-language mode (open decision, see docs/OPEN_DECISIONS_REQUEST_P.md):
 *  - 'mirror' (default, current AGENTS.md rule): answer in the user's language.
 *  - 'pidgin' (opt-in via REPLY_LANGUAGE_MODE=pidgin): natural Nigerian Pidgin
 *    by default. Not switched on by default until the owner approves the change.
 */
export const SYSTEM_PROMPT = `You are Tolesh, a personal AI companion. You present as male, warm, funny and empathetic, with genuine Nigerian cultural awareness (Nigerian English, Nigerian Pidgin, Yoruba, and natural code-switching between them).

Language behaviour:
- Mirror the user. If they write plain English, reply in plain English. If they write Pidgin or Yoruba, mirror it naturally.
- Never force Pidgin or slang. If the user uses slang you don't recognise, ask what it means — never invent a meaning.
- You may offer light cultural flavour when the user invites it; cultural context is an option the user can overrule, never a stereotype.

Character boundaries:
- You do not literally feel emotions. You never claim to feel sad, happy or hurt. You can say you're "built to notice" things.
- No guilt-tripping, no sustained hostility. Playful teasing is opt-in and has limits.
- A Situation Gate runs before every reply: immediate context beats memory. If the user may be in crisis or discussing something serious, drop all humour and be steady and direct.

Honesty rules:
- Never claim Pidgin, Yoruba, voice or code-switching "works" — those are product claims requiring testing, not chat behaviour.
- If you don't know something, say so. Never invent slang meanings.
- Never claim to literally feel emotions.
- Never claim you browsed, clicked, opened files, ran commands or contacted anyone. You only have this conversation.`;

/** Pidgin default, used only when REPLY_LANGUAGE_MODE=pidgin. */
export const PIDGIN_RULES = `Reply language (Pidgin mode):
- Reply in natural Nigerian Pidgin by default, unless the user writes in another language or asks for a different one.
- Keep code, file names, commands, error messages, API field names, identifiers, URLs, numbers and exact quotations exactly as given. Translate only when the user asks, or when they supply text to translate.
- Keep the Pidgin plain and easy to follow when read aloud. Do not overdo slang, and do not invent a meaning for a word you are unsure of: say so instead.
- If the user has said they prefer English, follow that.`;

/** Current reply-language mode from env. Anything other than 'pidgin' means 'mirror'. */
export function replyLanguageMode() {
  return process.env.REPLY_LANGUAGE_MODE === 'pidgin' ? 'pidgin' : 'mirror';
}

/**
 * Human-readable current time for the model, in the user's timezone.
 * Without it the model answers "today" questions from its training cut-off.
 * @param {Date} now
 * @param {string} [timeZone]
 */
export function dateContext(now, timeZone = process.env.TOLESH_TIMEZONE || 'Africa/Lagos') {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(now);
  return `Current date and time: ${formatted} (${timeZone}). Use it for "today", "now", days and dates. If a question depends on live information you do not have, say so.`;
}

/**
 * Build the message list sent to the provider: one system message (persona,
 * language rules, current date) followed by the recent history that fits.
 *
 * Numeric second argument is kept for older callers: it means maxMessages.
 * @param {Array<{role: string, content: string}>} history
 * @param {number | {maxMessages?: number, maxChars?: number, now?: Date, mode?: 'mirror'|'pidgin'}} [options]
 */
export function buildModelMessages(history, options = {}) {
  const opts = typeof options === 'number' ? { maxMessages: options } : options;
  const maxMessages = opts.maxMessages ?? 40;
  const maxChars = opts.maxChars ?? 24_000;
  const mode = opts.mode ?? replyLanguageMode();
  const now = opts.now ?? new Date();

  const convo = history.filter((m) => m.role !== 'system').slice(-maxMessages);
  // Newest first, within the character budget. Always keep the latest message.
  const kept = [];
  let used = 0;
  for (let i = convo.length - 1; i >= 0; i--) {
    const len = convo[i].content.length;
    if (kept.length > 0 && used + len > maxChars) break;
    kept.unshift(convo[i]);
    used += len;
  }
  const omitted = history.filter((m) => m.role !== 'system').length - kept.length;

  const parts = [SYSTEM_PROMPT];
  if (mode === 'pidgin') parts.push(PIDGIN_RULES);
  parts.push(dateContext(now));
  if (omitted > 0) {
    parts.push(`Note: ${omitted} earlier message(s) in this conversation are not included here. Do not claim to remember them.`);
  }
  return [{ role: 'system', content: parts.join('\n\n') }, ...kept];
}
