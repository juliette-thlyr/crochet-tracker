import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBox from './ErrorBox';

test('shows the message and retries', async () => {
  const onRetry = vi.fn();
  render(<ErrorBox error={new Error('Failed to fetch')} onRetry={onRetry} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong: Failed to fetch');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(onRetry).toHaveBeenCalledOnce();
});
