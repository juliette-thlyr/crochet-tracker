import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useSetRow, type RunningSession } from './api';

const gate = vi.hoisted(() => ({ resolvers: [] as ((r?: { error: unknown }) => void)[] }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: () => new Promise((resolve) => { gate.resolvers.push((r = { error: null }) => resolve(r)); }),
      }),
    }),
  },
}));

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const session: RunningSession = {
    id: 's1', started_at: '2026-09-24T10:00:00Z',
    part: { id: 'pt1', name: 'Leg 1', current_row: 12, total_rows: 18, project: { id: 'pr1', name: 'T' }, time_sessions: [] },
  };
  qc.setQueryData(['timer', 'running'], session);
  qc.setQueryData(['parts', 'pt1'], { id: 'pt1', name: 'Leg 1', current_row: 12 });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useSetRow(), { wrapper });
  const row = () => qc.getQueryData<RunningSession>(['timer', 'running'])?.part.current_row;
  const partRow = () => qc.getQueryData<{ current_row: number | null }>(['parts', 'pt1'])?.current_row;
  return { qc, result, row, partRow };
}

beforeEach(() => { gate.resolvers = []; });

test('useSetRow updates the cached row optimistically', async () => {
  const { result, row } = setup();
  result.current.mutate({ partId: 'pt1', row: 13 });
  await waitFor(() => expect(row()).toBe(13));
  gate.resolvers[0]?.();
});

test('quick taps are not lost: refetch waits for the last pending tap', async () => {
  const { qc, result, row } = setup();
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  result.current.mutate({ partId: 'pt1', row: 13 });
  await waitFor(() => expect(gate.resolvers).toHaveLength(1));
  result.current.mutate({ partId: 'pt1', row: 14 });
  await waitFor(() => expect(gate.resolvers).toHaveLength(2));
  expect(row()).toBe(14);

  await act(async () => { gate.resolvers[0](); });
  expect(invalidate).not.toHaveBeenCalled();
  expect(row()).toBe(14);

  await act(async () => { gate.resolvers[1](); });
  await waitFor(() => expect(invalidate).toHaveBeenCalled());
  expect(row()).toBe(14);
});

test('useSetRow also patches the part page cache optimistically', async () => {
  const { result, partRow } = setup();
  result.current.mutate({ partId: 'pt1', row: 13 });
  await waitFor(() => expect(partRow()).toBe(13));
  await act(async () => { gate.resolvers[0](); });
});

test('a failed row save rolls back both caches', async () => {
  const { result, row, partRow } = setup();
  result.current.mutate({ partId: 'pt1', row: 13 });
  await waitFor(() => expect(partRow()).toBe(13));
  await act(async () => { gate.resolvers[0]({ error: { message: 'offline' } }); });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(partRow()).toBe(12);
  expect(row()).toBe(12);
});

test('only the running session of the same part is patched', async () => {
  const { qc, result, row } = setup();
  qc.setQueryData(['parts', 'pt2'], { id: 'pt2', current_row: 3 });
  result.current.mutate({ partId: 'pt2', row: 4 });
  await waitFor(() => expect(qc.getQueryData<{ current_row: number }>(['parts', 'pt2'])?.current_row).toBe(4));
  expect(row()).toBe(12);
  await act(async () => { gate.resolvers[0](); });
});
