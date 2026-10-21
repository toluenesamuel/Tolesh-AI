/**
 * Provider adapters — Tolesh never hard-codes a vendor (AGENTS.md rule).
 *
 * Each adapter implements:
 *   chat({ messages, model, signal }) -> { text, model, truncated, usage?, raw? }
 *   stream({ messages, model, signal }, onDelta) -> { text, model, truncated, ... }
 *   info() -> { id, label, available, defaultModel, modelPinned, maxTokens, models, needsKey }
 *
 * The Dahl API follows the OpenAI Chat Completions request/response schema
 * (base URL https://inference.dahl.global/v1, Bearer auth, /chat/completions).
 * When DAHL_API_KEY is absent the adapter reports itself unavailable instead
 * of pretending to work — the UI surfaces this honestly.
 *
 * Reliability rules (2026-10-19 review):
 *  - Only transient failures are retried (429, 5xx, timeout, network). Auth and
 *    other 4xx responses fail immediately: retrying them cannot succeed.
 *  - Every request carries an explicit max_tokens budget. A reply that stops
 *    because the budget ran out is detected (finish_reason === 'length'); if
 *    nothing was streamed yet, exactly one retry runs with a doubled budget.
 *  - A stream that ends without [DONE] or a finish_reason is reported as
 *    truncated, never silently treated as complete.
 */
import { setTimeout as delay } from 'node:timers/promises';
import { extractFinalAnswer, createThinkFilter } from './final-answer.js';

/** Parse an integer env var; fall back when missing or invalid. */
function intEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const DEFAULT_TIMEOUT_MS = intEnv('MODEL_TIMEOUT_MS', 30_000);
const DEFAULT_MAX_RETRIES = intEnv('MODEL_MAX_RETRIES', 2);
export const MAX_TOKENS_CEILING = 8192;

/** Output budget for one reply. Reasoning models spend tokens before answering. */
export function configuredMaxTokens() {
  return Math.min(intEnv('MODEL_MAX_TOKENS', 2048), MAX_TOKENS_CEILING);
}

/** Errors that are safe to show the user verbatim (no secrets, no stack traces). */
export class ProviderError extends Error {
  /**
   * @param {string} kind  machine-readable: 'no_key' | 'auth' | 'rate_limit' | 'timeout' | 'network' | 'provider' | 'truncated' | 'cancelled'
   * @param {string} message human-readable, safe to display
   * @param {{status?: number, retryAfterMs?: number|null, retryable?: boolean}} [details]
   */
  constructor(kind, message, details = {}) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
    this.status = details.status;
    this.retryAfterMs = details.retryAfterMs ?? null;
    this.retryable = details.retryable === true;
  }
}

/** Parse Retry-After (seconds or HTTP-date) into milliseconds, or null. */
function parseRetryAfter(res) {
  const raw = res.headers?.get?.('retry-after');
  if (!raw) return null;
  const asSeconds = Number(raw);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return Math.min(asSeconds * 1000, 60_000);
  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) return Math.max(0, Math.min(asDate - Date.now(), 60_000));
  return null;
}

/**
 * One HTTP attempt. Returns the Response when it is OK; otherwise throws a
 * ProviderError whose `retryable` flag says whether another attempt can help.
 */
async function attemptFetch(url, { apiKey, timeoutMs, init }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const outerSignal = /** @type {AbortSignal|undefined} */ (init.signal);
  const onAbort = () => controller.abort();
  outerSignal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(/** @type {any} */ (init).headers ?? {}),
      },
    });
    if (res.ok) return res;
    const status = res.status;
    if (status === 429) {
      throw new ProviderError('rate_limit', 'The AI provider is rate limiting requests. Try again shortly.', {
        status,
        retryAfterMs: parseRetryAfter(res),
        retryable: true,
      });
    }
    if (status >= 500) {
      throw new ProviderError('provider', `AI provider error (${status}).`, {
        status,
        retryAfterMs: parseRetryAfter(res),
        retryable: true,
      });
    }
    if (status === 401 || status === 403) {
      throw new ProviderError('auth', 'AI provider rejected the configured API key.', { status });
    }
    throw new ProviderError('provider', `AI provider rejected the request (${status}).`, { status });
  } catch (err) {
    if (outerSignal?.aborted) {
      // The client went away (Stop button / navigation): not a timeout, never retried.
      throw new ProviderError('cancelled', 'Request cancelled.');
    }
    if (err instanceof ProviderError) throw err;
    if (/** @type {any} */ (err)?.name === 'AbortError') {
      throw new ProviderError('timeout', 'The AI provider took too long to respond.', { retryable: true });
    }
    throw new ProviderError('network', 'Could not reach the AI provider.', { retryable: true });
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Shared request machinery: timeout, bounded retries with backoff for
 * transient failures only, and honest error mapping.
 * @param {string} url
 * @param {{apiKey: string, timeoutMs?: number, maxRetries?: number} & RequestInit} args
 */
export async function apiFetch(url, { apiKey, timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES, ...init }) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await attemptFetch(url, { apiKey, timeoutMs, init });
    } catch (err) {
      lastError = err;
      if (!(err instanceof ProviderError) || !err.retryable || attempt >= maxRetries) throw err;
      const wait = err.retryAfterMs ?? 500 * 2 ** attempt;
      try {
        await delay(wait, undefined, { signal: /** @type {AbortSignal|undefined} */ (init.signal) });
      } catch {
        // Aborted during backoff: the client went away, so stop retrying.
        throw new ProviderError('cancelled', 'Request cancelled.');
      }
    }
  }
  throw lastError ?? new ProviderError('network', 'Could not reach the AI provider.');
}

