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

test('shows the message of a database error object', () => {
  render(<ErrorBox error={{ message: 'duplicate key value', code: '23505' }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong: duplicate key value');
});

test('falls back to the text of anything else', () => {
  render(<ErrorBox error="offline" />);
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong: offline');
});
