import { filterYarns, mergeYarnUsage, type YarnWithStock } from './logic';

const yarn = (over: Partial<YarnWithStock>): YarnWithStock => ({
  id: 'y', user_id: 'u', brand: null, name: 'Y', color: null, color_families: [], yarn_weight: null, fiber: null,
  skeins_owned: 1, photo_path: null, bought_at: null, price_per_skein: null, bought_on: null, notes: null,
  created_at: '', updated_at: '', owned: 1, used: 0, reserved: 0, free: 1, ...over,
});

const yarns = [
  yarn({ id: 'a', name: 'Honey Bunny', brand: 'Hobbii', color: 'Teal', color_families: ['blue', 'green'], yarn_weight: 'dk', fiber: 'Cotton', free: 3 }),
  yarn({ id: 'b', name: 'Toucan', brand: 'Hobbii', color: 'Sage', color_families: ['green'], yarn_weight: 'worsted', fiber: 'Merino', free: 0.6 }),
  yarn({ id: 'c', name: 'Paris', brand: 'Drops', color: 'Mint green', yarn_weight: 'dk', fiber: 'Merino', free: 0 }),
];
const none = { weight: 'all', fiber: 'all', lowOnly: false, search: '', family: 'all' } as const;

test('filterYarns by weight, fiber and low stock', () => {
  const ids = (f: Partial<Parameters<typeof filterYarns>[1]>) => filterYarns(yarns, { ...none, ...f }).map((y) => y.id);
  expect(ids({})).toEqual(['a', 'b', 'c']);
  expect(ids({ weight: 'dk' })).toEqual(['a', 'c']);
  expect(ids({ fiber: 'Merino' })).toEqual(['b', 'c']);
  expect(ids({ lowOnly: true })).toEqual(['b', 'c']);
});

test('filterYarns searches name, brand and colour, ignoring case, and filters by colour family', () => {
  const ids = (f: Partial<Parameters<typeof filterYarns>[1]>) => filterYarns(yarns, { ...none, ...f }).map((y) => y.id);
  expect(ids({ search: 'bunny' })).toEqual(['a']);
  expect(ids({ search: 'HOBBII' })).toEqual(['a', 'b']);
  expect(ids({ search: ' green ' })).toEqual(['c']);
  expect(ids({ family: 'green' })).toEqual(['a', 'b']);
  expect(ids({ family: 'blue' })).toEqual(['a']);
  expect(ids({ family: 'green', search: 'paris' })).toEqual([]);
});

test('mergeYarnUsage combines planned and used per project', () => {
  const rows = mergeYarnUsage(
    [{ skeins_planned: 2, project: { id: 'p1', name: 'T-rex', status: 'in_progress' } }],
    [
      { skeins_used: 0.6, part: { project: { id: 'p1', name: 'T-rex', status: 'in_progress' } } },
      { skeins_used: 0.5, part: { project: { id: 'p1', name: 'T-rex', status: 'in_progress' } } },
      { skeins_used: 0.3, part: { project: { id: 'p2', name: 'Coasters', status: 'finished' } } },
    ],
  );
  expect(rows).toEqual([
    { projectId: 'p1', name: 'T-rex', status: 'in_progress', planned: 2, used: 1.1 },
    { projectId: 'p2', name: 'Coasters', status: 'finished', planned: 0, used: 0.3 },
  ]);
});
