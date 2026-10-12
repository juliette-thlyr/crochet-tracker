import { useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidateAll } from '../../lib/invalidate';
import { supabase, type Tables } from '../../lib/supabase';
import { cleanMaterials, cleanYarnLines, planRows, type MaterialDraft, type YarnLineDraft } from '../materials/logic';
import { planPartChanges, type PartDraft } from './logic';

export type Pattern = Tables<'patterns'>;
export type PatternType = Tables<'pattern_types'>;
export type PatternPart = Tables<'pattern_parts'>;
export type PatternYarn = Tables<'pattern_yarns'>;
export type PatternMaterial = Tables<'pattern_materials'>;
export type PatternListItem = Pattern & {
  type: PatternType | null;
  parts: PatternPart[];
  yarn_lines: PatternYarn[];
  materials: PatternMaterial[];
  timesMade: number;
  avgSeconds: number | null;
  avgSkeins: number | null;
};
export type PatternDetail = PatternListItem;
export type PatternInput = Omit<Pattern, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'pdf_updated_at'> & { id?: string };

export function usePatternTypes() {
  return useQuery({
    queryKey: ['pattern-types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pattern_types').select().order('position');
      if (error) throw error;
      return data;
    },
  });
}

/** Type names are unique per user; turn the database's unique violation into a readable message. */
function typeError(error: { code?: string }) {
  return error.code === '23505' ? new Error('You already have a type with that name.') : error;
}

export function useCreatePatternType() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ name, position }: { name: string; position: number }) => {
      const { data, error } = await supabase.from('pattern_types').insert({ name: name.trim(), position }).select().single();
      if (error) throw typeError(error);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useRenamePatternType() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('pattern_types').update({ name: name.trim() }).eq('id', id);
      if (error) throw typeError(error);
    },
    onSuccess: invalidate,
  });
}

/** Swaps the positions of two types. */
export function useMovePatternType() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ a, b }: { a: PatternType; b: PatternType }) => {
      const one = await supabase.from('pattern_types').update({ position: b.position }).eq('id', a.id);
      if (one.error) throw one.error;
      const two = await supabase.from('pattern_types').update({ position: a.position }).eq('id', b.id);
      if (two.error) throw two.error;
    },
    onSuccess: invalidate,
  });
}

/** Patterns of a deleted type become untyped (on delete set null). */
export function useDeletePatternType() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pattern_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

async function fetchPatterns(id?: string): Promise<PatternListItem[]> {
  let pq = supabase.from('patterns')
    .select('*, type:pattern_types(*), parts:pattern_parts(*), yarn_lines:pattern_yarns(*), materials:pattern_materials(*)')
    .order('name');
  let sq = supabase.from('pattern_stats').select();
  if (id) {
    pq = pq.eq('id', id);
    sq = sq.eq('pattern_id', id);
  }
  const [p, s] = await Promise.all([pq, sq]);
  if (p.error) throw p.error;
  if (s.error) throw s.error;
  const stats = new Map(s.data.map((r) => [r.pattern_id, r]));
  return p.data.map((pattern) => {
    const st = stats.get(pattern.id);
    return {
      ...pattern,
      parts: [...pattern.parts].sort((a, b) => a.position - b.position),
      yarn_lines: [...pattern.yarn_lines].sort((a, b) => a.position - b.position),
      materials: [...pattern.materials].sort((a, b) => a.position - b.position),
      timesMade: st?.times_made ?? 0,
      avgSeconds: st?.avg_seconds ?? null,
      avgSkeins: st?.avg_skeins === null || st?.avg_skeins === undefined ? null : Number(st.avg_skeins),
    };
  });
}

export function usePatterns() {
  return useQuery({ queryKey: ['patterns'], queryFn: () => fetchPatterns() });
}

export function usePattern(id: string | undefined) {
  return useQuery({
    queryKey: ['patterns', id],
    enabled: id !== undefined,
    queryFn: async () => {
      const [pattern] = await fetchPatterns(id!);
      if (!pattern) throw new Error('Pattern not found');
      return pattern;
    },
  });
}

