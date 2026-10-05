import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import StartTimerButton from './StartTimerButton';

vi.mock('./api', () => ({
  useRunningSession: () => ({ data: null }),
  useStartTimer: () => ({ mutate: vi.fn(), error: new Error('x') }),
  useStopTimer: () => ({ mutate: vi.fn(), error: null }),
}));

test('shows a visible message when starting fails', () => {
  renderWithProviders(<StartTimerButton partId="p1" label="Main" />);
  expect(screen.getByRole('alert')).toHaveTextContent("Couldn't start");
});
