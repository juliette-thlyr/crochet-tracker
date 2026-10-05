import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { RecentRow } from './logic';

export type RunningSession = {
  id: string;
  started_at: string;
  part: {
    id: string; name: string; current_row: number | null; total_rows: number | null;
    project: { id: string; name: string };
    time_sessions: { started_at: string; ended_at: string | null }[];
  };
};

export function useRunningSession() {
  return useQuery({
    queryKey: ['timer', 'running'],
    queryFn: async (): Promise<RunningSession | null> => {
      const { data, error } = await supabase
        .from('time_sessions')
        .select('id, started_at, part:parts(id, name, current_row, total_rows, project:projects(id, name), time_sessions(started_at, ended_at))')
        .is('ended_at', null)
        .maybeSingle();
      if (error) throw error;
      return data as RunningSession | null;
    },
    refetchOnWindowFocus: true,
  });
}

export function useRecentParts() {
  return useQuery({
    queryKey: ['timer', 'recent'],
    queryFn: async (): Promise<RecentRow[]> => {
      const { data, error } = await supabase
        .from('time_sessions')
        .select('started_at, part:parts(id, name, done, current_row, total_rows, resume_note, project:projects(name))')
        .order('started_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as RecentRow[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all(['timer', 'projects', 'parts'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export function useStartTimer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (partId: string) => {
      const { error } = await supabase.rpc('start_timer', { p_part_id: partId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useStopTimer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('stop_timer');
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSetRow() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationKey: ['setRow'],
    mutationFn: async ({ partId, row }: { partId: string; row: number }) => {
      const { error } = await supabase.from('parts').update({ current_row: Math.max(0, row) }).eq('id', partId);
      if (error) throw error;
    },
    onMutate: async ({ row }) => {
      await qc.cancelQueries({ queryKey: ['timer', 'running'] });
      const prev = qc.getQueryData<RunningSession | null>(['timer', 'running']);
      if (prev) qc.setQueryData(['timer', 'running'], { ...prev, part: { ...prev.part, current_row: Math.max(0, row) } });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['timer', 'running'], ctx.prev);
    },
    onSettled: async () => {
      // Only refetch once the last pending tap has settled, so an early refetch can't roll back newer taps.
      if (qc.isMutating({ mutationKey: ['setRow'] }) === 1) await invalidate();
    },
  });
}