/**
 * Read a Chat-Completions-style JSON response safely and extract ONLY the
 * user-facing final answer (reasoning channels are dropped at the source —
 * see final-answer.js for the per-provider evidence).
 * @param {Response} res
 */
async function readCompletion(res) {
  let data;
  try {
    data = await res.json();
  } catch {
    throw new ProviderError('provider', 'AI provider returned an unparseable response.');
  }
  const choice = data?.choices?.[0];
  if (!choice) throw new ProviderError('provider', 'AI provider response had no choices.');
  const { answer, hadReasoning } = extractFinalAnswer(choice?.message ?? null);
  const finishReason = typeof choice.finish_reason === 'string' ? choice.finish_reason : null;
  if (!answer) {
    // Reasoning-only or empty content: never fabricate, never forward reasoning.
    if (finishReason === 'length') {
      throw new ProviderError('truncated', 'The model ran out of room before it finished answering.');
    }
    throw new ProviderError('provider', 'AI provider returned no answer content.');
  }
  return {
    text: answer,
    hadReasoning,
    usage: data.usage ?? null,
    model: data.model ?? choice?.model ?? null,
    finishReason,
    truncated: finishReason === 'length',
  };
}

/** Wait for the next SSE chunk, failing if the provider goes silent. */
function readWithIdle(reader, idleMs) {
  let timer;
  const idle = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new ProviderError('timeout', 'The AI provider stopped sending data.', { retryable: false })),
      idleMs
    );
  });
  return Promise.race([reader.read(), idle]).finally(() => clearTimeout(timer));
}

/**
 * Read an SSE chat-completions stream, yielding answer deltas through
 * `onDelta` (reasoning deltas and inline think blocks never pass), and
 * resolving with the full cleaned answer text.
 * @param {Response} res
 * @param {(delta: string) => void} onDelta
 * @param {{idleMs?: number}} [opts]
 */
async function readStream(res, onDelta, { idleMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!res.body || typeof res.body.getReader !== 'function') {
    throw new ProviderError('provider', 'AI provider returned no stream body.');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const filter = createThinkFilter();
  /** @type {string[]} */
  const parts = [];
  let sse = ''; // partial SSE line carry between chunks
  let model = null;
  let sawAnyData = false;
  let sawDone = false;
  let finish = null;
  try {
    for (;;) {
      const { done, value } = await readWithIdle(reader, idleMs);
      if (done) break;
      sse += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = sse.indexOf('\n')) >= 0) {
        const line = sse.slice(0, nl).trim();
        sse = sse.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          sawDone = true;
          continue;
        }
        let j;
        try {
          j = JSON.parse(payload);
        } catch {
          continue; // malformed SSE line — skip, keep the stream alive
        }
        sawAnyData = true;
        if (!model && typeof j.model === 'string') model = j.model;
        const choice = j.choices?.[0];
        if (choice?.finish_reason) finish = choice.finish_reason;
        const delta = choice?.delta ?? {};
        const out = filter.delta(delta);
        if (out) {
          parts.push(out);
          onDelta?.(out);
        }
      }
    }
  } catch (err) {
    // Stop reading from the provider on idle timeout or any other failure.
    await reader.cancel?.().catch(() => {});
    throw err;
  }
  const tail = filter.flush();
  if (tail) {
    parts.push(tail);
    onDelta?.(tail);
  }
  if (!sawAnyData) {
    throw new ProviderError('provider', 'AI provider stream ended without any events.');
  }
  const text = parts.join('');
  // A stream that ends without [DONE] and without a finish_reason was cut off.
  const incomplete = !sawDone && finish === null;
  const truncated = finish === 'length' || incomplete;
  if (!text) {
    if (finish === 'length') {
      throw new ProviderError('truncated', 'The model ran out of room before it finished answering.');
    }
    throw new ProviderError('provider', filter.hadReasoning ? 'The model reasoned but returned no answer.' : 'AI provider returned an empty answer.');
  }
  return { text, hadReasoning: filter.hadReasoning, model, finishReason: finish, truncated };
}

