import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './Login';

const signInWithOtp = vi.fn();
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signInWithOtp: (...a: unknown[]) => signInWithOtp(...a) } } }));

beforeEach(() => signInWithOtp.mockReset());

test('sends a magic link and confirms', async () => {
  signInWithOtp.mockResolvedValue({ error: null });
  render(<Login />);
  await userEvent.type(screen.getByLabelText('Email'), 'me@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
  expect(signInWithOtp).toHaveBeenCalledWith({
    email: 'me@example.com',
    options: { emailRedirectTo: window.location.origin },
  });
  expect(await screen.findByText('Check your email for the sign-in link.')).toBeInTheDocument();
});

test('shows the error when sending fails', async () => {
  signInWithOtp.mockResolvedValue({ error: { message: 'Rate limit exceeded' } });
  render(<Login />);
  await userEvent.type(screen.getByLabelText('Email'), 'me@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Rate limit exceeded');
});
