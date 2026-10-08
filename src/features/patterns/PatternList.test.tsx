import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import PatternList from './PatternList';

const types = [
  { id: 't1', name: 'Amigurumi', position: 0 },
  { id: 't2', name: 'Clothes', position: 1 },
];
const p = (id: string, name: string, typeId: string | null, timesMade: number) => ({
  id, name, pattern_type_id: typeId, type: types.find((t) => t.id === typeId) ?? null,
  designer: null, url: null, hook_size_mm: 3.5, yarn_weight: 'dk', notes: null, pdf_path: null, photo_path: null,
  parts: [{ id: `${id}-p`, name: 'Body', count: 2, total_rows: 10, position: 0 }],
  timesMade, avgSeconds: timesMade ? 7200 : null, avgSkeins: timesMade ? 2.4 : null,
});
vi.mock('../../lib/storage', () => ({ useSignedUrl: () => undefined }));
vi.mock('./api', () => ({
  usePatternTypes: () => ({ data: types }),
  usePatterns: () => ({
    data: [p('a', 'T-rex', 't1', 1), p('b', 'Teddy bear', 't1', 0), p('c', 'Scarf 1', 't2', 0)],
    isPending: false, error: null, refetch: vi.fn(),
  }),
}));

test('shows type chips with counts and filters by type', async () => {
  renderWithProviders(<PatternList />);
  expect(screen.getByRole('button', { name: 'All · 3' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Clothes · 1' }));
  expect(screen.getByRole('link', { name: /Scarf 1/ })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /T-rex/ })).toBeNull();
});

test('cards show type, parts, hook and stats', () => {
  renderWithProviders(<PatternList />);
  const card = screen.getByRole('link', { name: /T-rex/ });
  expect(card).toHaveTextContent('Amigurumi');
  expect(card).toHaveTextContent('2 parts · DK · 3.5 mm');
  expect(card).toHaveTextContent('Made 1× · avg 2h 00m · 2.4 sk');
  expect(screen.getByRole('link', { name: /Teddy bear/ })).toHaveTextContent('Not made yet');
});

test('links to the pattern type manager', () => {
  renderWithProviders(<PatternList />);
  expect(screen.getByRole('link', { name: 'Manage types' })).toHaveAttribute('href', '/patterns/types');
});
