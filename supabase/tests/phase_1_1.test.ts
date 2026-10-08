import { admin, createTestUser, deleteTestUser, type TestUser } from './helpers';

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

async function legPattern(client = u.client) {
  const { data: pattern, error } = await client.from('patterns').insert({ name: 'T-rex' }).select().single();
  if (error) throw error;
  const { data: parts, error: e2 } = await client.from('pattern_parts').insert([
    { pattern_id: pattern.id, name: 'Head', position: 0, count: 1 },
    { pattern_id: pattern.id, name: 'Leg', position: 1, count: 2 },
  ]).select().order('position');
  if (e2) throw e2;
  return { pattern, head: parts[0], leg: parts[1] };
}

describe('part_instructions', () => {
  test('owner can add a pdf page and a photo; constraints are enforced', async () => {
    const { leg } = await legPattern();
    const ok = await u.client.from('part_instructions').insert([
      { pattern_part_id: leg.id, position: 0, kind: 'pdf_page', pdf_page: 3, image_path: `${u.id}/a.jpg` },
      { pattern_part_id: leg.id, position: 1, kind: 'photo', image_path: `${u.id}/b.jpg` },
    ]);
    expect(ok.error).toBeNull();

    const noPage = await u.client.from('part_instructions')
      .insert({ pattern_part_id: leg.id, position: 2, kind: 'pdf_page', image_path: 'x.jpg' });
    expect(noPage.error).not.toBeNull();
    const photoWithPage = await u.client.from('part_instructions')
      .insert({ pattern_part_id: leg.id, position: 2, kind: 'photo', pdf_page: 1, image_path: 'x.jpg' });
    expect(photoWithPage.error).not.toBeNull();
    const badKind = await u.client.from('part_instructions')
      .insert({ pattern_part_id: leg.id, position: 2, kind: 'video', image_path: 'x.jpg' });
    expect(badKind.error).not.toBeNull();
  });

  test('other users cannot see them', async () => {
    const { leg } = await legPattern();
    await u.client.from('part_instructions')
      .insert({ pattern_part_id: leg.id, position: 0, kind: 'photo', image_path: `${u.id}/c.jpg` });
    const { data } = await other.client.from('part_instructions').select().eq('pattern_part_id', leg.id);
    expect(data).toEqual([]);
  });

  test('deleting a pattern part deletes its instructions', async () => {
    const { head } = await legPattern();
    await u.client.from('part_instructions')
      .insert({ pattern_part_id: head.id, position: 0, kind: 'photo', image_path: `${u.id}/d.jpg` });
    await u.client.from('pattern_parts').delete().eq('id', head.id);
    const { data } = await u.client.from('part_instructions').select().eq('pattern_part_id', head.id);
    expect(data).toEqual([]);
  });
});

test('start_project_from_pattern links each copied part to its pattern part', async () => {
  const { pattern, head, leg } = await legPattern();
  const { data: projectId, error } = await u.client.rpc('start_project_from_pattern', { p_pattern_id: pattern.id });
  expect(error).toBeNull();
  const { data: parts } = await u.client.from('parts').select('name, pattern_part_id').eq('project_id', projectId).order('position');
  expect(parts).toEqual([
    { name: 'Head', pattern_part_id: head.id },
    { name: 'Leg 1', pattern_part_id: leg.id },
    { name: 'Leg 2', pattern_part_id: leg.id },
  ]);
});

test('backfill rule: an unlinked part named "Leg 2" links to "Leg" (run through the SQL helper)', async () => {
  const { pattern, leg } = await legPattern();
  const { data: project } = await u.client.from('projects').insert({ name: 'Old', pattern_id: pattern.id }).select().single();
  const { data: part } = await u.client.from('parts')
    .insert({ project_id: project!.id, name: 'Leg 2', position: 0 }).select().single();
  // The migration's backfill is also exposed as a function so it can be re-run safely.
  const { error } = await admin.rpc('backfill_part_links');
  expect(error).toBeNull();
  const { data } = await u.client.from('parts').select('pattern_part_id').eq('id', part!.id).single();
  expect(data!.pattern_part_id).toBe(leg.id);
});

