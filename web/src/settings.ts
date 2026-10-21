/**
 * Settings — user preferences for the everyday-assistant loop.
 *
 * Scope is deliberately small: what Tolesh says aloud and how the voice
 * loop behaves. Nothing here is telemetry; everything is local to the
 * browser (localStorage with graceful no-storage degradation — the app
 * must work identically when storage is blocked, e.g. private windows).
 */

export type ToleshSettings = {
  /** Speak replies aloud (Web Speech synthesis). Default: on. */
  speechEnabled: boolean;
  /** Utterance rate, 0.5..2 (Web Speech range). Default: 1.02. */
  speechRate: number;
  /** After a spoken reply finishes, start listening again automatically. */
  handsFree: boolean;
};

export const DEFAULT_SETTINGS: ToleshSettings = {
  speechEnabled: true,
  speechRate: 1.02,
  handsFree: false,
};

const KEY = 'tolesh.settings.v1';

/** Clamp rate to the Web Speech valid range, guarding junk from storage. */
function clampRate(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.speechRate;
  return Math.min(2, Math.max(0.5, n));
}

/**
 * Load settings from localStorage. Returns defaults when storage is
 * unavailable, empty, or holds an unrecognized shape — bad data never
 * breaks the app.
 */
export function loadSettings(store: Storage | null = safeStorage()): ToleshSettings {
  if (!store) return { ...DEFAULT_SETTINGS };
  try {
    const raw = store.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_SETTINGS };
    const o = parsed as Record<string, unknown>;
    return {
      speechEnabled: typeof o.speechEnabled === 'boolean' ? o.speechEnabled : DEFAULT_SETTINGS.speechEnabled,
      speechRate: clampRate(o.speechRate),
      handsFree: typeof o.handsFree === 'boolean' ? o.handsFree : DEFAULT_SETTINGS.handsFree,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Merge a partial change and persist. Storage failures are swallowed —
 * settings stay in-memory for the session rather than breaking the UI.
 */
export function saveSettings(
  current: ToleshSettings,
  change: Partial<ToleshSettings>,
  store: Storage | null = safeStorage()
): ToleshSettings {
  const next: ToleshSettings = {
    speechEnabled: typeof change.speechEnabled === 'boolean' ? change.speechEnabled : current.speechEnabled,
    speechRate: clampRate(change.speechRate ?? current.speechRate),
    handsFree: typeof change.handsFree === 'boolean' ? change.handsFree : current.handsFree,
  };
  if (store) {
    try {
      store.setItem(KEY, JSON.stringify(next));
    } catch {
      // quota/private mode: keep the in-memory value, try again next change
    }
  }
  return next;
}

export function clearSettings(store: Storage | null = safeStorage()): void {
  try {
    store?.removeItem(KEY);
  } catch {
    // unavailable storage — nothing to clear
  }
}

/** localStorage can throw on access (blocked cookies) — never let it crash boot. */
function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    s.setItem('tolesh.probe', '1');
    s.removeItem('tolesh.probe');
    return s;
  } catch {
    return null;
  }
}

/**
 * Hands-free loop decision: after a spoken reply finishes, should Tolesh
 * start listening again? Only in hands-free mode, only when recognition is
 * supported, and only when the reply actually completed (not an error/
 * interrupt path — callers pass done=false there).
 */
export function shouldResumeListening(
  settings: ToleshSettings,
  support: { recognition: boolean }
): boolean {
  return settings.handsFree && support.recognition;
}
