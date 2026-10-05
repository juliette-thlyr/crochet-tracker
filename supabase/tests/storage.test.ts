import { createTestUser, deleteTestUser, type TestUser } from './helpers';

let a: TestUser;
let b: TestUser;
beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
});
afterAll(async () => {
  await a.client.storage.from('yarn-photos').remove([`${a.id}/ball.jpg`]);
  await deleteTestUser(a);
  await deleteTestUser(b);
});

const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });

test('a user can upload and read in their own folder', async () => {
  const up = await a.client.storage.from('yarn-photos').upload(`${a.id}/ball.jpg`, jpeg, { contentType: 'image/jpeg' });
  expect(up.error).toBeNull();
  const signed = await a.client.storage.from('yarn-photos').createSignedUrl(`${a.id}/ball.jpg`, 60);
  expect(signed.error).toBeNull();
});

test('a user cannot upload into someone else folder', async () => {
  const up = await b.client.storage.from('yarn-photos').upload(`${a.id}/intruder.jpg`, jpeg, { contentType: 'image/jpeg' });
  expect(up.error).not.toBeNull();
});

test('a user cannot read someone else file', async () => {
  const signed = await b.client.storage.from('yarn-photos').createSignedUrl(`${a.id}/ball.jpg`, 60);
  expect(signed.error).not.toBeNull();
});

test('pattern-pdfs only accepts PDFs', async () => {
  const up = await a.client.storage.from('pattern-pdfs').upload(`${a.id}/x.jpg`, jpeg, { contentType: 'image/jpeg' });
  expect(up.error).not.toBeNull();
});
