import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoField from './PhotoField';

vi.mock('../lib/storage', () => ({ useSignedUrl: (_b: string, p: string | null) => (p ? `https://signed/${p}` : undefined) }));
beforeAll(() => { URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn(); });

test('shows the stored photo and can remove it', async () => {
  const onRemove = vi.fn();
  render(<PhotoField label="Photo" bucket="yarn-photos" path="u/a.jpg" file={null} onFile={vi.fn()} onRemove={onRemove} />);
  expect(screen.getByRole('img', { name: 'Photo preview' })).toHaveAttribute('src', 'https://signed/u/a.jpg');
  await userEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
  expect(onRemove).toHaveBeenCalled();
});

test('picking a file reports it and previews it', async () => {
  const onFile = vi.fn();
  const { rerender } = render(<PhotoField label="Photo" bucket="yarn-photos" path={null} file={null} onFile={onFile} onRemove={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull();
  const file = new File(['x'], 'skein.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('Take or choose a photo'), file);
  expect(onFile).toHaveBeenCalledWith(file);
  rerender(<PhotoField label="Photo" bucket="yarn-photos" path={null} file={file} onFile={onFile} onRemove={vi.fn()} />);
  expect(screen.getByRole('img', { name: 'Photo preview' })).toHaveAttribute('src', 'blob:preview');
});
