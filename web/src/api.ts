/**
 * API client — typed, with honest error mapping from the server's
 * { error: { kind, message, retryAfterMs } } responses.
 */
import { readSse } from './sse';

export type ProviderInfo = {
  id: string;
  label: string;
  available: boolean;
  defaultModel: string;
  models: string[];
  needsKey: boolean;
};

export type ChatErrorKind = 'no_key' | 'auth' | 'rate_limit' | 'timeout' | 'network' | 'provider' | 'cancelled' | 'bad_request' | 'too_long' | 'not_found' | 'bad_json' | 'internal';

export class ApiError extends Error {
  kind: ChatErrorKind;
  retryAfterMs: number | null;
  status: number;
  constructor(kind: ChatErrorKind, message: string, status: number, retryAfterMs: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export type ChatMessage = { id: number | string; role: 'user' | 'assistant'; content: string; createdAt?: string };

export type Conversation = {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  messages?: ChatMessage[];
};

const BASE = import.meta.env.VITE_API_BASE ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch (err) {
    // Deliberate aborts pass through so callers can distinguish them from
    // genuine network failures (which surface as "server unreachable").
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    // fetch-level failure: server down, CORS, offline
    throw new ApiError('network', 'Cannot reach the Tolesh server. Is it running?', 0);
  }
  if (!res.ok) {
    let kind: ChatErrorKind = 'internal';
    let message = `Request failed (${res.status}).`;
    let retryAfterMs: number | null = null;
    try {
      const body = (await res.json()) as { error?: { kind?: string; message?: string; retryAfterMs?: number | null } };
      if (body?.error) {
        kind = (body.error.kind as ChatErrorKind) ?? kind;
        message = body.error.message ?? message;
        retryAfterMs = body.error.retryAfterMs ?? null;
      }
    } catch {
      /* non-JSON error body — keep defaults */
    }
    throw new ApiError(kind, message, res.status, retryAfterMs);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ ok: boolean }>('/api/health'),

  providers: () => request<{ providers: ProviderInfo[]; active: string }>('/api/providers'),

  listConversations: () => request<{ conversations: Conversation[] }>('/api/conversations'),

  createConversation: (title?: string) =>
    request<{ conversation: Conversation }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify(title ? { title } : {}),
    }),

  getConversation: (id: string) => request<{ conversation: Conversation }>(`/api/conversations/${encodeURIComponent(id)}`),

  deleteConversation: (id: string) => request<{ ok: boolean }>(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /** One conversation turn. Returns the assistant reply text. */
  chat: (conversationId: string, message: string, signal?: AbortSignal) =>
    request<{ reply: string; model: string | null; conversationId: string }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ conversationId, message }),
      signal,
    }),

  /**
   * One conversation turn, streamed: answer deltas (already stripped of
   * reasoning server-side) arrive through `onDelta` as the model speaks,
   * and the promise resolves with the full cleaned reply once done.
   */
  chatStream: async (
    conversationId: string,
    message: string,
    opts: { onDelta?: (delta: string) => void; signal?: AbortSignal } = {}
  ): Promise<{ reply: string; model: string | null; conversationId: string; truncated: boolean }> => {
    let res: Response;
    try {
      res = await fetch(`${BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message }),
        signal: opts.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      throw new ApiError('network', 'Cannot reach the Tolesh server. Is it running?', 0);
    }
    if (!res.ok) {
      // Provider failed before anything streamed — the server answered with
      // an honest JSON error (502/503/429), same shape as the non-stream route.
      let kind: ChatErrorKind = 'internal';
      let message = `Request failed (${res.status}).`;
      let retryAfterMs: number | null = null;
      try {
        const body = (await res.json()) as { error?: { kind?: string; message?: string; retryAfterMs?: number | null } };
        if (body?.error) {
          kind = (body.error.kind as ChatErrorKind) ?? kind;
          message = body.error.message ?? message;
          retryAfterMs = body.error.retryAfterMs ?? null;
        }
      } catch {
        /* non-JSON error body — keep defaults */
      }
      throw new ApiError(kind, message, res.status, retryAfterMs);
    }

    let reply = '';
    let model: string | null = null;
    let conversationIdOut = conversationId;
    let streamError: ApiError | null = null;
    let sawDone = false;
    let truncated = false;
    await readSse(res, (name, data) => {
      if (name === 'message' && typeof (data as { delta?: unknown })?.delta === 'string') {
        const delta = (data as { delta: string }).delta;
        reply += delta;
        opts.onDelta?.(delta);
      } else if (name === 'done' && typeof data === 'object' && data !== null) {
        const d = data as { conversationId?: string; model?: string | null; truncated?: boolean };
        sawDone = true;
        truncated = d.truncated === true;
        if (typeof d.conversationId === 'string') conversationIdOut = d.conversationId;
        if (typeof d.model === 'string') model = d.model;
      } else if (name === 'error' && typeof data === 'object' && data !== null) {
        const e = (data as { error?: { kind?: string; message?: string; retryAfterMs?: number | null } }).error;
        streamError = new ApiError(
          (e?.kind as ChatErrorKind) ?? 'provider',
          e?.message ?? 'The assistant stream failed mid-answer.',
          200,
          e?.retryAfterMs ?? null
        );
      }
      // Non-JSON or unknown event payloads are ignored (garbage filtering).
    });
    if (streamError) throw streamError;
    // The server sends `done` only after the reply is saved. Without it the
    // text may be cut off, so never present it as a finished answer.
    if (!sawDone) {
      throw new ApiError('provider', 'The reply was interrupted before it finished. Try again.', 200);
    }
    return { reply, model, conversationId: conversationIdOut, truncated };
  },
};
