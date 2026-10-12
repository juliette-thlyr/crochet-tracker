import { importSummary, parseNameList, parseYarnList } from './parse';

test("parses the user's yarn lines", () => {
  const text = [
    'Hobbii ; Honey Bunny ; Super Bulky ; Polyester',
    'Hobbii ; Baby Snuggle ; Super Bulky ; Polyester',
    'Hobbii ; Toucan ; Super Bulky ; Polyester',
  ].join('\n');
  expect(parseYarnList(text)).toEqual({
    entries: [
      { brand: 'Hobbii', name: 'Honey Bunny', yarn_weight: 'super_bulky', fiber: 'Polyester' },
      { brand: 'Hobbii', name: 'Baby Snuggle', yarn_weight: 'super_bulky', fiber: 'Polyester' },
      { brand: 'Hobbii', name: 'Toucan', yarn_weight: 'super_bulky', fiber: 'Polyester' },
    ],
    rejected: [],
  });
});

test('weight and fiber are optional; blank lines are skipped; duplicates kept once', () => {
  const text = 'Drops ; Paris ; dk ;\n\nScheepjes ; Catona\n  drops;paris;DK;Coton  \n';
  expect(parseYarnList(text)).toEqual({
    entries: [
      { brand: 'Drops', name: 'Paris', yarn_weight: 'dk', fiber: null },
      { brand: 'Scheepjes', name: 'Catona', yarn_weight: null, fiber: null },
    ],
    rejected: [],
  });
});

test('lines without brand and name, or with an unknown weight, are rejected by number', () => {
  const text = 'Hobbii\nHobbii ; Toucan ; Chunky ; Polyester\n ; Paris\nDrops ; Safran ; Sport ; Coton';
  expect(parseYarnList(text)).toEqual({
    entries: [{ brand: 'Drops', name: 'Safran', yarn_weight: 'sport', fiber: 'Coton' }],
    rejected: [1, 2, 3],
  });
});

test('parseNameList trims, skips blanks and keeps the first spelling of duplicates', () => {
  expect(parseNameList('Coton\n polyester \n\nPolyester\nLaine de mérinos')).toEqual(['Coton', 'polyester', 'Laine de mérinos']);
});

test('importSummary', () => {
  expect(importSummary({ added: 3, skipped: 1 }, [])).toBe('3 added, 1 already there');
  expect(importSummary({ added: 0, skipped: 0 }, [4])).toBe('0 added, 0 already there, 1 line not understood (line 4)');
  expect(importSummary({ added: 1, skipped: 0 }, [2, 5])).toBe('1 added, 0 already there, 2 lines not understood (lines 2, 5)');
});
