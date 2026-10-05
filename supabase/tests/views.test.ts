import { createTestUser, deleteTestUser, type TestUser } from './helpers';

let u: TestUser;
beforeAll(async () => { u = await createTestUser(); });
afterAll(async () => { await deleteTestUser(u); });

// Returns the project with exactly one part. From Task 6 on, blank projects get a "Main"
// part automatically, so reuse it when present instead of adding a second one.
async function project(name: string, status: string, pattern_id: string | null = null) {
  const { data, error } = await u.client.from('projects').insert({ name, status, pattern_id }).select().single();
  if (error) throw error;
  const { data: existing } = await u.client.from('parts').select().eq('project_id', data.id);
  if (existing && existing.length > 0) return { project: data, part: existing[0] };
  const { data: part } = await u.client
    .from('parts').insert({ project_id: data.id, name: 'Body', position: 0 }).select().single();
  return { project: data, part: part! };
}

describe('yarn_stock', () => {
  test('used, reserved and free follow the spec rules', async () => {
    const { data: yarn } = await u.client.from('yarns').insert({ name: 'Fern', skeins_owned: 3 }).select().single();
    const active = await project('Active', 'in_progress');
    const frogged = await project('Frogged', 'frogged');
    const finished = await project('Finished', 'finished');

    await u.client.from('part_yarns').insert([
      { part_id: active.part.id, yarn_id: yarn!.id, skeins_used: 1.1 },
      { part_id: frogged.part.id, yarn_id: yarn!.id, skeins_used: 0.5 },
      { part_id: finished.part.id, yarn_id: yarn!.id, skeins_used: 0.3 },
    ]);
    await u.client.from('project_yarns').insert([
      { project_id: active.project.id, yarn_id: yarn!.id, skeins_planned: 2 },
      { project_id: finished.project.id, yarn_id: yarn!.id, skeins_planned: 1 },
    ]);

    const { data: s } = await u.client.from('yarn_stock').select().eq('yarn_id', yarn!.id).single();
    expect(Number(s!.owned)).toBe(3);
    expect(Number(s!.used)).toBeCloseTo(1.4);
    expect(Number(s!.reserved)).toBeCloseTo(0.9);
    expect(Number(s!.free)).toBeCloseTo(0.7);

    await u.client.from('projects').update({ status: 'frogged' }).eq('id', active.project.id);
    const { data: after } = await u.client.from('yarn_stock').select().eq('yarn_id', yarn!.id).single();
    expect(Number(after!.used)).toBeCloseTo(0.3);
    expect(Number(after!.reserved)).toBe(0);
    expect(Number(after!.free)).toBeCloseTo(2.7);
  });

  test('a yarn nobody uses is entirely free', async () => {
    const { data: yarn } = await u.client.from('yarns').insert({ name: 'Idle', skeins_owned: 2 }).select().single();
    const { data: s } = await u.client.from('yarn_stock').select().eq('yarn_id', yarn!.id).single();
    expect(Number(s!.used)).toBe(0);
    expect(Number(s!.reserved)).toBe(0);
    expect(Number(s!.free)).toBe(2);
  });
});

test('project_summary counts parts, time and skeins', async () => {
  const { project: p, part } = await project('Summary', 'in_progress');
  await u.client.from('parts').insert({ project_id: p.id, name: 'Head', position: 1, done: true });
  await u.client.from('time_sessions').insert({
    part_id: part.id, started_at: '2026-09-24T20:00:00Z', ended_at: '2026-09-24T20:25:00Z',
  });
  const { data: yarn } = await u.client.from('yarns').insert({ name: 'Y', skeins_owned: 5 }).select().single();
  await u.client.from('part_yarns').insert({ part_id: part.id, yarn_id: yarn!.id, skeins_used: 0.75 });

  const { data: s } = await u.client.from('project_summary').select().eq('project_id', p.id).single();
  expect(s!.parts_total).toBe(2);
  expect(s!.parts_done).toBe(1);
  expect(Number(s!.seconds)).toBe(1500);
  expect(Number(s!.skeins)).toBeCloseTo(0.75);
});

test('pattern_stats averages finished projects only', async () => {
  const { data: pattern } = await u.client.from('patterns').insert({ name: 'Stat' }).select().single();
  const one = await project('One', 'finished', pattern!.id);
  const two = await project('Two', 'finished', pattern!.id);
  const wip = await project('Wip', 'in_progress', pattern!.id);
  await u.client.from('time_sessions').insert([
    { part_id: one.part.id, started_at: '2026-09-01T10:00:00Z', ended_at: '2026-09-01T11:00:00Z' },
    { part_id: two.part.id, started_at: '2026-09-02T10:00:00Z', ended_at: '2026-09-02T10:30:00Z' },
    { part_id: wip.part.id, started_at: '2026-09-03T10:00:00Z', ended_at: '2026-09-03T15:00:00Z' },
  ]);

  const { data: s } = await u.client.from('pattern_stats').select().eq('pattern_id', pattern!.id).single();
  expect(s!.times_made).toBe(2);
  expect(Number(s!.avg_seconds)).toBe(2700);

  const { data: fresh } = await u.client.from('patterns').insert({ name: 'Never' }).select().single();
  const { data: none } = await u.client.from('pattern_stats').select().eq('pattern_id', fresh!.id).single();
  expect(none!.times_made).toBe(0);
  expect(none!.avg_seconds).toBeNull();
});
