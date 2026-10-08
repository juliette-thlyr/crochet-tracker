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
vi.mock('../../lib/images', () => ({ resizeImage: () => Promise.resolve(new Blob(['x'])) }));
vi.mock('../../lib/storage', () => ({ uploadFile: () => Promise.reject(new Error('Upload failed')), useSignedUrl: () => undefined }));

beforeAll(() => { URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn(); });

test('shows an error and does not save when the photo upload fails', async () => {
  renderWithProviders(<YarnForm />, { route: '/stash/new', path: '/stash/new' });
  await userEvent.type(screen.getByLabelText('Name'), 'Fern green');
  await userEvent.upload(screen.getByLabelText('Take or choose a photo'), new File(['x'], 'p.jpg', { type: 'image/jpeg' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed');
  expect(save).not.toHaveBeenCalled();
});
