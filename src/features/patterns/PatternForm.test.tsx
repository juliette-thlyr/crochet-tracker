import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import PatternForm from './PatternForm';

const save = vi.fn();
const fixture = vi.hoisted(() => ({ pattern: undefined as unknown, counts: new Map<string, number>() }));
vi.mock('./api', () => ({
  usePatternTypes: () => ({ data: [{ id: 't1', name: 'Amigurumi', position: 0 }, { id: 't2', name: 'Clothes', position: 1 }] }),
  useCreatePatternType: () => ({ mutate: vi.fn() }),
  usePattern: () => ({ data: fixture.pattern, isPending: false, error: null }),
  usePatternInstructionCounts: () => ({ data: fixture.counts }),
  useSavePattern: () => ({ mutate: save, isPending: false, error: null }),
}));
const uploadFile = vi.fn();
beforeEach(() => { fixture.pattern = undefined; fixture.counts = new Map(); save.mockClear(); });
vi.mock('../../lib/storage', () => ({
  uploadFile: (...a: unknown[]) => uploadFile(...a),
  useSignedUrl: () => undefined,
  MAX_PDF_BYTES: 20 * 1024 * 1024,
}));
vi.mock('../../lib/images', () => ({ resizeImage: async (f: Blob) => f }));

test('saves the pattern with type, recommended hook and parts', async () => {
  renderWithProviders(<PatternForm />, { route: '/patterns/new', path: '/patterns/new' });
  await userEvent.type(screen.getByLabelText('Name'), 'T-rex');
  await userEvent.click(screen.getByRole('radio', { name: 'Amigurumi' }));
  await userEvent.selectOptions(screen.getByLabelText('Recommended hook'), '3.5 mm');

  const names = screen.getAllByLabelText('Part name');
  await userEvent.type(names[0], 'Head');
  await userEvent.type(screen.getAllByLabelText('Rows')[0], '24');
  await userEvent.click(screen.getByRole('button', { name: '+ Add part' }));
  await userEvent.type(screen.getAllByLabelText('Part name')[1], 'Leg');
  const counts = screen.getAllByLabelText('How many');
  await userEvent.clear(counts[1]);
  await userEvent.type(counts[1], '2');

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith(
    {
      pattern: expect.objectContaining({ name: 'T-rex', pattern_type_id: 't1', hook_size_mm: 3.5 }),
      parts: [
        { name: 'Head', count: 1, total_rows: 24 },
        { name: 'Leg', count: 2, total_rows: null },
      ],
    },
    expect.anything(),
  );
});

test('tapping the selected type again clears it', async () => {
  renderWithProviders(<PatternForm />, { route: '/patterns/new', path: '/patterns/new' });
  const chip = screen.getByRole('radio', { name: 'Clothes' });
  await userEvent.click(chip);
  expect(chip).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(chip);
  expect(chip).toHaveAttribute('aria-checked', 'false');
});

test('shows an error and does not save when the PDF upload fails', async () => {
  save.mockClear();
  uploadFile.mockRejectedValueOnce(new Error('Upload failed'));
  const { container } = renderWithProviders(<PatternForm />, { route: '/patterns/new', path: '/patterns/new' });
  await userEvent.type(screen.getByLabelText('Name'), 'T-rex');
  await userEvent.upload(
    container.querySelector('input[type=file]') as HTMLInputElement,
    new File(['x'], 'p.pdf', { type: 'application/pdf' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed');
  expect(save).not.toHaveBeenCalled();
});

test('a result photo is uploaded to pattern-photos and saved with the pattern', async () => {
  uploadFile.mockResolvedValueOnce('u/result.jpg');
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  renderWithProviders(<PatternForm />, { route: '/patterns/new', path: '/patterns/new' });
  await userEvent.type(screen.getByLabelText('Name'), 'Bag A');
  await userEvent.upload(screen.getByLabelText('Take or choose a photo'), new File(['x'], 'bag.jpg', { type: 'image/jpeg' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(uploadFile).toHaveBeenCalledWith('pattern-photos', expect.any(File), 'jpg');
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ pattern: expect.objectContaining({ name: 'Bag A', photo_path: 'u/result.jpg' }) }),
    expect.anything(),
  );
});

const leg = () => ({
  id: 'p1', name: 'T-rex', pattern_type_id: null, designer: null, url: null, hook_size_mm: null,
  yarn_weight: null, notes: null, pdf_path: null, photo_path: null, pdf_updated_at: null,
  parts: [{ id: 'pp1', name: 'Leg', count: 2, total_rows: 18, position: 0 }],
});

test('removing a part that has instructions asks first', async () => {
  fixture.pattern = leg();
  fixture.counts = new Map([['pp1', 2]]);
  renderWithProviders(<PatternForm />, { route: '/patterns/p1/edit', path: '/patterns/:id/edit' });
  await userEvent.click(screen.getByRole('button', { name: 'Remove part' }));
  expect(screen.getByRole('dialog', { name: 'Remove Leg?' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ parts: [] }), expect.anything());
});

test('kept parts are sent with their id', async () => {
  fixture.pattern = leg();
  renderWithProviders(<PatternForm />, { route: '/patterns/p1/edit', path: '/patterns/:id/edit' });
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ parts: [{ id: 'pp1', name: 'Leg', count: 2, total_rows: 18 }] }),
    expect.anything(),
  );
});
