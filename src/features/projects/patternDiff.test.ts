import { defaultTicks, diffProjectWithPattern, toRpcChanges, type DiffPart, type DiffPatternPart } from './patternDiff';

const part = (id: string, name: string, position: number, pp: string | null, over: Partial<DiffPart> = {}): DiffPart =>
  ({ id, name, position, total_rows: null, pattern_part_id: pp, from_pattern: pp !== null, hasWork: false, ...over });
const pp = (id: string, name: string, count: number, position: number, total_rows: number | null = null): DiffPatternPart =>
  ({ id, name, count, position, total_rows });

test('no differences', () => {
  expect(diffProjectWithPattern(
    [part('a', 'Head', 0, 'H'), part('b', 'Leg 1', 1, 'L'), part('c', 'Leg 2', 2, 'L')],
    [pp('H', 'Head', 1, 0), pp('L', 'Leg', 2, 1)],
  )).toEqual([]);
});

test('a new pattern part is added at the end', () => {
  expect(diffProjectWithPattern([part('a', 'Head', 0, 'H')], [pp('H', 'Head', 1, 0), pp('T', 'Tail', 1, 1, 12)])).toEqual([
    { key: 'add:T:0', kind: 'add', patternPartId: 'T', name: 'Tail', totalRows: 12, afterPartId: null },
  ]);
});

test('a higher count adds the missing numbered parts after the last one', () => {
  expect(diffProjectWithPattern(
    [part('b', 'Leg 1', 0, 'L'), part('c', 'Leg 2', 1, 'L')],
    [pp('L', 'Leg', 3, 0)],
  )).toEqual([{ key: 'add:L:2', kind: 'add', patternPartId: 'L', name: 'Leg 3', totalRows: null, afterPartId: 'c' }]);
});

test('going from 1 to 2 renames the part and adds the second', () => {
  expect(diffProjectWithPattern([part('b', 'Leg', 0, 'L')], [pp('L', 'Leg', 2, 0)])).toEqual([
    { key: 'rename:b', kind: 'rename', partId: 'b', from: 'Leg', to: 'Leg 1', defaultOn: true },
    { key: 'add:L:1', kind: 'add', patternPartId: 'L', name: 'Leg 2', totalRows: null, afterPartId: 'b' },
  ]);
});

test('a renamed pattern part renames its project parts; parts with work are not ticked by default', () => {
  const changes = diffProjectWithPattern(
    [part('b', 'Leg 1', 0, 'L', { hasWork: true }), part('c', 'Leg 2', 1, 'L')],
    [pp('L', 'Back leg', 2, 0)],
  );
  expect(changes).toEqual([
    { key: 'rename:b', kind: 'rename', partId: 'b', from: 'Leg 1', to: 'Back leg 1', defaultOn: false },
    { key: 'rename:c', kind: 'rename', partId: 'c', from: 'Leg 2', to: 'Back leg 2', defaultOn: true },
  ]);
  expect([...defaultTicks(changes)]).toEqual(['rename:c']);
});

test('changed rows are listed', () => {
  expect(diffProjectWithPattern([part('a', 'Head', 0, 'H', { total_rows: 24 })], [pp('H', 'Head', 1, 0, 28)])).toEqual([
    { key: 'rows:a', kind: 'rows', partId: 'a', name: 'Head', from: 24, to: 28 },
  ]);
});

test('a lower count, a deleted pattern part and hand-added parts', () => {
  const changes = diffProjectWithPattern(
    [
      part('b', 'Leg 1', 0, 'L'), part('c', 'Leg 2', 1, 'L'),
      part('h', 'Hat', 2, null, { from_pattern: true }),
      part('x', 'Scarf', 3, null, { from_pattern: false }),
    ],
    [pp('L', 'Leg', 1, 0)],
  );
  expect(changes).toEqual([
    { key: 'rename:b', kind: 'rename', partId: 'b', from: 'Leg 1', to: 'Leg', defaultOn: true },
    { key: 'removed:c', kind: 'removed', partId: 'c', name: 'Leg 2' },
    { key: 'removed:h', kind: 'removed', partId: 'h', name: 'Hat' },
  ]);
  expect(defaultTicks(changes)).toEqual(new Set(['rename:b']));
});

test('toRpcChanges sends the ticked changes in the database shape', () => {
  const changes = diffProjectWithPattern(
    [part('b', 'Leg', 0, 'L', { total_rows: 10 }), part('h', 'Hat', 1, null, { from_pattern: true })],
    [pp('L', 'Leg', 2, 0, 12)],
  );
  expect(toRpcChanges(changes, new Set(['rename:b', 'rows:b', 'add:L:1', 'removed:h']))).toEqual([
    { kind: 'rename', part_id: 'b', name: 'Leg 1' },
    { kind: 'rows', part_id: 'b', total_rows: 12 },
    { kind: 'add', pattern_part_id: 'L', name: 'Leg 2', total_rows: 12, after_part_id: 'b' },
    { kind: 'delete', part_id: 'h' },
  ]);
  expect(toRpcChanges(changes, new Set())).toEqual([]);
});
