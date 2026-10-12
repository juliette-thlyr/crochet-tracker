import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import StartProjectPage from './StartProjectPage';

const start = vi.fn();
const row = { user_id: 'u', pattern_id: 'p1', created_at: '', updated_at: '' };
const pattern = {
  id: 'p1', name: 'Bunny',
  yarn_lines: [
    { ...row, id: 'l1', position: 0, color: 'Pink', color_family: 'pink', skeins: 2, yarn_type: null },
    { ...row, id: 'l2', position: 1, color: 'White', color_family: 'white', skeins: 1, yarn_type: null },
  ],
};
const yarn = (id: string, name: string, color_family: string | null, free: number) => ({
  id, name, brand: 'Hobbii', color: null, color_family, yarn_weight: null, fiber: null, free, owned: free, used: 0, reserved: 0,
});
vi.mock('../patterns/api', () => ({
  usePattern: () => ({ data: pattern, isPending: false, error: null }),
  useStartProject: () => ({ mutate: start, isPending: false, error: null }),
}));
vi.mock('../stash/api', () => ({
  useYarns: () => ({ data: [yarn('y1', 'Honey Bunny', 'pink', 3), yarn('y2', 'Paris', 'green', 1)], error: null }),
}));

const renderPage = () => renderWithProviders(<StartProjectPage />, { route: '/patterns/p1/start', path: '/patterns/:id/start' });

test('the picker starts on the line colour, search looks through every yarn', async () => {
  renderPage();
  expect(screen.getByText('Pink · 2 skeins')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Choose yarn for Pink' }));
  expect(screen.getByRole('button', { name: /Honey Bunny/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Paris/ })).toBeNull();
  await userEvent.type(screen.getByLabelText('Search stash'), 'paris');
  await userEvent.click(screen.getByRole('button', { name: /Paris/ }));
  expect(screen.getByRole('button', { name: 'Change yarn for Pink' })).toBeInTheDocument();
  expect(screen.getByText('→ Paris')).toBeInTheDocument();
});

test('starts the project with the picked yarns; skipped lines are not planned', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Choose yarn for Pink' }));
  await userEvent.click(screen.getByRole('button', { name: /Honey Bunny/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Start project' }));
  expect(start).toHaveBeenCalledWith({ patternId: 'p1', plans: [{ yarn_id: 'y1', skeins: 2 }] }, expect.anything());
});

test('a picked yarn can be skipped again', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Choose yarn for Pink' }));
  await userEvent.click(screen.getByRole('button', { name: /Honey Bunny/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Skip Pink' }));
  expect(screen.getByRole('button', { name: 'Choose yarn for Pink' })).toBeInTheDocument();
});

test('a line colour with no stash yarn can be switched away from', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Choose yarn for White' }));
  expect(screen.getByText('No yarn in this colour. Tap the dot again to see every colour.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: 'White' }));
  expect(screen.getByRole('button', { name: /Honey Bunny/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Paris/ })).toBeInTheDocument();
});
