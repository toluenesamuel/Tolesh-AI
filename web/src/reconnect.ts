/**
 * Reconnect backoff — decides when the HUD retries the API health check
 * after the server is unreachable at boot (or drops mid-session). Pure
 * decision functions; the caller in main.ts owns the actual timer.
 *
 * Sequence: 1s, 2s, 4s, 8s, then 10s capped. After MAX_RECONNECT_ATTEMPTS
 * the poller stops and the status pill says offline honestly — the user
 * refreshes to try again (no infinite background chatter).
 */

export const MAX_RECONNECT_ATTEMPTS = 8;
const BASE_MS = 1000;
const MAX_MS = 10000;

/** Milliseconds to wait before retry `attempt` (1-based), or null to stop. */
export function reconnectDelayMs(attempt: number): number | null {
  if (attempt > MAX_RECONNECT_ATTEMPTS) return null;
  return Math.min(MAX_MS, BASE_MS * 2 ** (attempt - 1));
}
