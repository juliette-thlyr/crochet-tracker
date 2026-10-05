import {
  clampRow, expandPatternParts, formatClock, formatDuration, formatEuros, formatHook, formatSkeins, hookLabel,
  hookSizeOptions, rowLabel, rowProgress, sessionSeconds, stockBadge, sumSeconds,
} from './calc';

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

test('expandPatternParts names repeated parts', () => {
  expect(
    expandPatternParts([
      { name: 'Head', count: 1, total_rows: 24 },
      { name: 'Leg', count: 2, total_rows: 18 },
      { name: 'Spikes', count: 1, total_rows: null },
    ]),
  ).toEqual([
    { name: 'Head', total_rows: 24 },
    { name: 'Leg 1', total_rows: 18 },
    { name: 'Leg 2', total_rows: 18 },
    { name: 'Spikes', total_rows: null },
  ]);
});

test('clampRow', () => {
  expect(clampRow(-1)).toBe(0);
  expect(clampRow(3.7)).toBe(3);
  expect(clampRow(20)).toBe(20);
});

test('rowLabel', () => {
  expect(rowLabel(null, 18)).toBe('—');
  expect(rowLabel(12, null)).toBe('Row 12');
  expect(rowLabel(12, 18)).toBe('Row 12/18');
  expect(rowLabel(20, 18)).toBe('Row 20/18');
});

test('rowProgress', () => {
  expect(rowProgress(9, 18)).toBe(50);
  expect(rowProgress(20, 18)).toBe(100);
  expect(rowProgress(null, 18)).toBe(0);
  expect(rowProgress(5, null)).toBe(0);
});

test('stockBadge', () => {
  expect(stockBadge(2)).toBeNull();
  expect(stockBadge(1)).toBeNull();
  expect(stockBadge(0.6)).toBe('low');
  expect(stockBadge(0)).toBe('out');
  expect(stockBadge(-0.5)).toBe('out');
});

test('hookSizeOptions has 23 values from 1.0 to 12.0', () => {
  const opts = hookSizeOptions();
  expect(opts).toHaveLength(23);
  expect(opts[0]).toBe(1);
  expect(opts[1]).toBe(1.5);
  expect(opts[22]).toBe(12);
});

test('formatHook and hookLabel', () => {
  expect(formatHook(3.5)).toBe('3.5 mm');
  expect(formatHook(4)).toBe('4.0 mm');
  expect(formatHook(null)).toBe('—');
  expect(hookLabel(4, 3.5)).toBe('hook 4.0 mm (pattern: 3.5 mm)');
  expect(hookLabel(3.5, 3.5)).toBe('hook 3.5 mm');
  expect(hookLabel(3.5, null)).toBe('hook 3.5 mm');
  expect(hookLabel(null, 3.5)).toBe('hook —');
});

test('formatSkeins and formatEuros', () => {
  expect(formatSkeins(0.25)).toBe('0.25 sk');
  expect(formatSkeins(2)).toBe('2 sk');
  expect(formatEuros(4.5).replace(/\s/g, ' ')).toBe('4,50 €');
  expect(formatEuros(null)).toBe('—');
});
