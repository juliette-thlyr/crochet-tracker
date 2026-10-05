import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import TypesPage from './TypesPage';

const types = [
  { id: 't1', name: 'Amigurumi', position: 0 },
  { id: 't2', name: 'Clothes', position: 1 },
  { id: 't3', name: 'Bag', position: 5 },
];
const create = vi.fn();
const rename = vi.fn();
const move = vi.fn();
const del = vi.fn();
const state = vi.hoisted(() => ({ renameError: null as unknown }));
vi.mock('./api', () => ({
  usePatternTypes: () => ({ data: types, isPending: false, error: null, refetch: vi.fn() }),
  useCreatePatternType: () => ({ mutate: create, error: null }),
  useRenamePatternType: () => ({ mutate: rename, error: state.renameError }),
  useMovePatternType: () => ({ mutate: move, error: null }),
  useDeletePatternType: () => ({ mutate: del, error: null }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.renameError = null;
});

const render = () => renderWithProviders(<TypesPage />, { route: '/patterns/types', path: '/patterns/types' });

test('lists the types in order', () => {
  render();
  const names = screen.getAllByRole('button', { name: /^Rename / }).map((b) => b.textContent);
  expect(names).toEqual(['Amigurumi', 'Clothes', 'Bag']);
});

test('renames a type with the trimmed name when leaving the field', async () => {
  render();
  await userEvent.click(screen.getByRole('button', { name: 'Rename Clothes' }));
  const field = screen.getByRole('textbox', { name: 'Type name' });
  await userEvent.clear(field);
  await userEvent.type(field, '  Garments ');
  await userEvent.tab();
  expect(rename).toHaveBeenCalledExactlyOnceWith({ id: 't2', name: 'Garments' });
  expect(screen.queryByRole('textbox', { name: 'Type name' })).not.toBeInTheDocument();
});

test('an unchanged or empty name is not saved', async () => {
  render();
  await userEvent.click(screen.getByRole('button', { name: 'Rename Clothes' }));
  await userEvent.tab();
  await userEvent.click(screen.getByRole('button', { name: 'Rename Clothes' }));
  await userEvent.clear(screen.getByRole('textbox', { name: 'Type name' }));
  await userEvent.tab();
  expect(rename).not.toHaveBeenCalled();
});

test('moves a type up or down by swapping with its neighbour', async () => {
  render();
  expect(screen.getByRole('button', { name: 'Move Amigurumi up' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Move Bag down' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Move Clothes up' }));
  expect(move).toHaveBeenCalledExactlyOnceWith({ a: types[1], b: types[0] });
  await userEvent.click(screen.getByRole('button', { name: 'Move Clothes down' }));
  expect(move).toHaveBeenLastCalledWith({ a: types[1], b: types[2] });
});

test('deleting a type asks for confirmation first', async () => {
  render();
  await userEvent.click(screen.getByRole('button', { name: 'Delete Clothes' }));
  const dialog = screen.getByRole('dialog', { name: 'Delete Clothes?' });
  expect(dialog).toHaveTextContent('Patterns of this type become untyped.');
  expect(del).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(del).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Delete Clothes' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
  expect(del).toHaveBeenCalledExactlyOnceWith('t2');
});

test('adds a type after the last one', async () => {
  render();
  await userEvent.type(screen.getByRole('textbox', { name: 'New type name' }), ' Toys ');
  await userEvent.click(screen.getByRole('button', { name: '+ Add type' }));
  expect(create).toHaveBeenCalledExactlyOnceWith({ name: 'Toys', position: 6 }, expect.anything());
});

test('shows a readable error when a save fails', () => {
  state.renameError = new Error('You already have a type with that name.');
  render();
  expect(screen.getByRole('alert')).toHaveTextContent('You already have a type with that name.');
});
