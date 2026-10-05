import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import TimerBar from './TimerBar';

const setRow = vi.fn();
const stop = vi.fn();
const running = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('./api', () => ({
  useRunningSession: () => ({ data: running.value }),
  useSetRow: () => ({ mutate: setRow }),
  useStopTimer: () => ({ mutate: stop }),
}));

const session = {
  id: 's1', started_at: new Date(Date.now() - 12 * 60_000).toISOString(),
  part: {
    id: 'pt1', name: 'Leg 1', current_row: 12, total_rows: 18, project: { id: 'pr1', name: 'T-rex' },
    time_sessions: [{ started_at: '2026-09-23T21:00:00Z', ended_at: '2026-09-23T21:30:00Z' }],
  },
};

test('hidden when nothing is being timed', () => {
  running.value = null;
  const { container } = renderWithProviders(<TimerBar />);
  expect(container).toBeEmptyDOMElement();
});

test('shows the running part and adds a row', async () => {
  running.value = session;
  renderWithProviders(<TimerBar />);
  expect(screen.getByRole('link', { name: /Leg 1 · T-rex/ })).toHaveTextContent('Row 12/18');
  await userEvent.click(screen.getByRole('button', { name: '+ row' }));
  expect(setRow).toHaveBeenCalledWith({ partId: 'pt1', row: 13 });
  await userEvent.click(screen.getByRole('button', { name: 'Stop timer' }));
  expect(stop).toHaveBeenCalled();
});

test('hidden on the Timer tab itself', () => {
  running.value = session;
  const { container } = renderWithProviders(<TimerBar />, { route: '/timer', path: '/timer' });
  expect(container).toBeEmptyDOMElement();
});
