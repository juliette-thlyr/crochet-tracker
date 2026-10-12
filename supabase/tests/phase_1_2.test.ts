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

async function yarn(fields: Record<string, unknown>, client = u.client) {
  const { data, error } = await client.from('yarns').insert({ skeins_owned: 3, ...fields }).select().single();
  if (error) throw error;
  return data;
}

describe('lists', () => {
  test('saving a yarn fills the lists once, ignoring case', async () => {
    await yarn({ brand: 'Hobbii', name: 'Honey Bunny', yarn_weight: 'super_bulky', fiber: 'Polyester', bought_at: 'Hobbii' });
    await yarn({ brand: 'hobbii', name: 'honey bunny', fiber: 'polyester', bought_at: 'HOBBII' });
    await yarn({ name: 'No brand', fiber: 'Coton' });

    const cat = await u.client.from('catalog_yarns').select().order('created_at');
    expect(cat.data!.map((c) => [c.brand, c.name, c.yarn_weight, c.fiber]))
      .toEqual([['Hobbii', 'Honey Bunny', 'super_bulky', 'Polyester']]);
    const shops = await u.client.from('shops').select('name');
    expect(shops.data!.map((s) => s.name)).toEqual(['Hobbii']);
    const fibers = await u.client.from('fibers').select('name').order('name');
    expect(fibers.data!.map((f) => f.name)).toEqual(['Coton', 'Polyester']);
  });

  test('lists are private and unique per user (case-insensitive)', async () => {
    const a = await u.client.from('shops').insert({ name: 'Wool Shop' });
    expect(a.error).toBeNull();
    const dup = await u.client.from('shops').insert({ name: 'wool shop' });
    expect(dup.error?.code).toBe('23505');
    const theirs = await other.client.from('shops').insert({ name: 'Wool Shop' });
    expect(theirs.error).toBeNull();
    const seen = await other.client.from('shops').select('name');
    expect(seen.data!.map((s) => s.name)).toEqual(['Wool Shop']);
  });

  test('import_lists adds new entries, skips existing ones and adds fibers from yarn lines', async () => {
    const { data, error } = await u.client.rpc('import_lists', {
      p_yarns: [
        { brand: 'Hobbii', name: 'Baby Snuggle', yarn_weight: 'super_bulky', fiber: 'Polyester' },
        { brand: 'HOBBII', name: 'honey bunny', yarn_weight: null, fiber: null },
        { brand: 'Drops', name: 'Paris', yarn_weight: 'dk', fiber: 'Coton bio' },
      ],
      p_shops: ['Hobbii', 'Wool Warehouse'],
      p_fibers: ['Soie', 'polyester'],
    });
    expect(error).toBeNull();
    expect(data).toEqual({ added: 4, skipped: 3 });
    const fibers = await u.client.from('fibers').select('name').order('name');
    expect(fibers.data!.map((f) => f.name)).toEqual(['Coton', 'Coton bio', 'Polyester', 'Soie']);
  });

  test('editing a yarn does not bring back removed list entries', async () => {
    const y = await yarn({ name: 'Linen', bought_at: 'Laine Shop', fiber: 'Lin' });
    await u.client.from('shops').delete().ilike('name', 'Laine Shop');
    await u.client.from('fibers').delete().ilike('name', 'Lin');
    const { error } = await u.client.from('yarns').update({
      name: y.name, brand: y.brand, yarn_weight: y.yarn_weight, fiber: y.fiber, bought_at: y.bought_at, notes: 'x',
    }).eq('id', y.id);
    expect(error).toBeNull();
    const shops = await u.client.from('shops').select('name');
    expect(shops.data!.map((s) => s.name)).not.toContain('Laine Shop');
    const fibers = await u.client.from('fibers').select('name');
    expect(fibers.data!.map((f) => f.name)).not.toContain('Lin');
    await u.client.from('yarns').update({ bought_at: 'Other Shop' }).eq('id', y.id);
    const after = await u.client.from('shops').select('name');
    expect(after.data!.map((s) => s.name)).toContain('Other Shop');
  });

  test('each list is fed only by its own column', async () => {
    const y = await yarn({ brand: 'Katia', name: 'Big Ribbon', bought_at: 'Mercerie', fiber: 'Laine' });
    await u.client.from('catalog_yarns').delete().ilike('name', 'Big Ribbon');
    await u.client.from('shops').delete().ilike('name', 'Mercerie');
    const { error } = await u.client.from('yarns').update({
      name: y.name, brand: y.brand, yarn_weight: y.yarn_weight, fiber: 'Coton recyclé', bought_at: y.bought_at, notes: y.notes,
    }).eq('id', y.id);
    expect(error).toBeNull();
    const fibers = await u.client.from('fibers').select('name');
    expect(fibers.data!.map((f) => f.name)).toContain('Coton recyclé');
    const cat = await u.client.from('catalog_yarns').select('name');
    expect(cat.data!.map((c) => c.name)).not.toContain('Big Ribbon');
    const shops = await u.client.from('shops').select('name');
    expect(shops.data!.map((s) => s.name)).not.toContain('Mercerie');
  });
});

async function patternWithParts(parts: { name: string; count: number; total_rows?: number }[]) {
  const { data: pattern, error } = await u.client.from('patterns').insert({ name: 'T-rex' }).select().single();
  if (error) throw error;
  const { data: pp, error: e2 } = await u.client.from('pattern_parts')
    .insert(parts.map((p, i) => ({ ...p, pattern_id: pattern.id, position: i }))).select().order('position');
  if (e2) throw e2;
  return { pattern, pp };
}

