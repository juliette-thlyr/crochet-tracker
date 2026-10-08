import { useMutation, useQuery } from '@tanstack/react-query';
import { resizeImage } from '../../lib/images';
import { useInvalidateAll } from '../../lib/invalidate';
import { removeFile, uploadFile } from '../../lib/storage';
import { supabase, type Tables } from '../../lib/supabase';
import { openPdf } from './pdf';

export type Instruction = Tables<'part_instructions'>;

const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);

export function nextInstructionPosition(list: { position: number }[]): number {
  return list.reduce((max, i) => Math.max(max, i.position + 1), 0);
}

export function usePartInstructions(patternPartId: string | null) {
  return useQuery({
    queryKey: ['instructions', patternPartId],
    enabled: patternPartId !== null,
    queryFn: async (): Promise<Instruction[]> => {
      const { data, error } = await supabase
        .from('part_instructions').select().eq('pattern_part_id', patternPartId!).order('position');
      if (error) throw error;
      return data;
    },
  });
}

export function useAddPdfPages() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (v: { patternPartId: string; pdfPath: string; pages: number[]; startPosition: number }) => {
      const signed = await supabase.storage.from('pattern-pdfs').createSignedUrl(v.pdfPath, 600);
      if (signed.error) throw signed.error;
      const pdf = await openPdf(signed.data.signedUrl);
      const tooFar = v.pages.find((n) => n > pdf.numPages);
      if (tooFar !== undefined) throw new Error(`Page ${tooFar} doesn't exist — the PDF has ${pdf.numPages} pages.`);
      for (const [i, n] of v.pages.entries()) {
        try {
          const path = await uploadFile('pattern-instructions', await pdf.render(n), 'jpg');
          const ins = await supabase.from('part_instructions').insert({
            pattern_part_id: v.patternPartId, position: v.startPosition + i, kind: 'pdf_page', pdf_page: n, image_path: path,
          });
          if (ins.error) throw ins.error;
        } catch (err) {
          throw new Error(`Page ${n} couldn't be added: ${messageOf(err)}`);
        }
      }
    },
    onSettled: invalidate,
  });
}

export function useAddInstructionPhotos() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (v: { patternPartId: string; files: File[]; startPosition: number }) => {
      for (const [i, file] of v.files.entries()) {
        const path = await uploadFile('pattern-instructions', await resizeImage(file), 'jpg');
        const ins = await supabase.from('part_instructions').insert({
          pattern_part_id: v.patternPartId, position: v.startPosition + i, kind: 'photo', image_path: path,
        });
        if (ins.error) throw ins.error;
      }
    },
    onSettled: invalidate,
  });
}

export function useRemoveInstruction() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (instruction: Instruction) => {
      const { error } = await supabase.from('part_instructions').delete().eq('id', instruction.id);
      if (error) throw error;
      // The picture itself: best effort, the row is what the app shows.
      await removeFile('pattern-instructions', instruction.image_path).catch(() => undefined);
    },
    onSuccess: invalidate,
  });
}
