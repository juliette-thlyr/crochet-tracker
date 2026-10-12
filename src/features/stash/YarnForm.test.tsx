import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import YarnForm from './YarnForm';

const save = vi.fn();
vi.mock('./api', () => ({
  useYarn: () => ({ data: undefined }),
  useSaveYarn: () => ({ mutate: save, isPending: false, error: null }),
  toYarnInput: (y: unknown) => y,
}));
const entry = { user_id: 'u', created_at: '', updated_at: '' };
vi.mock('../lists/api', () => ({
  useCatalog: () => ({ data: [
    { ...entry, id: 'c1', brand: 'Hobbii', name: 'Honey Bunny', yarn_weight: 'super_bulky', fiber: 'Polyester' },
    { ...entry, id: 'c2', brand: 'Hobbii', name: 'Toucan', yarn_weight: 'super_bulky', fiber: 'Polyester' },
    { ...entry, id: 'c3', brand: 'Drops', name: 'Paris', yarn_weight: 'dk', fiber: 'Coton' },
  ] }),
  useShops: () => ({ data: [{ ...entry, id: 's1', name: 'Hobbii' }] }),
  useFibers: () => ({ data: [{ ...entry, id: 'f1', name: 'Polyester' }, { ...entry, id: 'f2', name: 'Coton' }] }),
}));
vi.mock('../../lib/images', () => ({ resizeImage: () => Promise.resolve(new Blob(['x'])) }));
vi.mock('../../lib/storage', () => ({ uploadFile: () => Promise.reject(new Error('Upload failed')), useSignedUrl: () => undefined }));

beforeAll(() => { URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn(); });
beforeEach(() => save.mockReset());

const renderNew = () => renderWithProviders(<YarnForm />, { route: '/stash/new', path: '/stash/new' });

test('shows an error and does not save when the photo upload fails', async () => {
  renderNew();
  await userEvent.type(screen.getByLabelText('Name'), 'Fern green');
  await userEvent.upload(screen.getByLabelText('Take or choose a photo'), new File(['x'], 'p.jpg', { type: 'image/jpeg' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed');
  expect(save).not.toHaveBeenCalled();
});

test("brand narrows the name suggestions; picking a name fills weight and fiber", async () => {
  renderNew();
  await userEvent.type(screen.getByLabelText('Brand'), 'Hob');
  await userEvent.click(screen.getByRole('option', { name: 'Hobbii' }));
  await userEvent.click(screen.getByLabelText('Name'));
  const names = screen.getByRole('listbox', { name: 'Name suggestions' });
  expect(names).toHaveTextContent('Honey Bunny');
  expect(names).not.toHaveTextContent('Paris');
  await userEvent.click(screen.getByRole('option', { name: 'Honey Bunny' }));
  expect(screen.getByLabelText('Weight')).toHaveValue('super_bulky');
  expect(screen.getByLabelText('Fiber')).toHaveValue('Polyester');
});

test('picking a name does not overwrite a weight already chosen', async () => {
  renderNew();
  await userEvent.selectOptions(screen.getByLabelText('Weight'), 'dk');
  await userEvent.click(screen.getByLabelText('Name'));
  await userEvent.click(screen.getByRole('option', { name: 'Toucan' }));
  expect(screen.getByLabelText('Weight')).toHaveValue('dk');
  expect(screen.getByLabelText('Fiber')).toHaveValue('Polyester');
});

test('fiber "Other…" saves a new fiber; colour family and shop are saved', async () => {
  renderNew();
  await userEvent.type(screen.getByLabelText('Name'), 'Rose');
  await userEvent.selectOptions(screen.getByLabelText('Fiber'), 'Other…');
  await userEvent.type(screen.getByLabelText('New fiber'), 'Coton bio');
  await userEvent.click(screen.getByRole('radio', { name: 'Pink' }));
  await userEvent.type(screen.getByLabelText('Shop'), 'Hob');
  await userEvent.click(screen.getByRole('option', { name: 'Hobbii' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Rose', fiber: 'Coton bio', color_family: 'pink', bought_at: 'Hobbii' }),
    expect.anything(),
  );
});
