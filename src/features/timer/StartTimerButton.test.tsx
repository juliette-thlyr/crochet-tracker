import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import StartTimerButton from './StartTimerButton';

const state = vi.hoisted(() => ({ running: null as unknown }));
vi.mock('./api', () => ({
  useRunningSession: () => ({ data: state.running }),
  useStartTimer: () => ({ mutate: vi.fn(), error: new Error('x') }),
  useStopTimer: () => ({ mutate: vi.fn(), error: null }),
}));

beforeEach(() => { state.running = null; });

test('shows a visible message when starting fails', () => {
  renderWithProviders(<StartTimerButton partId="p1" label="Main" />);
  expect(screen.getByRole('alert')).toHaveTextContent("Couldn't start");
});

test('the stop button names the part it stops', () => {
  state.running = { id: 's1', part: { id: 'p1' } };
  renderWithProviders(<StartTimerButton partId="p1" label="Main" />);
  expect(screen.getByRole('button', { name: 'Stop timer for Main' })).toBeInTheDocument();
});
