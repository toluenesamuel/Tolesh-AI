/**
 * POST /api/chat — one conversation turn.
 * Persists both messages, calls the provider adapter, returns the reply.
 * Provider errors map to honest HTTP responses; client disconnects abort the
 * upstream call. Dependency-free per-IP rate limiting with bounded memory.
 */
const MAX_MESSAGE_CHARS = 8_000;
const MAX_HISTORY_SENT = 40;

/**
 * Dependency-free per-IP rate limiter (bounded memory, self-cleaning).
 * @param {number} limitPerMinute
 */
export function createRateLimiter(limitPerMinute) {
  /** @type {Map<string, number[]>} */
  const buckets = new Map();
  setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [ip, times] of buckets) {
      while (times.length && times[0] < cutoff) times.shift();
      if (times.length === 0) buckets.delete(ip);
    }
  }, 30_000).unref();
  return {
    /** @param {string} ip */
    allow(ip) {
      const now = Date.now();
      const times = buckets.get(ip) ?? [];
      while (times.length && times[0] < now - 60_000) times.shift();
      if (times.length >= limitPerMinute) return false;
      times.push(now);
      buckets.set(ip, times);
      return true;
    },
  };
}

/**
 * @param {{store: any, resolveProvider: Function, buildModelMessages: Function, rateLimit?: number}} deps
 */
export function createChatRoute({ store, resolveProvider, buildModelMessages, rateLimit = 60 }) {
  const limiter = createRateLimiter(rateLimit);

  /**
   * @param {any} req
   * @param {any} res
   */
  async function handler(req, res) {
    if (!limiter.allow(req.ip ?? 'unknown')) {
      res.status(429).json({ error: { kind: 'rate_limit', message: 'Too many requests — slow down a little.' } });
      return;
    }
    const { conversationId, message, provider } = req.body ?? {};
    if (typeof conversationId !== 'string' || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: { kind: 'bad_request', message: 'conversationId and message are required.' } });
      return;
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      res.status(413).json({ error: { kind: 'too_long', message: `Message too long (max ${MAX_MESSAGE_CHARS} characters).` } });
      return;
    }
    const conversation = store.getConversation(conversationId);
    if (!conversation) {
      res.status(404).json({ error: { kind: 'not_found', message: 'Conversation not found.' } });
      return;
    }

    store.addMessage(conversationId, 'user', message.trim());
    // The user message stays persisted even if the provider fails: they did
    // send it, and a retry should see it in history. The assistant turn is
    // only persisted when a real reply exists.
    const history = [...conversation.messages, { role: 'user', content: message.trim() }];
    const adapter = resolveProvider(typeof provider === 'string' ? provider : undefined);

    try {
      const result = await adapter.chat({
        messages: buildModelMessages(history.slice(-MAX_HISTORY_SENT)),
        signal: req.abortSignal,
      });
      store.addMessage(conversationId, 'assistant', result.text);
      res.json({ reply: result.text, model: result.model, conversationId });
    } catch (err) {
      if (err instanceof Error && err.name === 'ProviderError') {
        const kind = /** @type {any} */ (err).kind;
        res.status(kind === 'no_key' ? 503 : kind === 'rate_limit' ? 429 : kind === 'cancelled' ? 499 : 502).json({
          error: {
            kind,
            message: err.message,
            retryAfterMs: /** @type {any} */ (err).retryAfterMs,
          },
        });
        return;
      }
      throw err;
    }
  }

  return { handler };
}

/** Map a ProviderError to an honest HTTP response (used by the error middleware). */
export function providerErrorResponse(res, err) {
  const status = err.kind === 'no_key' ? 503 : err.kind === 'rate_limit' ? 429 : err.kind === 'cancelled' ? 499 : 502;
  res.status(status).json({
    error: { kind: err.kind, message: err.message, retryAfterMs: err.retryAfterMs },
  });
}

