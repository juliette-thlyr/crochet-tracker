import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import SuggestField from './SuggestField';

function Harness({ suggestions, onPick }: { suggestions: string[]; onPick?: (v: string) => void }) {
  const [v, setV] = useState('');
  return <SuggestField label="Brand" value={v} onChange={setV} suggestions={suggestions} onPick={onPick} />;
}

test('shows matching suggestions while typing and fills the field on pick', async () => {
  const onPick = vi.fn();
  render(<Harness suggestions={['Hobbii', 'Drops', 'Scheepjes']} onPick={onPick} />);
  await userEvent.type(screen.getByLabelText('Brand'), 'ob');
  const list = screen.getByRole('listbox', { name: 'Brand suggestions' });
  expect(list).toHaveTextContent('Hobbii');
  expect(list).not.toHaveTextContent('Drops');
  await userEvent.click(screen.getByRole('option', { name: 'Hobbii' }));
  expect(screen.getByLabelText('Brand')).toHaveValue('Hobbii');
  expect(onPick).toHaveBeenCalledWith('Hobbii');
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('shows at most 8 and hides an exact match', async () => {
  const many = Array.from({ length: 12 }, (_, i) => `Yarn ${i + 1}`);
  render(<Harness suggestions={many} />);
  await userEvent.click(screen.getByLabelText('Brand'));
  expect(screen.getAllByRole('option')).toHaveLength(8);
  await userEvent.type(screen.getByLabelText('Brand'), 'Yarn 12');
  expect(screen.queryByRole('listbox')).toBeNull();
});
