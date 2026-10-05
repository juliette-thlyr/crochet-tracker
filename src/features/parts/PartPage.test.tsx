import { useQuery, useQueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import PartPage from './PartPage';

const updatePart = vi.fn();
const setRow = vi.fn();
const fixture = {
  id: 'pt1', name: 'Leg 1', project_id: 'pr1', position: 1, done: false, current_row: 12, total_rows: 18,
  resume_note: 'After the 2nd increase round', notes: null,
  project: { id: 'pr1', name: 'T-rex for Léo' },
  time_sessions: [
    { id: 's1', started_at: '2026-09-23T21:05:00Z', ended_at: '2026-09-23T21:30:00Z' },
    { id: 's2', started_at: '2026-09-22T20:00:00Z', ended_at: '2026-09-22T20:10:00Z' },
  ],
  part_yarns: [{ id: 'u1', skeins_used: 0.15, yarn: { id: 'y1', name: 'Fern green', brand: 'Drops Paris' } }],
};
vi.mock('./api', () => ({
  // The real query cache, so optimistic row patches re-render the page like in the app.
  usePart: (id: string) => useQuery({ queryKey: ['parts', id], queryFn: async () => fixture, initialData: fixture, staleTime: Infinity }),
  useSaveSession: () => ({ mutate: vi.fn() }),
  useDeleteSession: () => ({ mutate: vi.fn() }),
  useSetYarnUsage: () => ({ mutate: vi.fn() }),
  useRemoveYarnUsage: () => ({ mutate: vi.fn() }),
}));
vi.mock('../projects/api', () => ({ useUpdatePart: () => ({ mutate: updatePart }), useDeletePart: () => ({ mutate: vi.fn() }) }));
vi.mock('../timer/api', () => ({
  // Mirrors the real useSetRow's optimistic patch of the part cache.
  useSetRow: () => {
    const qc = useQueryClient();
    return {
      mutate: (v: { partId: string; row: number }) => {
        setRow(v);
        qc.setQueryData(['parts', v.partId], (old: typeof fixture) => ({ ...old, current_row: v.row }));
      },
      error: null,
    };
  },
}));
vi.mock('../stash/api', () => ({ useYarns: () => ({ data: [] }) }));

test('shows the counter, resume note, time and yarn', () => {
  renderWithProviders(<PartPage />, { route: '/parts/pt1', path: '/parts/:id' });
  expect(screen.getByRole('heading', { name: 'Leg 1' })).toBeInTheDocument();
  expect(screen.getByLabelText('Where I stopped')).toHaveValue('After the 2nd increase round');
  expect(screen.getByText('Time · 35m')).toBeInTheDocument();
  expect(screen.getByText('0.15 sk')).toBeInTheDocument();
});

test('the + button saves the next row', async () => {
  renderWithProviders(<PartPage />, { route: '/parts/pt1', path: '/parts/:id' });
  await userEvent.click(screen.getByRole('button', { name: 'Next row' }));
  expect(setRow).toHaveBeenCalledWith({ partId: 'pt1', row: 13 });
  expect(screen.getByRole('button', { name: 'Row 13, tap to type' })).toBeInTheDocument();
});

test('the resume note is saved when leaving the field', async () => {
  renderWithProviders(<PartPage />, { route: '/parts/pt1', path: '/parts/:id' });
  const note = screen.getByLabelText('Where I stopped');
  await userEvent.clear(note);
  await userEvent.type(note, 'Switch to cream');
  await userEvent.tab();
  expect(updatePart).toHaveBeenCalledWith({ id: 'pt1', patch: { resume_note: 'Switch to cream' } });
});

test('two quick taps on + count two rows', async () => {
  setRow.mockClear();
  renderWithProviders(<PartPage />, { route: '/parts/pt1', path: '/parts/:id' });
  const next = screen.getByRole('button', { name: 'Next row' });
  await userEvent.click(next);
  await userEvent.click(next);
  expect(setRow.mock.calls.map((c) => c[0].row)).toEqual([13, 14]);
  expect(updatePart.mock.calls.some((c) => 'current_row' in c[0].patch)).toBe(false);
});

test('editing another session shows its own duration', async () => {
  renderWithProviders(<PartPage />, { route: '/parts/pt1', path: '/parts/:id' });
  const edits = screen.getAllByRole('button', { name: 'Edit time' });
  await userEvent.click(edits[0]);
  expect(screen.getByLabelText('Duration (minutes)')).toHaveValue(25);
  await userEvent.click(edits[1]);
  expect(screen.getByLabelText('Duration (minutes)')).toHaveValue(10);
});