type RowTable = 'pattern_yarns' | 'pattern_materials';

/** Update kept rows, insert new ones, delete removed ones (same approach as pattern parts). */
async function syncRows(table: RowTable, patternId: string, rows: { id?: string }[]) {
  // Both tables change the same way; the cast keeps supabase-js's per-table row types out of the way.
  const t = () => supabase.from(table as 'pattern_yarns');
  const old = await t().select('id').eq('pattern_id', patternId);
  if (old.error) throw old.error;
  const plan = planRows(old.data.map((r) => r.id), rows);
  for (const { id, ...fields } of plan.updates) {
    const up = await t().update(fields as never).eq('id', id);
    if (up.error) throw up.error;
  }
  if (plan.inserts.length > 0) {
    const ins = await t().insert(plan.inserts.map((r) => ({ ...r, pattern_id: patternId })) as never);
    if (ins.error) throw ins.error;
  }
  if (plan.deleteIds.length > 0) {
    const del = await t().delete().in('id', plan.deleteIds);
    if (del.error) throw del.error;
  }
}

export function useSavePattern() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ pattern, parts, yarnLines, materials, onCreated }: {
      pattern: PatternInput; parts: PartDraft[]; yarnLines: YarnLineDraft[]; materials: MaterialDraft[];
      /** Called right after a new pattern row is inserted, so a retry after a later failure updates it. */
      onCreated?: (id: string) => void;
    }): Promise<string> => {
      const { id, ...fields } = pattern;
      const saved = id
        ? await supabase.from('patterns').update(fields).eq('id', id).select('id').single()
        : await supabase.from('patterns').insert(fields).select('id').single();
      if (saved.error) throw saved.error;
      const patternId = saved.data.id;
      if (!id) onCreated?.(patternId);
      // Kept parts are updated in place so their instructions survive; projects copied from them are unaffected.
      const old = await supabase.from('pattern_parts').select('id').eq('pattern_id', patternId);
      if (old.error) throw old.error;
      const plan = planPartChanges(old.data.map((r) => r.id), parts);
      for (const { id: partId, ...fields } of plan.updates) {
        const up = await supabase.from('pattern_parts').update(fields).eq('id', partId);
        if (up.error) throw up.error;
      }
      if (plan.inserts.length > 0) {
        const ins = await supabase.from('pattern_parts').insert(plan.inserts.map((p) => ({ ...p, pattern_id: patternId })));
        if (ins.error) throw ins.error;
      }
      if (plan.deleteIds.length > 0) {
        const del = await supabase.from('pattern_parts').delete().in('id', plan.deleteIds);
        if (del.error) throw del.error;
      }
      await syncRows('pattern_yarns', patternId, cleanYarnLines(yarnLines));
      await syncRows('pattern_materials', patternId, cleanMaterials(materials));
      return patternId;
    },
    onSuccess: invalidate,
  });
}

/** Number of instruction pictures per pattern part of one pattern. */
export function usePatternInstructionCounts(patternId: string | undefined) {
  return useQuery({
    queryKey: ['instructions', 'counts', patternId],
    enabled: patternId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('part_instructions')
        .select('pattern_part_id, pattern_parts!inner(pattern_id)')
        .eq('pattern_parts.pattern_id', patternId!);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const r of data) counts.set(r.pattern_part_id, (counts.get(r.pattern_part_id) ?? 0) + 1);
      return counts;
    },
  });
}

export function useDeletePattern() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patterns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useStartProject() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ patternId, plans = [] }: { patternId: string; plans?: { yarn_id: string; skeins: number }[] }): Promise<string> => {
      const { data, error } = await supabase.rpc('start_project_from_pattern', { p_pattern_id: patternId, p_plans: plans });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Names of other materials already used on any pattern, for suggestions. */
export function useMaterialNames() {
  return useQuery({
    queryKey: ['patterns', 'material-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pattern_materials').select('name');
      if (error) throw error;
      return [...new Set(data.map((m) => m.name))].sort((a, b) => a.localeCompare(b));
    },
  });
}
