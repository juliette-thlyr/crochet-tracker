import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YarnUsageForm from './YarnUsageForm';

test('picks a stash yarn and a number of skeins', async () => {
  const onSave = vi.fn();
  render(<YarnUsageForm yarns={[{ id: 'y1', name: 'Fern green' }]} onSave={onSave} onCancel={vi.fn()} />);
  await userEvent.selectOptions(screen.getByLabelText('Yarn'), 'Fern green');
  const skeins = screen.getByLabelText('Skeins used');
  await userEvent.clear(skeins);
  await userEvent.type(skeins, '0.25');
  await userEvent.click(screen.getByRole('button', { name: 'Save yarn' }));
  expect(onSave).toHaveBeenCalledWith({ yarnId: 'y1', skeins: 0.25 });
});

test('options show the yarn colour after its name', () => {
  render(<YarnUsageForm yarns={[{ id: 'y1', name: 'Honey Bunny', color: 'Teal' }, { id: 'y2', name: 'Plain', color: null }]}
    onSave={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByRole('option', { name: 'Honey Bunny · Teal' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Plain' })).toBeInTheDocument();
});
