import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './Login';

const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...a: unknown[]) => signInWithOtp(...a),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
    },
  },
}));

beforeEach(() => {
  signInWithOtp.mockReset();
  verifyOtp.mockReset();
});

async function sendCode() {
  signInWithOtp.mockResolvedValue({ error: null });
  render(<Login />);
  await userEvent.type(screen.getByLabelText('Email'), 'me@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
}

test('sends a magic link and asks for the code', async () => {
  await sendCode();
  expect(signInWithOtp).toHaveBeenCalledWith({
    email: 'me@example.com',
    options: { emailRedirectTo: window.location.origin },
  });
  expect(await screen.findByText(/Check your email/)).toBeInTheDocument();
  const code = screen.getByLabelText('Code');
  expect(code).toHaveAttribute('inputmode', 'numeric');
  expect(code).toHaveAttribute('autocomplete', 'one-time-code');
});

test('shows the error when sending fails', async () => {
  signInWithOtp.mockResolvedValue({ error: { message: 'Rate limit exceeded' } });
  render(<Login />);
  await userEvent.type(screen.getByLabelText('Email'), 'me@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Rate limit exceeded');
});

test('signs in with the code from the email', async () => {
  verifyOtp.mockResolvedValue({ error: null });
  await sendCode();
  await userEvent.type(await screen.findByLabelText('Code'), ' 123 456 ');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(verifyOtp).toHaveBeenCalledWith({ email: 'me@example.com', token: '123456', type: 'email' });
});

test('shows the error when the code is wrong', async () => {
  verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
  await sendCode();
  await userEvent.type(await screen.findByLabelText('Code'), '000000');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Token has expired or is invalid');
});

test('can go back and use a different email', async () => {
  await sendCode();
  await userEvent.click(await screen.findByRole('button', { name: 'Use a different email' }));
  expect(screen.getByLabelText('Email')).toHaveValue('me@example.com');
  expect(screen.queryByLabelText('Code')).not.toBeInTheDocument();
});
