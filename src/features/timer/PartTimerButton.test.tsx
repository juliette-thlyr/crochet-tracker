import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PartTimerButton from './PartTimerButton';

const start = vi.fn();
const stop = vi.fn();
const fx = vi.hoisted(() => ({ running: null as unknown }));
vi.mock('./api', () => ({
  useRunningSession: () => ({ data: fx.running }),
  useStartTimer: () => ({ mutate: start, error: null }),
  useStopTimer: () => ({ mutate: stop, error: null }),
}));
vi.mock('./useNow', () => ({ useNow: () => new Date('2026-10-08T20:12:05Z') }));

test('idle: starts timing this part', async () => {
  fx.running = null;
  render(<PartTimerButton partId="pt1" />);
  await userEvent.click(screen.getByRole('button', { name: 'Start timing' }));
  expect(start).toHaveBeenCalledWith('pt1');
});

test('running here: shows the session clock and stops', async () => {
  fx.running = { started_at: '2026-10-08T20:00:00Z', part: { id: 'pt1' } };
  render(<PartTimerButton partId="pt1" />);
  const button = screen.getByRole('button', { name: 'Stop timing' });
  expect(button).toHaveTextContent('0:12:05');
  await userEvent.click(button);
  expect(stop).toHaveBeenCalled();
});

test('another part running: offers to start this one', () => {
  fx.running = { started_at: '2026-10-08T20:00:00Z', part: { id: 'other' } };
  render(<PartTimerButton partId="pt1" />);
  expect(screen.getByRole('button', { name: 'Start timing' })).toBeInTheDocument();
});