test('backfill prefers an exact name match and leaves unmatched parts unlinked', async () => {
  const { data: pattern } = await u.client.from('patterns').insert({ name: 'Ambiguous' }).select().single();
  const { data: pps } = await u.client.from('pattern_parts').insert([
    { pattern_id: pattern!.id, name: 'Leg', position: 0, count: 2 },
    { pattern_id: pattern!.id, name: 'Leg 2', position: 1, count: 1 },
  ]).select().order('position');
  const { data: project } = await u.client.from('projects').insert({ name: 'Old2', pattern_id: pattern!.id }).select().single();
  const { data: parts } = await u.client.from('parts').insert([
    { project_id: project!.id, name: 'Leg 2', position: 0 },
    { project_id: project!.id, name: 'Tail', position: 1 },
  ]).select().order('position');
  expect((await admin.rpc('backfill_part_links')).error).toBeNull();
  const { data: legRow } = await u.client.from('parts').select('pattern_part_id').eq('id', parts![0].id).single();
  expect(legRow!.pattern_part_id).toBe(pps![1].id);
  const { data: tailRow } = await u.client.from('parts').select('pattern_part_id').eq('id', parts![1].id).single();
  expect(tailRow!.pattern_part_id).toBeNull();
});

describe('patterns', () => {
  test('photo_path is stored; pdf_updated_at changes only when pdf_path changes', async () => {
    const { data: p } = await u.client.from('patterns')
      .insert({ name: 'Bag', photo_path: `${u.id}/bag.jpg`, pdf_path: `${u.id}/bag.pdf` }).select().single();
    expect(p!.photo_path).toBe(`${u.id}/bag.jpg`);
    const first = p!.pdf_updated_at;
    expect(first).not.toBeNull();

    await new Promise((r) => setTimeout(r, 50));
    const { data: renamed } = await u.client.from('patterns').update({ name: 'Bag A' }).eq('id', p!.id).select().single();
    expect(renamed!.pdf_updated_at).toBe(first);

    await new Promise((r) => setTimeout(r, 50));
    const { data: replaced } = await u.client.from('patterns')
      .update({ pdf_path: `${u.id}/bag-v2.pdf` }).eq('id', p!.id).select().single();
    expect(new Date(replaced!.pdf_updated_at!).getTime()).toBeGreaterThan(new Date(first!).getTime());
  });
});

describe('add_skeins', () => {
  test('adds to skeins_owned and rejects amounts ≤ 0', async () => {
    const { data: y } = await u.client.from('yarns').insert({ name: 'Fern', skeins_owned: 3 }).select().single();
    expect((await u.client.rpc('add_skeins', { p_yarn_id: y!.id, p_amount: 2 })).error).toBeNull();
    expect((await u.client.rpc('add_skeins', { p_yarn_id: y!.id, p_amount: 0.25 })).error).toBeNull();
    const { data } = await u.client.from('yarns').select('skeins_owned').eq('id', y!.id).single();
    expect(Number(data!.skeins_owned)).toBe(5.25);
    expect((await u.client.rpc('add_skeins', { p_yarn_id: y!.id, p_amount: 0 })).error).not.toBeNull();
  });

  test('cannot add to someone else yarn', async () => {
    const { data: y } = await u.client.from('yarns').insert({ name: 'Mine', skeins_owned: 1 }).select().single();
    await other.client.rpc('add_skeins', { p_yarn_id: y!.id, p_amount: 5 });
    const { data } = await u.client.from('yarns').select('skeins_owned').eq('id', y!.id).single();
    expect(Number(data!.skeins_owned)).toBe(1);
  });
});

describe('new buckets', () => {
  const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
  afterAll(async () => {
    await u.client.storage.from('pattern-instructions').remove([`${u.id}/p.jpg`]);
    await u.client.storage.from('pattern-photos').remove([`${u.id}/r.jpg`]);
  });
  test('own-folder JPEG uploads work, other folders are refused', async () => {
    expect((await u.client.storage.from('pattern-instructions').upload(`${u.id}/p.jpg`, jpeg, { contentType: 'image/jpeg' })).error).toBeNull();
    expect((await u.client.storage.from('pattern-photos').upload(`${u.id}/r.jpg`, jpeg, { contentType: 'image/jpeg' })).error).toBeNull();
    expect((await other.client.storage.from('pattern-instructions').upload(`${u.id}/x.jpg`, jpeg, { contentType: 'image/jpeg' })).error).not.toBeNull();
  });
});
