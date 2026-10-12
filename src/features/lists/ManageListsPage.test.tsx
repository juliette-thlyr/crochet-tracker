import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import ManageListsPage from './ManageListsPage';

const importLists = vi.fn();
const rename = vi.fn();
const remove = vi.fn();
const entry = { user_id: 'u', created_at: '', updated_at: '' };
vi.mock('./api', () => ({
  useCatalog: () => ({ data: [
    { ...entry, id: 'c1', brand: 'Hobbii', name: 'Honey Bunny', yarn_weight: 'super_bulky', fiber: 'Polyester' },
    { ...entry, id: 'c2', brand: 'Hobbii', name: 'Toucan', yarn_weight: null, fiber: null },
  ] }),
  useShops: () => ({ data: [{ ...entry, id: 's1', name: 'Hobbii' }] }),
  useFibers: () => ({ data: [{ ...entry, id: 'f1', name: 'Coton' }] }),
  useImportLists: () => ({ mutate: importLists, isPending: false, error: null }),
  useRenameListEntry: () => ({ mutate: rename, reset: vi.fn(), isPending: false, error: null }),
  useDeleteListEntry: () => ({ mutate: remove, isPending: false, error: null }),
}));

beforeEach(() => { importLists.mockReset(); rename.mockReset(); remove.mockReset(); });

test('shows the three lists, yarns grouped by brand', () => {
  renderWithProviders(<ManageListsPage />);
  const yarns = screen.getByRole('region', { name: 'Yarns' });
  expect(within(yarns).getByRole('heading', { name: 'Hobbii' })).toBeInTheDocument();
  expect(yarns).toHaveTextContent('Honey Bunny · Super bulky · Polyester');
  expect(screen.getByRole('region', { name: 'Shops' })).toHaveTextContent('Hobbii');
  expect(screen.getByRole('region', { name: 'Fibers' })).toHaveTextContent('Coton');
});

test('pasting yarn lines imports the understood ones and reports the rest', async () => {
  importLists.mockImplementation((_v, opts) => opts.onSuccess({ added: 1, skipped: 0 }));
  renderWithProviders(<ManageListsPage />);
  await userEvent.type(screen.getByLabelText('Paste yarns'), 'Drops ; Paris ; DK ; Coton{enter}nonsense');
  await userEvent.click(screen.getByRole('button', { name: 'Import yarns' }));
  expect(importLists).toHaveBeenCalledWith(
    { yarns: [{ brand: 'Drops', name: 'Paris', yarn_weight: 'dk', fiber: 'Coton' }] }, expect.anything());
  expect(screen.getByRole('status')).toHaveTextContent('1 added, 0 already there, 1 line not understood (line 2)');
});

test('renames and removes an entry', async () => {
  renderWithProviders(<ManageListsPage />);
  await userEvent.click(screen.getByRole('button', { name: 'Rename Coton' }));
  const field = screen.getByLabelText('New name for Coton');
  await userEvent.clear(field);
  await userEvent.type(field, 'Coton bio');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(rename).toHaveBeenCalledWith({ table: 'fibers', id: 'f1', patch: { name: 'Coton bio' } }, expect.anything());

  await userEvent.click(screen.getByRole('button', { name: 'Remove Toucan' }));
  await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
  expect(remove).toHaveBeenCalledWith({ table: 'catalog_yarns', id: 'c2' });
});

test('cancelling a rename restores the row', async () => {
  renderWithProviders(<ManageListsPage />);
  await userEvent.click(screen.getByRole('button', { name: 'Rename Coton' }));
  expect(screen.getByLabelText('New name for Coton')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByLabelText('New name for Coton')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Fibers' })).toHaveTextContent('Coton');
});

test('Save is disabled when the name is cleared', async () => {
  renderWithProviders(<ManageListsPage />);
  await userEvent.click(screen.getByRole('button', { name: 'Rename Coton' }));
  await userEvent.clear(screen.getByLabelText('New name for Coton'));
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});
