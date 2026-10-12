import { cleanMaterials, cleanYarnLines, planRows, skeinsText } from './logic';

test('cleanYarnLines trims, drops lines without a colour and numbers positions', () => {
  expect(cleanYarnLines([
    { id: 'y1', color: ' Pink ', color_family: 'pink', skeins: 2, yarn_type: ' Hobbii Honey Bunny ' },
    { color: '   ', color_family: null, skeins: 1, yarn_type: '' },
    { color: 'White', color_family: null, skeins: null, yarn_type: '  ' },
  ])).toEqual([
    { id: 'y1', color: 'Pink', color_family: 'pink', skeins: 2, yarn_type: 'Hobbii Honey Bunny', position: 0 },
    { color: 'White', color_family: null, skeins: null, yarn_type: null, position: 1 },
  ]);
});

test('cleanMaterials trims, drops blank names and empties a zero quantity', () => {
  expect(cleanMaterials([
    { name: ' Safety eyes 10 mm ', quantity: 2 },
    { name: '', quantity: 4 },
    { id: 'm1', name: 'Stuffing', quantity: 0 },
  ])).toEqual([
    { name: 'Safety eyes 10 mm', quantity: 2, position: 0 },
    { id: 'm1', name: 'Stuffing', quantity: null, position: 1 },
  ]);
});

test('planRows keeps known ids, inserts the rest and deletes the missing', () => {
  const plan = planRows(['a', 'b'], [{ id: 'a', name: 'x' }, { name: 'y' }, { id: 'zz', name: 'z' }]);
  expect(plan).toEqual({
    updates: [{ id: 'a', name: 'x' }],
    inserts: [{ name: 'y' }, { name: 'z' }],
    deleteIds: ['b'],
  });
});

test('skeinsText', () => {
  expect(skeinsText(1)).toBe('1 skein');
  expect(skeinsText(2)).toBe('2 skeins');
  expect(skeinsText(0.5)).toBe('0.5 skein');
});
