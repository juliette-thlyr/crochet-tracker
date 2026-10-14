import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColourDots, { MultiColourDots } from './ColourDots';

test('picks a family and clears it when tapped again', async () => {
  const onChange = vi.fn();
  const { rerender } = render(<ColourDots label="Colour family" value={null} onChange={onChange} />);
  expect(screen.getAllByRole('radio')).toHaveLength(12);
  await userEvent.click(screen.getByRole('radio', { name: 'Pink' }));
  expect(onChange).toHaveBeenLastCalledWith('pink');
  rerender(<ColourDots label="Colour family" value="pink" onChange={onChange} />);
  expect(screen.getByRole('radio', { name: 'Pink' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(screen.getByRole('radio', { name: 'Pink' }));
  expect(onChange).toHaveBeenLastCalledWith(null);
});

test('can show only some families', () => {
  render(<ColourDots label="Colour" value={null} onChange={() => {}} families={['green', 'blue']} />);
  expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(['Green', 'Blue']);
});

test('multi-choice keeps up to two families, dropping the oldest, and untaps one', async () => {
  const onChange = vi.fn();
  const { rerender } = render(<MultiColourDots label="Colour families" value={[]} onChange={onChange} />);
  expect(screen.getAllByRole('checkbox')).toHaveLength(12);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Blue' }));
  expect(onChange).toHaveBeenLastCalledWith(['blue']);
  rerender(<MultiColourDots label="Colour families" value={['blue', 'green']} onChange={onChange} />);
  expect(screen.getByRole('checkbox', { name: 'Green' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Red' }));
  expect(onChange).toHaveBeenLastCalledWith(['green', 'red']);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Blue' }));
  expect(onChange).toHaveBeenLastCalledWith(['green']);
});
