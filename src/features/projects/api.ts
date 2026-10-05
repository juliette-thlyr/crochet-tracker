import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resizeImage } from '../../lib/images';
import { uploadFile } from '../../lib/storage';
import { supabase, type Tables } from '../../lib/supabase';

export type Project = Tables<'projects'>;
export type Part = Tables<'parts'>;
export type ProjectPhoto = Tables<'project_photos'>;
export type ProjectPart = Part & {
  time_sessions: { id: string; started_at: string; ended_at: string | null }[];
  part_yarns: { id: string; skeins_used: number; yarn: { id: string; name: string } | null }[];
};
export type ProjectDetail = Project & {
  pattern: { id: string; name: string; hook_size_mm: number | null } | null;
  parts: ProjectPart[];
  project_yarns: { id: string; skeins_planned: number; yarn: { id: string; name: string } | null }[];
  project_photos: ProjectPhoto[];
};
export type ProjectListItem = Project & {
  pattern: { name: string } | null;
  photo: string | null;
  partsTotal: number;
  partsDone: number;
  seconds: number;
};

function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ['projects'] }),
    qc.invalidateQueries({ queryKey: ['yarns'] }),
    qc.invalidateQueries({ queryKey: ['patterns'] }),
  ]);
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async (): Promise<ProjectListItem[]> => {
      const [p, s] = await Promise.all([
        supabase.from('projects').select('*, pattern:patterns(name), project_photos(path, created_at)').order('updated_at', { ascending: false }),
        supabase.from('project_summary').select(),
      ]);
      if (p.error) throw p.error;
      if (s.error) throw s.error;
      const summary = new Map(s.data.map((r) => [r.project_id, r]));
      return p.data.map(({ project_photos, ...project }) => {
        const sm = summary.get(project.id);
        const first = [...project_photos].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
        return {
          ...project,
          photo: first?.path ?? null,
          partsTotal: sm?.parts_total ?? 0,
          partsDone: sm?.parts_done ?? 0,
          seconds: Number(sm?.seconds ?? 0),
        };
      });
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async (): Promise<ProjectDetail> => {
      const { data, error } = await supabase
        .from('projects')
        .select(`*, pattern:patterns(id, name, hook_size_mm),
          parts(*, time_sessions(id, started_at, ended_at), part_yarns(id, skeins_used, yarn:yarns(id, name))),
          project_yarns(id, skeins_planned, yarn:yarns(id, name)),
          project_photos(*)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      return { ...data, parts: [...data.parts].sort((a, b) => a.position - b.position) } as ProjectDetail;
    },
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Project> }) => {
      const { error } = await supabase.from('projects').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCreateBlankProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from('projects')
        .insert({ name: 'New project', status: 'in_progress', start_date: new Date().toISOString().slice(0, 10) })
        .select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useAddPart() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ projectId, name, position }: { projectId: string; name: string; position: number }) => {
      const { error } = await supabase.from('parts').insert({ project_id: projectId, name: name.trim(), position });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdatePart() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Part> }) => {
      const { error } = await supabase.from('parts').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeletePart() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('parts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Swaps the positions of two parts. */
export function useMovePart() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ a, b }: { a: Part; b: Part }) => {
      const one = await supabase.from('parts').update({ position: b.position }).eq('id', a.id);
      if (one.error) throw one.error;
      const two = await supabase.from('parts').update({ position: a.position }).eq('id', b.id);
      if (two.error) throw two.error;
    },
    onSuccess: invalidate,
  });
}

export function usePlanYarn() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ projectId, yarnId, skeins }: { projectId: string; yarnId: string; skeins: number }) => {
      const { error } = await supabase
        .from('project_yarns')
        .upsert({ project_id: projectId, yarn_id: yarnId, skeins_planned: skeins }, { onConflict: 'project_id,yarn_id' });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useAddProjectPhoto() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ projectId, file }: { projectId: string; file: File }) => {
      const path = await uploadFile('project-photos', await resizeImage(file), 'jpg');
      const { error } = await supabase
        .from('project_photos').insert({ project_id: projectId, path, taken_on: new Date().toISOString().slice(0, 10) });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
