/**
 * Provider adapters — Tolesh never hard-codes a vendor (AGENTS.md rule).
 *
 * Each adapter implements:
 *   chat({ messages, model, signal }) -> { text, model, usage?, raw? }
 *   info() -> { id, label, available, defaultModel, models }
 *
 * The Dahl API follows the OpenAI Chat Completions request/response schema
 * (base URL https://inference.dahl.global/v1, Bearer auth, /chat/completions).
 * When DAHL_API_KEY is absent the adapter reports itself unavailable instead
 * of pretending to work — the UI surfaces this honestly.
 */
import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_TIMEOUT_MS = Number(process.env.MODEL_TIMEOUT_MS ?? 30_000);
const DEFAULT_MAX_RETRIES = Number(process.env.MODEL_MAX_RETRIES ?? 2);

/** Errors that are safe to show the user verbatim (no secrets, no stack traces). */
export class ProviderError extends Error {
  /**
   * @param {string} kind  machine-readable: 'no_key' | 'auth' | 'rate_limit' | 'timeout' | 'network' | 'provider' | 'provider_down' | 'cancelled'
   * @param {string} message human-readable, safe to display
   * @param {{status?: number, retryAfterMs?: number|null}} [details]
   */
  constructor(kind, message, details = {}) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
    this.status = details.status;
    this.retryAfterMs = details.retryAfterMs ?? null;
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
 * Shared request machinery: timeout, bounded retries with backoff for
 * transient failures (429/5xx/network), and honest error mapping.
 * @param {string} url
 * @param {{apiKey: string, timeoutMs?: number, maxRetries?: number} & RequestInit} args
 */
export async function apiFetch(url, { apiKey, timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES, ...init }) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
      if (status === 429 || status >= 500) {
        lastError =
          status === 429
            ? new ProviderError('rate_limit', 'The AI provider is rate limiting requests. Try again shortly.', {
                status,
                retryAfterMs: parseRetryAfter(res),
              })
            : new ProviderError('provider', `AI provider error (${status}).`, { status });
        if (attempt < maxRetries) {
          await delay(parseRetryAfter(res) ?? 500 * 2 ** attempt);
          continue;
        }
      } else if (status === 401 || status === 403) {
        throw new ProviderError('auth', 'AI provider rejected the configured API key.', { status });
      } else {
        throw new ProviderError('provider', `AI provider rejected the request (${status}).`, { status });
      }
    } catch (err) {
      if (outerSignal?.aborted) {
        // The client went away (Stop button / navigation) — not a timeout,
        // and pointless to retry.
        throw new ProviderError('cancelled', 'Request cancelled.');
      }
      if (/** @type {any} */ (err)?.name === 'AbortError') {
        lastError = new ProviderError('timeout', 'The AI provider took too long to respond.');
      } else if (err instanceof ProviderError) {
        lastError = err;
      } else {
        lastError = new ProviderError('network', 'Could not reach the AI provider.');
      }
      if (attempt < maxRetries) {
        await delay(500 * 2 ** attempt);
        continue;
      }
    } finally {
      clearTimeout(timer);
      outerSignal?.removeEventListener('abort', onAbort);
    }
    break;
  }
  throw lastError ?? new ProviderError('network', 'Could not reach the AI provider.');
}

/**
 * Read a Chat-Completions-style JSON response safely.
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
  const text = choice?.message?.content;
  if (typeof text !== 'string') {
    throw new ProviderError('provider', 'AI provider response had no message content.');
  }
  return { text, usage: data.usage ?? null, model: data.model ?? choice?.model ?? null };
}

/**
 * OpenAI-compatible chat-completions adapter (covers Dahl and any endpoint
 * with the same schema). All configuration via env — never hard-coded.
 * @param {string} baseEnv
 * @param {string} keyEnv
 * @param {string} label
 * @param {string} defaultModel
 * @param {string[]} models
 */
function openAiCompatible(baseEnv, keyEnv, label, defaultModel, models = []) {
  return {
    info() {
      const baseURL = process.env[baseEnv];
      const apiKey = process.env[keyEnv];
      return {
        id: keyEnv.toLowerCase().replace('_api_key', ''),
        label,
        available: Boolean(baseURL && apiKey),
        defaultModel: process.env.MODEL_ID ?? defaultModel,
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
      const res = await apiFetch(new URL('chat/completions', baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href, {
        method: 'POST',
        apiKey,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(model ?? process.env.MODEL_ID ?? defaultModel
            ? { model: model ?? process.env.MODEL_ID ?? defaultModel }
            : {}),
          messages,
          ...(temperature !== undefined ? { temperature } : {}),
        }),
        signal,
      });
      return readCompletion(res);
    },
  };
}

/** Dahl — https://inference.dahl.global (OpenAI-compatible schema per their quickstart). */
export const dahl = openAiCompatible('DAHL_BASE_URL', 'DAHL_API_KEY', 'Dahl', process.env.DAHL_MODEL ?? '');

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
