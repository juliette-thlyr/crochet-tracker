import { useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidateAll } from '../../lib/invalidate';
import { supabase, type Tables } from '../../lib/supabase';
import type { CatalogLine } from './parse';

export type CatalogYarn = Tables<'catalog_yarns'>;
export type ListEntry = Tables<'shops'>;
export type ListTable = 'catalog_yarns' | 'shops' | 'fibers';

export function useCatalog() {
  return useQuery({
    queryKey: ['lists', 'catalog'],
    queryFn: async () => {
      const { data, error } = await supabase.from('catalog_yarns').select().order('brand').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useShops() {
  return useQuery({
    queryKey: ['lists', 'shops'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shops').select().order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useFibers() {
  return useQuery({
    queryKey: ['lists', 'fibers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fibers').select().order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useImportLists() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (v: { yarns?: CatalogLine[]; shops?: string[]; fibers?: string[] }) => {
      const { data, error } = await supabase.rpc('import_lists', {
        p_yarns: v.yarns ?? [], p_shops: v.shops ?? [], p_fibers: v.fibers ?? [],
      });
      if (error) throw error;
      return data as { added: number; skipped: number };
    },
    onSuccess: invalidate,
  });
}

/** Names are unique per user; turn the database's unique violation into a readable message. */
function listError(error: { code?: string }) {
  return error.code === '23505' ? new Error('That name is already in the list.') : error;
}

export function useRenameListEntry() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ table, id, patch }: { table: ListTable; id: string; patch: { name?: string; brand?: string } }) => {
      const clean: { name?: string; brand?: string } = {};
      if (patch.name !== undefined) clean.name = patch.name.trim();
      if (patch.brand !== undefined) clean.brand = patch.brand.trim();
      const { error } = await supabase.from(table).update(clean as never).eq('id', id);
      if (error) throw listError(error);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteListEntry() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ table, id }: { table: ListTable; id: string }) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
