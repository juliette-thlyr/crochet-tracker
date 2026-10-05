import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import PartPage from './PartPage';

const updatePart = vi.fn();
vi.mock('./api', () => ({
  usePart: () => ({
    data: {
      id: 'pt1', name: 'Leg 1', project_id: 'pr1', position: 1, done: false, current_row: 12, total_rows: 18,
      resume_note: 'After the 2nd increase round', notes: null,
      project: { id: 'pr1', name: 'T-rex for Léo' },
      time_sessions: [
        { id: 's1', started_at: '2026-09-23T21:05:00Z', ended_at: '2026-09-23T21:30:00Z' },
      ],
      part_yarns: [{ id: 'u1', skeins_used: 0.15, yarn: { id: 'y1', name: 'Fern green', brand: 'Drops Paris' } }],
    },
    isPending: false, error: null, refetch: vi.fn(),
  }),
  useSaveSession: () => ({ mutate: vi.fn() }),
  useDeleteSession: () => ({ mutate: vi.fn() }),
  useSetYarnUsage: () => ({ mutate: vi.fn() }),
  useRemoveYarnUsage: () => ({ mutate: vi.fn() }),
}));
vi.mock('../projects/api', () => ({ useUpdatePart: () => ({ mutate: updatePart }), useDeletePart: () => ({ mutate: vi.fn() }) }));
vi.mock('../stash/api', () => ({ useYarns: () => ({ data: [] }) }));

test('shows the counter, resume note, time and yarn', () => {
  renderWithProviders(<PartPage />, { route: '/parts/pt1', path: '/parts/:id' });
  expect(screen.getByRole('heading', { name: 'Leg 1' })).toBeInTheDocument();
  expect(screen.getByLabelText('Where I stopped')).toHaveValue('After the 2nd increase round');
  expect(screen.getByText('Time · 25m')).toBeInTheDocument();
  expect(screen.getByText('0.15 sk')).toBeInTheDocument();
});

test('the + button saves the next row', async () => {
  renderWithProviders(<PartPage />, { route: '/parts/pt1', path: '/parts/:id' });
  await userEvent.click(screen.getByRole('button', { name: 'Next row' }));
  expect(updatePart).toHaveBeenCalledWith({ id: 'pt1', patch: { current_row: 13 } });
});

test('the resume note is saved when leaving the field', async () => {
  renderWithProviders(<PartPage />, { route: '/parts/pt1', path: '/parts/:id' });
  const note = screen.getByLabelText('Where I stopped');
  await userEvent.clear(note);
  await userEvent.type(note, 'Switch to cream');
  await userEvent.tab();
  expect(updatePart).toHaveBeenCalledWith({ id: 'pt1', patch: { resume_note: 'Switch to cream' } });
});
