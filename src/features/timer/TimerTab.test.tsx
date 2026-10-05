import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import TimerTab from './TimerTab';

const start = vi.fn();
vi.mock('./api', () => ({
  useRunningSession: () => ({ data: null, isPending: false }),
  useRecentParts: () => ({
    data: [{ started_at: '2026-09-23T19:00:00Z', part: {
      id: 'pt9', name: 'Main', done: false, current_row: 64, total_rows: 120, resume_note: null, project: { name: 'Winter scarf' },
    } }],
  }),
  useStartTimer: () => ({ mutate: start }),
  useStopTimer: () => ({ mutate: vi.fn() }),
  useSetRow: () => ({ mutate: vi.fn() }),
}));

test('when idle, lists parts to pick up again and starts one', async () => {
  renderWithProviders(<TimerTab />, { route: '/timer', path: '/timer' });
  expect(screen.getByText('Nothing is being timed.')).toBeInTheDocument();
  expect(screen.getByText('Main · Winter scarf')).toBeInTheDocument();
  expect(screen.getByText(/Row 64\/120/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Start timer for Main' }));
  expect(start).toHaveBeenCalledWith('pt9');
});
