import { filterYarns, mergeYarnUsage, type YarnWithStock } from './logic';

const yarn = (over: Partial<YarnWithStock>): YarnWithStock => ({
  id: 'y', user_id: 'u', brand: null, name: 'Y', color: null, yarn_weight: null, fiber: null,
  skeins_owned: 1, photo_path: null, bought_at: null, price_per_skein: null, bought_on: null, notes: null,
  created_at: '', updated_at: '', owned: 1, used: 0, reserved: 0, free: 1, ...over,
});

const yarns = [
  yarn({ id: 'a', yarn_weight: 'dk', fiber: 'Cotton', free: 3 }),
  yarn({ id: 'b', yarn_weight: 'worsted', fiber: 'Merino', free: 0.6 }),
  yarn({ id: 'c', yarn_weight: 'dk', fiber: 'Merino', free: 0 }),
];

test('filterYarns by weight, fiber and low stock', () => {
  const ids = (f: Parameters<typeof filterYarns>[1]) => filterYarns(yarns, f).map((y) => y.id);
  expect(ids({ weight: 'all', fiber: 'all', lowOnly: false })).toEqual(['a', 'b', 'c']);
  expect(ids({ weight: 'dk', fiber: 'all', lowOnly: false })).toEqual(['a', 'c']);
  expect(ids({ weight: 'all', fiber: 'Merino', lowOnly: false })).toEqual(['b', 'c']);
  expect(ids({ weight: 'all', fiber: 'all', lowOnly: true })).toEqual(['b', 'c']);
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
