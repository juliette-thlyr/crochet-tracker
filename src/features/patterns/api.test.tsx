import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useRenamePatternType } from './api';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: async () => ({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } }),
      }),
    }),
  },
}));

test('renaming to an existing type name gives a readable error', async () => {
  const qc = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useRenamePatternType(), { wrapper });
  result.current.mutate({ id: 't1', name: 'Clothes' });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect((result.current.error as Error).message).toBe('You already have a type with that name.');
});
