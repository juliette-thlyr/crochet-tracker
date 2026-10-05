import { createTestUser, deleteTestUser, type TestUser } from './helpers';

let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
});
afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

async function newPart(u: TestUser) {
  const { data: project } = await u.client.from('projects').insert({ name: 'P' }).select().single();
  const { data: part, error } = await u.client
    .from('parts').insert({ project_id: project!.id, name: 'Body', position: 0 }).select().single();
  if (error) throw error;
  return { project: project!, part: part! };
}

test('a new user gets the six default pattern types in order', async () => {
  const { data } = await a.client.from('pattern_types').select('name').order('position');
  expect(data!.map((t) => t.name)).toEqual(['Amigurumi', 'Clothes', 'Accessories', 'Bag', 'Home', 'Baby']);
});

test('row-level security hides other users rows', async () => {
  await a.client.from('yarns').insert({ name: 'Fern green', skeins_owned: 3 });
  const { data } = await b.client.from('yarns').select();
  expect(data).toEqual([]);
});

test('a user cannot write rows for someone else', async () => {
  const { error } = await b.client.from('yarns').insert({ name: 'Stolen', skeins_owned: 1, user_id: a.id });
  expect(error).not.toBeNull();
});

test.each([
  [3.5, true],
  [1, true],
  [12, true],
  [3.3, false],
  [0.5, false],
  [12.5, false],
])('hook size %d accepted: %s', async (mm, ok) => {
  const { error } = await a.client.from('patterns').insert({ name: 'H', hook_size_mm: mm });
  expect(error === null).toBe(ok);
});

test('negative skeins are rejected', async () => {
  const { error } = await a.client.from('yarns').insert({ name: 'Neg', skeins_owned: -1 });
  expect(error).not.toBeNull();
});

test('only one running timer per user', async () => {
  const { part } = await newPart(a);
  const first = await a.client.from('time_sessions').insert({ part_id: part.id });
  expect(first.error).toBeNull();
  const second = await a.client.from('time_sessions').insert({ part_id: part.id });
  expect(second.error).not.toBeNull();
  await a.client.from('time_sessions').update({ ended_at: new Date(Date.now() + 1000).toISOString() }).eq('part_id', part.id);
});

test('a session cannot end before it starts', async () => {
  const { part } = await newPart(a);
  const { error } = await a.client.from('time_sessions').insert({
    part_id: part.id,
    started_at: '2026-09-24T20:00:00Z',
    ended_at: '2026-09-24T19:00:00Z',
  });
  expect(error).not.toBeNull();
});

test('current_row cannot be negative', async () => {
  const { part } = await newPart(a);
  const { error } = await a.client.from('parts').update({ current_row: -1 }).eq('id', part.id);
  expect(error).not.toBeNull();
});

test('a yarn used by a part cannot be deleted', async () => {
  const { part } = await newPart(a);
  const { data: yarn } = await a.client.from('yarns').insert({ name: 'Used', skeins_owned: 2 }).select().single();
  await a.client.from('part_yarns').insert({ part_id: part.id, yarn_id: yarn!.id, skeins_used: 0.5 });
  const { error } = await a.client.from('yarns').delete().eq('id', yarn!.id);
  expect(error).not.toBeNull();
});

test('deleting a pattern keeps its projects', async () => {
  const { data: pattern } = await a.client.from('patterns').insert({ name: 'Gone' }).select().single();
  const { data: project } = await a.client
    .from('projects').insert({ name: 'Kept', pattern_id: pattern!.id }).select().single();
  await a.client.from('patterns').delete().eq('id', pattern!.id);
  const { data } = await a.client.from('projects').select('pattern_id').eq('id', project!.id).single();
  expect(data!.pattern_id).toBeNull();
});

test('deleting a pattern type leaves its patterns untyped', async () => {
  const { data: type } = await a.client.from('pattern_types').insert({ name: 'Temp', position: 9 }).select().single();
  const { data: pattern } = await a.client
    .from('patterns').insert({ name: 'Typed', pattern_type_id: type!.id }).select().single();
  await a.client.from('pattern_types').delete().eq('id', type!.id);
  const { data } = await a.client.from('patterns').select('pattern_type_id').eq('id', pattern!.id).single();
  expect(data!.pattern_type_id).toBeNull();
});
