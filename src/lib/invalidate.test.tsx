import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useInvalidateAll } from './invalidate';

test('useInvalidateAll refreshes every feature cache', async () => {
  const qc = new QueryClient();
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useInvalidateAll(), { wrapper });
  await act(async () => { await result.current(); });
  const keys = spy.mock.calls.map((c) => c[0]?.queryKey?.[0]);
  expect(keys.sort()).toEqual(['instructions', 'parts', 'pattern-types', 'patterns', 'projects', 'timer', 'yarns']);
});
