import { render, screen } from '@testing-library/react';
import MaterialsList from './MaterialsList';

const row = { user_id: 'u', pattern_id: 'p', created_at: '', updated_at: '' };

test('lists yarn lines and other materials', () => {
  render(<MaterialsList
    yarnLines={[{ ...row, id: 'y1', position: 0, color: 'Pink', color_family: 'pink', skeins: 2, yarn_type: 'Hobbii Honey Bunny' },
      { ...row, id: 'y2', position: 1, color: 'White', color_family: null, skeins: null, yarn_type: null }]}
    materials={[{ ...row, id: 'm1', position: 0, name: 'Safety eyes 10 mm', quantity: 2 },
      { ...row, id: 'm2', position: 1, name: 'Stuffing', quantity: null }]} />);
  const items = screen.getAllByRole('listitem').map((li) => li.textContent);
  expect(items).toEqual(['Pink · 2 skeins · Hobbii Honey Bunny', 'White', 'Safety eyes 10 mm × 2', 'Stuffing']);
  expect(screen.getByRole('heading', { name: 'Materials' })).toBeInTheDocument();
});

test('renders nothing without materials', () => {
  const { container } = render(<MaterialsList yarnLines={[]} materials={[]} />);
  expect(container).toBeEmptyDOMElement();
});
