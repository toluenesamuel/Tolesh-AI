/**
 * HUD module tests — run in plain node (no DOM): window/devicePixelRatio are
 * stubbed, and the 2d context is a recording Proxy. The real canvas rendering
 * is covered by browser verification, not here.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { Hud } from '../src/hud';

const STATES = ['idle', 'listening', 'thinking', 'speaking', 'error', 'offline'] as const;

beforeAll(() => {
  // Minimal window stub — the Hud only reads devicePixelRatio.
  (globalThis as Record<string, unknown>).window = { devicePixelRatio: 1 };
});

function makeCanvas(calls: string[]): HTMLCanvasElement {
  const noop = () => {};
  const fakeCtx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'createRadialGradient') return () => ({ addColorStop: noop });
        calls.push(String(prop));
        return noop;
      },
    }
  );
  return {
    width: 0,
    height: 0,
    clientWidth: 300,
    clientHeight: 300,
    getContext: () => fakeCtx,
  } as unknown as HTMLCanvasElement;
}

describe('hud module', () => {
  it('constructs, cycles all states, and draws (stubbed 2d context)', () => {
    const calls: string[] = [];
    const hud = new Hud({ canvas: makeCanvas(calls), reducedMotion: true });
    for (const s of STATES) {
      hud.setState(s);
      expect(hud.getState()).toBe(s);
    }
    // static frame drawn at construction and on each state change
    expect(calls).toContain('clearRect');
    expect(calls).toContain('arc');
  });

  it('setLevel clamps into 0..1 (no throw)', () => {
    const calls: string[] = [];
    const hud = new Hud({ canvas: makeCanvas(calls), reducedMotion: true });
    expect(() => {
      hud.setLevel(-5);
      hud.setLevel(42);
      hud.setLevel(0.5);
    }).not.toThrow();
  });
});

