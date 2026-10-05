import { createTestUser, deleteTestUser, type TestUser } from './helpers';

let u: TestUser;
let other: TestUser;
beforeAll(async () => {
  u = await createTestUser();
  other = await createTestUser();
});
afterAll(async () => {
  await deleteTestUser(u);
  await deleteTestUser(other);
});

async function tRexPattern(client = u.client) {
  const { data: pattern } = await client
    .from('patterns').insert({ name: 'T-rex', hook_size_mm: 3.5 }).select().single();
  await client.from('pattern_parts').insert([
    { pattern_id: pattern!.id, name: 'Head', position: 0, count: 1, total_rows: 24 },
    { pattern_id: pattern!.id, name: 'Leg', position: 1, count: 2, total_rows: 18 },
    { pattern_id: pattern!.id, name: 'Spikes', position: 2, count: 1 },
  ]);
  return pattern!;
}

describe('start_project_from_pattern', () => {
  test('creates the project and copies expanded parts in order', async () => {
    const pattern = await tRexPattern();
    const { data: projectId, error } = await u.client.rpc('start_project_from_pattern', { p_pattern_id: pattern.id });
    expect(error).toBeNull();

    const { data: project } = await u.client.from('projects').select().eq('id', projectId).single();
    expect(project).toMatchObject({
      name: 'T-rex', pattern_id: pattern.id, status: 'in_progress', start_date: new Date().toISOString().slice(0, 10),
    });
    expect(Number(project!.hook_size_mm)).toBe(3.5);

    const { data: parts } = await u.client
      .from('parts').select('name, position, total_rows, current_row, done').eq('project_id', projectId).order('position');
    expect(parts).toEqual([
      { name: 'Head', position: 0, total_rows: 24, current_row: null, done: false },
      { name: 'Leg 1', position: 1, total_rows: 18, current_row: null, done: false },
      { name: 'Leg 2', position: 2, total_rows: 18, current_row: null, done: false },
      { name: 'Spikes', position: 3, total_rows: null, current_row: null, done: false },
    ]);
  });

  test('changing the project hook leaves the pattern recommendation alone', async () => {
    const pattern = await tRexPattern();
    const { data: projectId } = await u.client.rpc('start_project_from_pattern', { p_pattern_id: pattern.id });
    await u.client.from('projects').update({ hook_size_mm: 4 }).eq('id', projectId);
    const { data } = await u.client.from('patterns').select('hook_size_mm').eq('id', pattern.id).single();
    expect(Number(data!.hook_size_mm)).toBe(3.5);
  });

  test('fails for a pattern the user cannot see, creating nothing', async () => {
    const foreign = await tRexPattern(other.client);
    const before = await u.client.from('projects').select('id', { count: 'exact', head: true });
    const { error } = await u.client.rpc('start_project_from_pattern', { p_pattern_id: foreign.id });
    expect(error).not.toBeNull();
    const after = await u.client.from('projects').select('id', { count: 'exact', head: true });
    expect(after.count).toBe(before.count);
  });
});

test('a blank project gets a "Main" part', async () => {
  const { data: project } = await u.client.from('projects').insert({ name: 'Blank' }).select().single();
  const { data: parts } = await u.client.from('parts').select('name').eq('project_id', project!.id);
  expect(parts).toEqual([{ name: 'Main' }]);
});

test('finishing a project sets finish_date once', async () => {
  const { data: project } = await u.client.from('projects').insert({ name: 'Done soon' }).select().single();
  await u.client.from('projects').update({ status: 'finished' }).eq('id', project!.id);
  const { data } = await u.client.from('projects').select('finish_date').eq('id', project!.id).single();
  expect(data!.finish_date).toBe(new Date().toISOString().slice(0, 10));

  await u.client.from('projects').update({ finish_date: '2026-01-01' }).eq('id', project!.id);
  await u.client.from('projects').update({ status: 'finished', notes: 'x' }).eq('id', project!.id);
  const { data: again } = await u.client.from('projects').select('finish_date').eq('id', project!.id).single();
  expect(again!.finish_date).toBe('2026-01-01');
});

describe('timer', () => {
  test('start_timer stops the running session before starting a new one', async () => {
    const { data: project } = await u.client.from('projects').insert({ name: 'Timed' }).select().single();
    const { data: parts } = await u.client.from('parts').select('id').eq('project_id', project!.id);
    const { data: second } = await u.client
      .from('parts').insert({ project_id: project!.id, name: 'Second', position: 1 }).select().single();

    const first = await u.client.rpc('start_timer', { p_part_id: parts![0].id });
    expect(first.error).toBeNull();
    await new Promise((r) => setTimeout(r, 1100));
    const next = await u.client.rpc('start_timer', { p_part_id: second!.id });
    expect(next.error).toBeNull();

    const { data: running } = await u.client.from('time_sessions').select('part_id').is('ended_at', null);
    expect(running).toEqual([{ part_id: second!.id }]);

    await new Promise((r) => setTimeout(r, 1100));
    const stop = await u.client.rpc('stop_timer');
    expect(stop.error).toBeNull();
    const { data: none } = await u.client.from('time_sessions').select('id').is('ended_at', null);
    expect(none).toEqual([]);
  });
});
