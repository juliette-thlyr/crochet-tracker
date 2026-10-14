import { createTestUser, deleteTestUser, type TestUser } from './helpers';

let u: TestUser;
beforeAll(async () => { u = await createTestUser(); });
afterAll(async () => { await deleteTestUser(u); });

test('a yarn has up to two colour families', async () => {
  const none = await u.client.from('yarns').insert({ name: 'Plain', skeins_owned: 1 }).select('color_families').single();
  expect(none.error).toBeNull();
  expect(none.data!.color_families).toEqual([]);

  const teal = await u.client.from('yarns')
    .insert({ name: 'Teal', skeins_owned: 1, color_families: ['blue', 'green'] }).select('color_families').single();
  expect(teal.error).toBeNull();
  expect(teal.data!.color_families).toEqual(['blue', 'green']);

  const three = await u.client.from('yarns')
    .insert({ name: 'Rainbow', skeins_owned: 1, color_families: ['red', 'yellow', 'blue'] });
  expect(three.error).not.toBeNull();
});
