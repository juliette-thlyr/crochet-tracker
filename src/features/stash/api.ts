import { useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidateAll } from '../../lib/invalidate';
import { supabase } from '../../lib/supabase';
import { mergeYarnUsage, type Yarn, type YarnWithStock } from './logic';

export type YarnInput = Omit<Yarn, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string };

async function fetchYarns(id?: string): Promise<YarnWithStock[]> {
  let yq = supabase.from('yarns').select().order('name');
  let sq = supabase.from('yarn_stock').select();
  if (id) {
    yq = yq.eq('id', id);
    sq = sq.eq('yarn_id', id);
  }
  const [y, s] = await Promise.all([yq, sq]);
  if (y.error) throw y.error;
  if (s.error) throw s.error;
  const stock = new Map(s.data.map((r) => [r.yarn_id, r]));
  return y.data.map((yarn) => {
    const st = stock.get(yarn.id);
    return {
      ...yarn,
      owned: Number(yarn.skeins_owned),
      used: Number(st?.used ?? 0),
      reserved: Number(st?.reserved ?? 0),
      free: Number(st?.free ?? yarn.skeins_owned),
    };
  });
}

export function useYarns() {
  return useQuery({ queryKey: ['yarns'], queryFn: () => fetchYarns() });
}

export function useYarn(id: string | undefined) {
  return useQuery({
    queryKey: ['yarns', id],
    enabled: id !== undefined,
    queryFn: async () => {
      const [yarn] = await fetchYarns(id!);
      if (!yarn) throw new Error('Yarn not found');
      return yarn;
    },
  });
}

export function useYarnUsage(id: string) {
  return useQuery({
    queryKey: ['yarns', id, 'usage'],
    queryFn: async () => {
      const [planned, used] = await Promise.all([
        supabase.from('project_yarns').select('skeins_planned, project:projects(id, name, status)').eq('yarn_id', id),
        supabase.from('part_yarns').select('skeins_used, part:parts(project:projects(id, name, status))').eq('yarn_id', id),
      ]);
      if (planned.error) throw planned.error;
      if (used.error) throw used.error;
      return mergeYarnUsage(planned.data, used.data);
    },
  });
}

export function toYarnInput(y: YarnWithStock): YarnInput {
  return {
    id: y.id, brand: y.brand, name: y.name, color: y.color, yarn_weight: y.yarn_weight, fiber: y.fiber,
    skeins_owned: Number(y.skeins_owned), photo_path: y.photo_path, bought_at: y.bought_at,
    price_per_skein: y.price_per_skein, bought_on: y.bought_on, notes: y.notes,
  };
}

export function useSaveYarn() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ id, ...fields }: YarnInput): Promise<string> => {
      const q = id
        ? supabase.from('yarns').update(fields).eq('id', id).select('id').single()
        : supabase.from('yarns').insert(fields).select('id').single();
      const { data, error } = await q;
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteYarn() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('yarns').delete().eq('id', id);
      if (error?.code === '23503') {
        throw new Error('This yarn is used or planned in a project. Set "owned" to 0 instead.');
      }
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
