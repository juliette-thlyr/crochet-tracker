import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
export type PatternInput = Omit<Pattern, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string };

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

export function useCreatePatternType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, position }: { name: string; position: number }) => {
      const { data, error } = await supabase.from('pattern_types').insert({ name: name.trim(), position }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pattern-types'] }),
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pattern, parts }: { pattern: PatternInput; parts: PartDraft[] }): Promise<string> => {
      const { id, ...fields } = pattern;
      const saved = id
        ? await supabase.from('patterns').update(fields).eq('id', id).select('id').single()
        : await supabase.from('patterns').insert(fields).select('id').single();
      if (saved.error) throw saved.error;
      const patternId = saved.data.id;
      // Template parts are copied into projects at start, so replacing them never touches existing projects.
      const del = await supabase.from('pattern_parts').delete().eq('pattern_id', patternId);
      if (del.error) throw del.error;
      const rows = cleanPartDrafts(parts).map((p) => ({ ...p, pattern_id: patternId }));
      if (rows.length > 0) {
        const ins = await supabase.from('pattern_parts').insert(rows);
        if (ins.error) throw ins.error;
      }
      return patternId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns'] }),
  });
}

export function useDeletePattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patterns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns'] }),
  });
}

export function useStartProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patternId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('start_project_from_pattern', { p_pattern_id: patternId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}
