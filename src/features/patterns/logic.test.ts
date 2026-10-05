import { buildTypeChips, cleanPartDrafts } from './logic';

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
