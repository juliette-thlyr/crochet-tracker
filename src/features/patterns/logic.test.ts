import { buildTypeChips, cleanPartDrafts, nextTypePosition } from './logic';

const types = [
  { id: 't1', name: 'Amigurumi' },
  { id: 't2', name: 'Clothes' },
  { id: 't3', name: 'Baby' },
];

test('buildTypeChips counts patterns and hides empty types', () => {
  expect(buildTypeChips(types, ['t1', 't1', 't2', null])).toEqual([
    { id: 'all', label: 'All · 4' },
    { id: 't1', label: 'Amigurumi · 2' },
    { id: 't2', label: 'Clothes · 1' },
  ]);
});

test('cleanPartDrafts drops blank rows, trims names, numbers positions', () => {
  expect(
    cleanPartDrafts([
      { name: ' Head ', count: 1, total_rows: 24 },
      { name: '', count: 1, total_rows: null },
      { name: 'Leg', count: 0, total_rows: null },
    ]),
  ).toEqual([
    { name: 'Head', count: 1, total_rows: 24, position: 0 },
    { name: 'Leg', count: 1, total_rows: null, position: 1 },
  ]);
});

test('nextTypePosition goes after the highest position', () => {
  expect(nextTypePosition([])).toBe(0);
  expect(nextTypePosition([{ position: 0 }, { position: 5 }, { position: 2 }])).toBe(6);
});

import { planPartChanges } from './logic';

test('planPartChanges updates kept parts, inserts new ones and deletes removed ones', () => {
  const plan = planPartChanges(['a', 'b', 'c'], [
    { id: 'a', name: ' Head ', count: 1, total_rows: 24 },
    { name: 'Tail', count: 1, total_rows: null },
    { id: 'c', name: 'Leg', count: 2, total_rows: 18 },
    { name: '', count: 1, total_rows: null },
  ]);
  expect(plan.updates).toEqual([
    { id: 'a', name: 'Head', count: 1, total_rows: 24, position: 0 },
    { id: 'c', name: 'Leg', count: 2, total_rows: 18, position: 2 },
  ]);
  expect(plan.inserts).toEqual([{ name: 'Tail', count: 1, total_rows: null, position: 1 }]);
  expect(plan.deleteIds).toEqual(['b']);
});

test('a kept id that no longer exists in the database is inserted instead', () => {
  const plan = planPartChanges([], [{ id: 'gone', name: 'Head', count: 1, total_rows: null }]);
  expect(plan.updates).toEqual([]);
  expect(plan.inserts).toEqual([{ name: 'Head', count: 1, total_rows: null, position: 0 }]);
});
