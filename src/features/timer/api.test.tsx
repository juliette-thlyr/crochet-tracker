import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useSetRow, type RunningSession } from './api';

const gate = vi.hoisted(() => ({ release: null as null | (() => void) }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: () => new Promise((resolve) => { gate.release = () => resolve({ error: null }); }),
      }),
    }),
  },
}));

test('useSetRow updates the cached row optimistically', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const session: RunningSession = {
    id: 's1', started_at: '2026-09-24T10:00:00Z',
    part: { id: 'pt1', name: 'Leg 1', current_row: 12, total_rows: 18, project: { id: 'pr1', name: 'T' }, time_sessions: [] },
  };
  qc.setQueryData(['timer', 'running'], session);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useSetRow(), { wrapper });
  result.current.mutate({ partId: 'pt1', row: 13 });
  await waitFor(() =>
    expect(qc.getQueryData<RunningSession>(['timer', 'running'])?.part.current_row).toBe(13));
  gate.release?.();
});
