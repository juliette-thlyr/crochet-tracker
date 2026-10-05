import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import YarnPage from './YarnPage';

const remove = vi.fn();
vi.mock('./api', () => ({
  useYarn: () => ({
    data: {
      id: 'y1', user_id: 'u', brand: 'Drops Paris', name: 'Fern green', color: 'green', yarn_weight: 'dk',
      fiber: '100% cotton', skeins_owned: 3, photo_path: null, bought_at: 'Wool shop', price_per_skein: 4.5,
      bought_on: '2026-09-03', notes: null, created_at: '', updated_at: '', owned: 3, used: 1.1, reserved: 0.9, free: 1,
    },
    isPending: false, error: null, refetch: vi.fn(),
  }),
  useYarnUsage: () => ({
    data: [{ projectId: 'p1', name: 'T-rex for Léo', status: 'in_progress', planned: 2, used: 1.1 }],
  }),
  useDeleteYarn: () => ({ mutate: remove, error: new Error('This yarn is used or planned in a project. Set "owned" to 0 instead.') }),
}));
vi.mock('../../lib/storage', () => ({ useSignedUrl: () => undefined }));

test('shows stock, usage and purchase details', () => {
  renderWithProviders(<YarnPage />, { route: '/stash/y1', path: '/stash/:id' });
  expect(screen.getByRole('heading', { name: 'Fern green' })).toBeInTheDocument();
  expect(screen.getByText('Reserved').parentElement).toHaveTextContent('0.9');
  expect(screen.getByRole('link', { name: /T-rex for Léo/ })).toHaveTextContent('1.1 used · 2 planned');
  expect(screen.getByText(/4,50/)).toBeInTheDocument();
});

test('delete asks for confirmation and shows why it is blocked', async () => {
  renderWithProviders(<YarnPage />, { route: '/stash/y1', path: '/stash/:id' });
  await userEvent.click(screen.getByRole('button', { name: 'Delete yarn' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(remove).toHaveBeenCalledWith('y1', expect.anything());
  expect(screen.getByRole('alert')).toHaveTextContent('Set "owned" to 0 instead');
});
