import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Part } from '../projects/api';

export type Session = { id: string; started_at: string; ended_at: string | null };
export type PartDetail = Part & {
  project: { id: string; name: string };
  time_sessions: Session[];
  part_yarns: { id: string; skeins_used: number; yarn: { id: string; name: string; brand: string | null } | null }[];
};

export function usePart(id: string) {
  return useQuery({
    queryKey: ['parts', id],
    queryFn: async (): Promise<PartDetail> => {
      const { data, error } = await supabase
        .from('parts')
        .select('*, project:projects(id, name), time_sessions(id, started_at, ended_at), part_yarns(id, skeins_used, yarn:yarns(id, name, brand))')
        .eq('id', id)
        .single();
      if (error) throw error;
      const sessions = [...data.time_sessions].sort((a, b) => b.started_at.localeCompare(a.started_at));
      return { ...data, time_sessions: sessions } as PartDetail;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all(['parts', 'projects', 'yarns', 'timer'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export function useSaveSession() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (s: { id?: string; part_id: string; started_at: string; ended_at: string }) => {
      const { id, ...fields } = s;
      const { error } = id
        ? await supabase.from('time_sessions').update(fields).eq('id', id)
        : await supabase.from('time_sessions').insert(fields);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSession() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSetYarnUsage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ partId, yarnId, skeins }: { partId: string; yarnId: string; skeins: number }) => {
      const { error } = await supabase
        .from('part_yarns')
        .upsert({ part_id: partId, yarn_id: yarnId, skeins_used: skeins }, { onConflict: 'part_id,yarn_id' });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRemoveYarnUsage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('part_yarns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
