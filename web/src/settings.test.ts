/** Settings persistence + hands-free loop decision (TDD). */
import { describe, test, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  clearSettings,
  shouldResumeListening,
  type ToleshSettings,
} from './settings';

/** In-memory Storage stand-in (localStorage is unavailable in node). */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  } as unknown as Storage;
}

describe('loadSettings', () => {
  test('defaults when storage is null', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  test('defaults when storage is empty', () => {
    expect(loadSettings(fakeStorage())).toEqual(DEFAULT_SETTINGS);
  });

  test('round-trips a saved change', () => {
    const store = fakeStorage();
    const saved = saveSettings(DEFAULT_SETTINGS, { speechRate: 1.5, handsFree: true }, store);
    expect(loadSettings(store)).toEqual(saved);
    expect(loadSettings(store).speechRate).toBe(1.5);
  });

  test('bad JSON falls back to defaults', () => {
    const store = fakeStorage();
    store.setItem('tolesh.settings.v1', '{not json');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  test('unknown shape and junk rate are sanitized, known fields kept', () => {
    const store = fakeStorage();
    store.setItem('tolesh.settings.v1', JSON.stringify({ speechEnabled: false, speechRate: 'banana', handsFree: 'yes' }));
    const s = loadSettings(store);
    expect(s.speechRate).toBe(DEFAULT_SETTINGS.speechRate); // 'yes'→NaN→default path? no: rate junk clamps
    expect(s.handsFree).toBe(false); // not a boolean → default
    expect(typeof s.speechEnabled).toBe('boolean');
  });

  test('rate out of range is clamped (0.5..2)', () => {
    const store = fakeStorage();
    store.setItem('tolesh.settings.v1', JSON.stringify({ speechRate: 9 }));
    expect(loadSettings(store).speechRate).toBe(2);
    store.setItem('tolesh.settings.v1', JSON.stringify({ speechRate: -3 }));
    expect(loadSettings(store).speechRate).toBe(0.5);
  });
});

describe('saveSettings', () => {
  test('merges a partial change and persists it', () => {
    const store = fakeStorage();
    const s = saveSettings(DEFAULT_SETTINGS, { handsFree: true }, store);
    expect(s.handsFree).toBe(true);
    expect(s.speechEnabled).toBe(true); // untouched
    expect(JSON.parse(store.getItem('tolesh.settings.v1')!)).toEqual(s);
  });

  test('rate is clamped on save', () => {
    const s = saveSettings(DEFAULT_SETTINGS, { speechRate: 100 }, null);
    expect(s.speechRate).toBe(2);
  });

  test('throwing store does not break the merge', () => {
    const throwing = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    const s = saveSettings(DEFAULT_SETTINGS, { speechEnabled: false }, throwing as unknown as Storage);
    expect(s.speechEnabled).toBe(false);
  });
});

describe('clearSettings', () => {
  test('removes the stored key and tolerates missing storage', () => {
    const store = fakeStorage();
    saveSettings(DEFAULT_SETTINGS, { speechRate: 0.5 }, store);
    clearSettings(store);
    expect(store.getItem('tolesh.settings.v1')).toBe(null);
    expect(() => clearSettings(null)).not.toThrow();
  });
});

describe('shouldResumeListening (hands-free loop)', () => {
  const base: ToleshSettings = { ...DEFAULT_SETTINGS };
  test('resumes only in hands-free mode with recognition support', () => {
    expect(shouldResumeListening({ ...base, handsFree: true }, { recognition: true })).toBe(true);
  });
  test('not in push-to-talk mode', () => {
    expect(shouldResumeListening({ ...base, handsFree: false }, { recognition: true })).toBe(false);
  });
  test('not when the browser has no recognition', () => {
    expect(shouldResumeListening({ ...base, handsFree: true }, { recognition: false })).toBe(false);
  });
});
