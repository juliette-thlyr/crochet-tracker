import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type Bucket = 'pattern-pdfs' | 'project-photos' | 'yarn-photos' | 'pattern-instructions' | 'pattern-photos';
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export async function uploadFile(bucket: Bucket, file: Blob, ext: 'jpg' | 'pdf'): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
  const contentType = ext === 'pdf' ? 'application/pdf' : 'image/jpeg';
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType });
  if (error) throw error;
  return path;
}

export async function removeFile(bucket: Bucket, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export function useSignedUrl(bucket: Bucket, path: string | null): string | undefined {
  const { data } = useQuery({
    queryKey: ['signed-url', bucket, path],
    enabled: path !== null,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return data;
}
