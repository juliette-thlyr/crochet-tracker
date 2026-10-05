import { formatClock, formatDuration, sessionSeconds, sumSeconds } from './calc';

const now = new Date('2026-09-24T20:30:00Z');

describe('sessionSeconds', () => {
  test('closed session', () => {
    expect(sessionSeconds({ started_at: '2026-09-24T20:00:00Z', ended_at: '2026-09-24T20:25:30Z' }, now)).toBe(1530);
  });
  test('running session counts up to now', () => {
    expect(sessionSeconds({ started_at: '2026-09-24T20:10:00Z', ended_at: null }, now)).toBe(1200);
  });
  test('never negative', () => {
    expect(sessionSeconds({ started_at: '2026-09-24T21:00:00Z', ended_at: null }, now)).toBe(0);
  });
});

test('sumSeconds adds closed and running sessions', () => {
  expect(
    sumSeconds(
      [
        { started_at: '2026-09-24T19:00:00Z', ended_at: '2026-09-24T19:25:00Z' },
        { started_at: '2026-09-24T20:10:00Z', ended_at: null },
      ],
      now,
    ),
  ).toBe(1500 + 1200);
  expect(sumSeconds([], now)).toBe(0);
});

test.each([
  [0, '0m'],
  [59, '0m'],
  [42 * 60, '42m'],
  [65 * 60, '1h 05m'],
  [11 * 3600 + 20 * 60 + 59, '11h 20m'],
])('formatDuration(%i) = %s', (s, out) => {
  expect(formatDuration(s)).toBe(out);
});

test.each([
  [0, '0:00:00'],
  [42 * 60 + 10, '0:42:10'],
  [12 * 3600 + 3 * 60 + 9, '12:03:09'],
])('formatClock(%i) = %s', (s, out) => {
  expect(formatClock(s)).toBe(out);
});