describe('pattern materials', () => {
  test('owner-only, deleted with the pattern', async () => {
    const { pattern } = await patternWithParts([{ name: 'Head', count: 1 }]);
    const y = await u.client.from('pattern_yarns').insert({ pattern_id: pattern.id, color: 'Pink', color_family: 'pink', skeins: 2 });
    expect(y.error).toBeNull();
    const m = await u.client.from('pattern_materials').insert({ pattern_id: pattern.id, name: 'Safety eyes 10 mm', quantity: 2 });
    expect(m.error).toBeNull();
    const blank = await u.client.from('pattern_yarns').insert({ pattern_id: pattern.id, color: '  ' });
    expect(blank.error).not.toBeNull();
    const seen = await other.client.from('pattern_yarns').select().eq('pattern_id', pattern.id);
    expect(seen.data).toEqual([]);
    await u.client.from('patterns').delete().eq('id', pattern.id);
    const left = await u.client.from('pattern_materials').select().eq('pattern_id', pattern.id);
    expect(left.data).toEqual([]);
  });
});

describe('start_project_from_pattern with plans', () => {
  test('marks copied parts and plans yarns, summing the same yarn', async () => {
    const { pattern } = await patternWithParts([{ name: 'Leg', count: 2 }]);
    const pink = await yarn({ name: 'Honey Bunny' });
    const white = await yarn({ name: 'Toucan' });
    const { data: projectId, error } = await u.client.rpc('start_project_from_pattern', {
      p_pattern_id: pattern.id,
      p_plans: [{ yarn_id: pink.id, skeins: 2 }, { yarn_id: pink.id, skeins: 0.5 }, { yarn_id: white.id, skeins: 1 }],
    });
    expect(error).toBeNull();
    const parts = await u.client.from('parts').select('name, from_pattern').eq('project_id', projectId).order('position');
    expect(parts.data).toEqual([{ name: 'Leg 1', from_pattern: true }, { name: 'Leg 2', from_pattern: true }]);
    const plans = await u.client.from('project_yarns').select('yarn_id, skeins_planned').eq('project_id', projectId);
    expect(new Map(plans.data!.map((p) => [p.yarn_id, Number(p.skeins_planned)])))
      .toEqual(new Map([[pink.id, 2.5], [white.id, 1]]));
  });

  test('a yarn that is not yours creates no project', async () => {
    const { pattern } = await patternWithParts([{ name: 'Body', count: 1 }]);
    const theirs = await yarn({ name: 'Theirs' }, other.client);
    const before = await u.client.from('projects').select('id');
    const { error } = await u.client.rpc('start_project_from_pattern', {
      p_pattern_id: pattern.id, p_plans: [{ yarn_id: theirs.id, skeins: 1 }],
    });
    expect(error).not.toBeNull();
    const after = await u.client.from('projects').select('id');
    expect(after.data!.length).toBe(before.data!.length);
  });

  test('works without plans', async () => {
    const { pattern } = await patternWithParts([{ name: 'Body', count: 1 }]);
    const { error } = await u.client.rpc('start_project_from_pattern', { p_pattern_id: pattern.id });
    expect(error).toBeNull();
  });
});

describe('apply_pattern_update', () => {
  async function project() {
    const { pattern, pp } = await patternWithParts([{ name: 'Head', count: 1, total_rows: 24 }, { name: 'Leg', count: 1 }, { name: 'Tail', count: 1 }]);
    const { data: projectId } = await u.client.rpc('start_project_from_pattern', { p_pattern_id: pattern.id });
    const { data: parts } = await u.client.from('parts').select().eq('project_id', projectId).order('position');
    return { projectId: projectId as string, pp, parts: parts! };
  }

  test('adds after an anchor in order, renames, changes rows and deletes; keeps work', async () => {
    const { projectId, pp, parts } = await project();
    const [head, leg, tail] = parts;
    await u.client.from('parts').update({ current_row: 7 }).eq('id', head.id);
    await u.client.from('time_sessions').insert({ part_id: head.id, started_at: '2026-01-01T10:00:00Z', ended_at: '2026-01-01T11:00:00Z' });

    const { error } = await u.client.rpc('apply_pattern_update', {
      p_project_id: projectId,
      p_changes: [
        { kind: 'rename', part_id: leg.id, name: 'Leg 1' },
        { kind: 'add', pattern_part_id: pp[1].id, name: 'Leg 2', total_rows: null, after_part_id: leg.id },
        { kind: 'add', pattern_part_id: pp[1].id, name: 'Leg 3', total_rows: null, after_part_id: leg.id },
        { kind: 'rows', part_id: head.id, total_rows: 28 },
        { kind: 'delete', part_id: tail.id },
      ],
    });
    expect(error).toBeNull();
    const after = await u.client.from('parts').select('name, total_rows, current_row, from_pattern').eq('project_id', projectId).order('position');
    expect(after.data).toEqual([
      { name: 'Head', total_rows: 28, current_row: 7, from_pattern: true },
      { name: 'Leg 1', total_rows: null, current_row: null, from_pattern: true },
      { name: 'Leg 2', total_rows: null, current_row: null, from_pattern: true },
      { name: 'Leg 3', total_rows: null, current_row: null, from_pattern: true },
    ]);
    const sessions = await u.client.from('time_sessions').select().eq('part_id', head.id);
    expect(sessions.data!.length).toBe(1);
  });

  test('a part of another project changes nothing', async () => {
    const a = await project();
    const b = await project();
    const { error } = await u.client.rpc('apply_pattern_update', {
      p_project_id: a.projectId,
      p_changes: [{ kind: 'rename', part_id: a.parts[0].id, name: 'Renamed' }, { kind: 'delete', part_id: b.parts[0].id }],
    });
    expect(error).not.toBeNull();
    const still = await u.client.from('parts').select('name').eq('id', a.parts[0].id).single();
    expect(still.data!.name).toBe('Head');
  });
});
