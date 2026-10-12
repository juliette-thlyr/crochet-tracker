import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColourDots from './ColourDots';

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
