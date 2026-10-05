import { groupProjects, projectYarnLines } from './logic';

test('groupProjects orders groups and omits empty ones', () => {
  const groups = groupProjects([
    { id: 'a', status: 'finished' as const },
    { id: 'b', status: 'in_progress' as const },
    { id: 'c', status: 'in_progress' as const },
  ]);
  expect(groups.map((g) => [g.status, g.items.map((i) => i.id)])).toEqual([
    ['in_progress', ['b', 'c']],
    ['finished', ['a']],
  ]);
});

test('projectYarnLines adds usage across parts and joins plans', () => {
  const fern = { id: 'y1', name: 'Fern green' };
  const cream = { id: 'y2', name: 'Cream' };
  const lines = projectYarnLines(
    [
      { part_yarns: [{ id: 'u1', skeins_used: 0.6, yarn: fern }] },
      { part_yarns: [{ id: 'u2', skeins_used: 0.5, yarn: fern }, { id: 'u3', skeins_used: 0.2, yarn: cream }] },
    ],
    [{ id: 'pl1', skeins_planned: 2, yarn: fern }],
  );
  expect(lines).toEqual([
    { yarnId: 'y1', name: 'Fern green', used: 1.1, planned: 2 },
    { yarnId: 'y2', name: 'Cream', used: 0.2, planned: null },
  ]);
});
