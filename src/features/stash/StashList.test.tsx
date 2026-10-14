import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import type { YarnWithStock } from './logic';
import StashList from './StashList';

const base = {
  user_id: 'u', brand: 'Drops', color: null, color_families: [], photo_path: null, bought_at: null, price_per_skein: null,
  bought_on: null, notes: null, created_at: '', updated_at: '', used: 0, reserved: 0,
};
const data: YarnWithStock[] = [
  { ...base, id: 'a', name: 'Fern green', color: 'Fern', color_families: ['green', 'yellow'], yarn_weight: 'dk', fiber: 'Cotton', skeins_owned: 3, owned: 3, free: 1 },
  { ...base, id: 'b', name: 'Rust', color_families: ['orange'], yarn_weight: 'worsted', fiber: 'Merino', skeins_owned: 2, owned: 2, free: 0.6 },
  { ...base, id: 'c', name: 'Charcoal', yarn_weight: 'worsted', fiber: 'Merino', skeins_owned: 1, owned: 1, free: 0 },
];
vi.mock('./api', () => ({ useYarns: () => ({ data, isPending: false, error: null, refetch: vi.fn() }) }));
vi.mock('../../lib/storage', () => ({ useSignedUrl: () => undefined }));

test('lists yarns with free / owned and stock badges', () => {
  renderWithProviders(<StashList />);
  expect(screen.getByRole('link', { name: /Fern green/ })).toHaveTextContent('1 sk free / 3 sk');
  expect(screen.getByRole('link', { name: /Rust/ })).toHaveTextContent('Low');
  expect(screen.getByRole('link', { name: /Charcoal/ })).toHaveTextContent('Out');
});

test('filters by weight and low stock', async () => {
  renderWithProviders(<StashList />);
  await userEvent.click(screen.getByRole('button', { name: 'DK' }));
  expect(screen.queryByRole('link', { name: /Rust/ })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'All weights' }));
  await userEvent.click(screen.getByRole('button', { name: 'Low' }));
  expect(screen.queryByRole('link', { name: /Fern green/ })).toBeNull();
  expect(screen.getByRole('link', { name: /Rust/ })).toBeInTheDocument();
});

test('search box and colour dots narrow the list', async () => {
  renderWithProviders(<StashList />);
  expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(['Orange', 'Yellow', 'Green']);
  await userEvent.click(screen.getByRole('radio', { name: 'Green' }));
  expect(screen.queryByRole('link', { name: /Rust/ })).toBeNull();
  expect(screen.getByRole('link', { name: /Fern green/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: 'Green' }));
  await userEvent.type(screen.getByLabelText('Search yarns'), 'char');
  expect(screen.getAllByRole('link', { name: /sk free/ })).toHaveLength(1);
  expect(screen.getByRole('link', { name: /Charcoal/ })).toBeInTheDocument();
});

test('the card shows the colour name after its dots', () => {
  renderWithProviders(<StashList />);
  expect(screen.getByRole('link', { name: /Fern green/ })).toHaveTextContent('Fern · Drops · DK');
});