/** Map a ProviderError to an HTTP status (shared by JSON and SSE paths). */
function statusForKind(kind) {
  return kind === 'no_key' ? 503 : kind === 'rate_limit' ? 429 : kind === 'cancelled' ? 499 : 502;
}

/**
 * Create the streaming chat route: POST /api/chat/stream → text/event-stream.
 * Emits only user-facing answer deltas — the provider layer already dropped
 * reasoning channels and inline think blocks, so the SSE body can never carry
 * private reasoning (no CSS hiding; it never enters the pipeline).
 * The full cleaned answer is persisted when the stream completes.
 *
 * SSE events:
 *   data: {"delta":"…"}      one or more times — answer text only
 *   event: done\ndata: {...}  final: {conversationId, model}
 *   event: error\ndata: {"error":{kind,message}} — mid-stream failures
 *
 * @param {{store: any, resolveProvider: Function, buildModelMessages: Function, rateLimit?: number}} deps
 */
export function createChatStreamRoute({ store, resolveProvider, buildModelMessages, rateLimit = 60 }) {
  const limiter = createRateLimiter(rateLimit);

  /**
   * @param {any} req
   * @param {any} res
   */
  async function handler(req, res) {
    if (!limiter.allow(req.ip ?? 'unknown')) {
      res.status(429).json({ error: { kind: 'rate_limit', message: 'Too many requests — slow down a little.' } });
      return;
    }
    const { conversationId, message, provider } = req.body ?? {};
    if (typeof conversationId !== 'string' || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: { kind: 'bad_request', message: 'conversationId and message are required.' } });
      return;
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      res.status(413).json({ error: { kind: 'too_long', message: `Message too long (max ${MAX_MESSAGE_CHARS} characters).` } });
      return;
    }
    const conversation = store.getConversation(conversationId);
    if (!conversation) {
      res.status(404).json({ error: { kind: 'not_found', message: 'Conversation not found.' } });
      return;
    }
    const adapter = resolveProvider(typeof provider === 'string' ? provider : undefined);
    if (typeof adapter.stream !== 'function') {
      res.status(502).json({ error: { kind: 'provider', message: 'Provider does not support streaming.' } });
      return;
    }

    store.addMessage(conversationId, 'user', message.trim());
    const history = [...conversation.messages, { role: 'user', content: message.trim() }];

    // SSE headers are deferred until the first answer delta: a provider that
    // fails before streaming anything yields an honest HTTP error response
    // (502/503/429 JSON) instead of a 200 event-stream.
    let streaming = false;
    const startSse = () => {
      if (res.headersSent) return;
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
    };
    const send = (event, data) => {
      startSse();
      res.write(event === 'message' ? `data: ${JSON.stringify(data)}\n\n` : `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await adapter.stream(
        {
          messages: buildModelMessages(history.slice(-MAX_HISTORY_SENT)),
          signal: req.abortSignal,
        },
        (delta) => {
          streaming = true;
          send('message', { delta });
        }
      );
      store.addMessage(conversationId, 'assistant', result.text);
      send('done', { conversationId, model: result.model ?? null });
      res.end();
    } catch (err) {
      if (err instanceof Error && err.name === 'ProviderError') {
        const kind = /** @type {any} */ (err).kind;
        if (!streaming) {
          // Nothing streamed yet — a plain honest HTTP error is cleaner.
          res.status(statusForKind(kind)).json({
            error: { kind, message: err.message, retryAfterMs: /** @type {any} */ (err).retryAfterMs ?? null },
          });
          return;
        }
        if (!res.writableEnded && !req.abortSignal?.aborted) {
          res.write(`event: error\ndata: ${JSON.stringify({ error: { kind, message: err.message, retryAfterMs: /** @type {any} */ (err).retryAfterMs ?? null } })}\n\n`);
          res.end();
        }
        return;
      }
      throw err;
    }
  }

  return { handler };
}
