import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import PatternForm from './PatternForm';

const save = vi.fn();
vi.mock('./api', () => ({
  usePatternTypes: () => ({ data: [{ id: 't1', name: 'Amigurumi', position: 0 }, { id: 't2', name: 'Clothes', position: 1 }] }),
  useCreatePatternType: () => ({ mutate: vi.fn() }),
  usePattern: () => ({ data: undefined, isPending: false, error: null }),
  useSavePattern: () => ({ mutate: save, isPending: false, error: null }),
}));
vi.mock('../../lib/storage', () => ({ uploadFile: vi.fn(), MAX_PDF_BYTES: 20 * 1024 * 1024 }));

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
