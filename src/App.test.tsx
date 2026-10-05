import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from './App';

const session = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('./features/auth/useSession', () => ({ useSession: () => session.value }));
vi.mock('./lib/supabase', () => ({ supabase: { auth: { signInWithOtp: vi.fn() } } }));

function renderApp() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><App /></MemoryRouter>
    </QueryClientProvider>,
  );
}

test('signed out shows the login screen', () => {
  session.value = null;
  renderApp();
  expect(screen.getByRole('heading', { name: 'Crochet Tracker' })).toBeInTheDocument();
});

test('signed in shows the tab bar', () => {
  session.value = { user: { id: 'u1' } };
  renderApp();
  expect(screen.getByRole('link', { name: 'Stash' })).toBeInTheDocument();
});
