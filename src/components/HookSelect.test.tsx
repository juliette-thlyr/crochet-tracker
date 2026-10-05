import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HookSelect from './HookSelect';

test('offers — and 1.0 to 12.0 mm, and reports numbers', async () => {
  const onChange = vi.fn();
  render(<HookSelect label="Recommended hook" value={3.5} onChange={onChange} />);
  const select = screen.getByLabelText('Recommended hook');
  expect(screen.getAllByRole('option')).toHaveLength(24);
  expect(select).toHaveValue('3.5');
  await userEvent.selectOptions(select, '4.0 mm');
  expect(onChange).toHaveBeenLastCalledWith(4);
  await userEvent.selectOptions(select, '—');
  expect(onChange).toHaveBeenLastCalledWith(null);
});
