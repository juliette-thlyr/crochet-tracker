import { useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidateAll } from '../../lib/invalidate';
import { supabase, type Tables } from '../../lib/supabase';
import { cleanPartDrafts, type PartDraft } from './logic';

export type Pattern = Tables<'patterns'>;
export type PatternType = Tables<'pattern_types'>;
export type PatternPart = Tables<'pattern_parts'>;
export type PatternListItem = Pattern & {
  type: PatternType | null;
  parts: PatternPart[];
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
  let pq = supabase.from('patterns').select('*, type:pattern_types(*), parts:pattern_parts(*)').order('name');
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

export function useSavePattern() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ pattern, parts }: { pattern: PatternInput; parts: PartDraft[] }): Promise<string> => {
      const { id, ...fields } = pattern;
      const saved = id
        ? await supabase.from('patterns').update(fields).eq('id', id).select('id').single()
        : await supabase.from('patterns').insert(fields).select('id').single();
      if (saved.error) throw saved.error;
      const patternId = saved.data.id;
      // Template parts are copied into projects at start, so replacing them never touches existing projects.
      // Insert the new parts before removing the old ones so a failed insert cannot lose the template.
      const old = await supabase.from('pattern_parts').select('id').eq('pattern_id', patternId);
      if (old.error) throw old.error;
      const rows = cleanPartDrafts(parts).map((p) => ({ ...p, pattern_id: patternId }));
      if (rows.length > 0) {
        const ins = await supabase.from('pattern_parts').insert(rows);
        if (ins.error) throw ins.error;
      }
      const oldIds = old.data.map((r) => r.id);
      if (oldIds.length > 0) {
        const del = await supabase.from('pattern_parts').delete().in('id', oldIds);
        if (del.error) throw del.error;
      }
      return patternId;
    },
    onSuccess: invalidate,
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
    mutationFn: async (patternId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('start_project_from_pattern', { p_pattern_id: patternId });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}
