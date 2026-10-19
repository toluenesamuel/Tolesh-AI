/** Tests for the reconnect backoff decision (pure functions, no timers). */
import { describe, test, expect } from 'vitest';
import { reconnectDelayMs, MAX_RECONNECT_ATTEMPTS } from './reconnect';

describe('reconnect backoff', () => {
  test('first retries come quickly and double (1s, 2s, 4s, 8s)', () => {
    expect(reconnectDelayMs(1)).toBe(1000);
    expect(reconnectDelayMs(2)).toBe(2000);
    expect(reconnectDelayMs(3)).toBe(4000);
    expect(reconnectDelayMs(4)).toBe(8000);
  });

  test('delay caps at 10s so recovery checks stay responsive', () => {
    expect(reconnectDelayMs(5)).toBe(10000);
    expect(reconnectDelayMs(8)).toBe(10000);
  });

  test('returns null after MAX_RECONNECT_ATTEMPTS (stop polling, show offline)', () => {
    for (let a = 1; a <= MAX_RECONNECT_ATTEMPTS; a++) {
      expect(reconnectDelayMs(a)).not.toBeNull();
    }
    expect(reconnectDelayMs(MAX_RECONNECT_ATTEMPTS + 1)).toBeNull();
  });
});