/**
 * OpenAI-compatible chat-completions adapter (covers Dahl and any endpoint
 * with the same schema). All configuration via env — never hard-coded.
 * @param {string} baseEnv
 * @param {string} keyEnv
 * @param {string} label
 * @param {string} modelEnv  env var holding the pinned model id for this provider
 * @param {string[]} models
 */
function openAiCompatible(baseEnv, keyEnv, label, modelEnv, models = []) {
  /** Effective model: MODEL_ID overrides the provider-specific pin. Empty = not pinned. */
  const effectiveModel = () => process.env.MODEL_ID || process.env[modelEnv] || '';

  const endpoint = () => {
    const baseURL = process.env[baseEnv];
    return new URL('chat/completions', baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href;
  };

  const buildBody = (messages, model, temperature, maxTokens, stream) => {
    const resolved = model || effectiveModel();
    return JSON.stringify({
      ...(resolved ? { model: resolved } : {}),
      messages,
      max_tokens: maxTokens,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(stream ? { stream: true } : {}),
    });
  };

  /**
   * Run `attempt(budget)`; if the reply ran out of tokens before answering,
   * retry exactly once with a doubled budget (capped). `attempt` must only
   * fail with 'truncated' before any user-visible output was produced.
   */
  const withOneBudgetRetry = async (attempt) => {
    const first = configuredMaxTokens();
    try {
      return await attempt(first);
    } catch (err) {
      if (err instanceof ProviderError && err.kind === 'truncated') {
        const second = Math.min(first * 2, MAX_TOKENS_CEILING);
        if (second > first) return attempt(second);
      }
      throw err;
    }
  };

  return {
    info() {
      const baseURL = process.env[baseEnv];
      const apiKey = process.env[keyEnv];
      const model = effectiveModel();
      return {
        id: keyEnv.toLowerCase().replace('_api_key', ''),
        label,
        available: Boolean(baseURL && apiKey),
        defaultModel: model,
        modelPinned: Boolean(model),
        maxTokens: configuredMaxTokens(),
        models,
        needsKey: !apiKey,
      };
    },
    /**
     * @param {{messages: Array<{role: string, content: string}>, model?: string, signal?: AbortSignal, temperature?: number}} req
     */
    async chat({ messages, model, signal, temperature }) {
      const baseURL = process.env[baseEnv];
      const apiKey = process.env[keyEnv];
      if (!baseURL || !apiKey) {
        throw new ProviderError('no_key', 'No AI provider key is configured on the server. Add one to enable live responses.');
      }
      return withOneBudgetRetry(async (maxTokens) => {
        const res = await apiFetch(endpoint(), {
          method: 'POST',
          apiKey,
          headers: { 'Content-Type': 'application/json' },
          body: buildBody(messages, model, temperature, maxTokens, false),
          signal,
        });
        return readCompletion(res);
      });
    },
    /**
     * Streaming variant: `onDelta` receives user-facing answer deltas only
     * (reasoning deltas and inline think blocks are dropped server-side, so
     * they can never reach the UI or speech pipeline). Resolves with the full
     * cleaned answer once the stream completes.
     * @param {{messages: Array<{role: string, content: string}>, model?: string, signal?: AbortSignal, temperature?: number}} req
     * @param {(delta: string) => void} [onDelta]
     */
    async stream({ messages, model, signal, temperature }, onDelta) {
      const baseURL = process.env[baseEnv];
      const apiKey = process.env[keyEnv];
      if (!baseURL || !apiKey) {
        throw new ProviderError('no_key', 'No AI provider key is configured on the server. Add one to enable live responses.');
      }
      // Retry is only safe while nothing has reached the user yet.
      let emitted = false;
      const relay = (d) => {
        emitted = true;
        onDelta?.(d);
      };
      return withOneBudgetRetry(async (maxTokens) => {
        const res = await apiFetch(endpoint(), {
          method: 'POST',
          apiKey,
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          body: buildBody(messages, model, temperature, maxTokens, true),
          signal,
        });
        try {
          return await readStream(res, relay);
        } catch (err) {
          if (emitted && err instanceof ProviderError && err.kind === 'truncated') {
            throw new ProviderError('provider', 'The reply was cut off before it finished.');
          }
          throw err;
        }
      });
    },
  };
}

/** Dahl — https://inference.dahl.global (OpenAI-compatible schema per their quickstart). */
export const dahl = openAiCompatible('DAHL_BASE_URL', 'DAHL_API_KEY', 'Dahl', 'DAHL_MODEL');

/** Registry of known providers. Active provider = `AI_PROVIDER` env, else first available. */
export const providers = [dahl];

/**
 * Resolve the adapter to use for a request.
 * @param {string} [requested] provider id from the client
 */
export function resolveProvider(requested) {
  if (requested) {
    const found = providers.find((p) => p.info().id === requested);
    if (found) return found;
  }
  return providers.find((p) => p.info().available) ?? providers[0];
}
