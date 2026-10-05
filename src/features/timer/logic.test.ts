import { recentParts, type RecentRow } from './logic';

const part = (id: string, name: string) => ({
  id, name, done: false, current_row: null, total_rows: null, resume_note: null, project: { name: 'P' },
});

test('recentParts keeps the latest session per part, skips the running part, and limits', () => {
  const rows: RecentRow[] = [
    { started_at: '2026-09-24T20:00:00Z', part: part('a', 'Leg 1') },
    { started_at: '2026-09-24T19:00:00Z', part: part('b', 'Main') },
    { started_at: '2026-09-23T19:00:00Z', part: part('a', 'Leg 1') },
    { started_at: '2026-09-22T19:00:00Z', part: null },
    { started_at: '2026-09-21T19:00:00Z', part: part('c', 'Arm 2') },
  ];
  expect(recentParts(rows, 'b').map((p) => [p.id, p.lastWorked])).toEqual([
    ['a', '2026-09-24T20:00:00Z'],
    ['c', '2026-09-21T19:00:00Z'],
  ]);
  expect(recentParts(rows, null, 1).map((p) => p.id)).toEqual(['a']);
});
