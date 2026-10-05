import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RowCounter from './RowCounter';

test('plus and minus change the row, never below 0', async () => {
  const onChange = vi.fn();
  const { rerender } = render(<RowCounter current={12} total={18} onChange={onChange} />);
  expect(screen.getByText('/ 18')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Next row' }));
  expect(onChange).toHaveBeenLastCalledWith(13);
  await userEvent.click(screen.getByRole('button', { name: 'Previous row' }));
  expect(onChange).toHaveBeenLastCalledWith(11);

  rerender(<RowCounter current={0} total={18} onChange={onChange} />);
  onChange.mockClear();
  await userEvent.click(screen.getByRole('button', { name: 'Previous row' }));
  expect(onChange).not.toHaveBeenCalled();
});

test('starts at row 1 when nothing was counted yet', async () => {
  const onChange = vi.fn();
  render(<RowCounter current={null} total={null} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Next row' }));
  expect(onChange).toHaveBeenCalledWith(1);
});

test('tapping the number lets you type it', async () => {
  const onChange = vi.fn();
  render(<RowCounter current={12} total={18} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Row 12, tap to type' }));
  const input = screen.getByLabelText('Row number');
  await userEvent.clear(input);
  await userEvent.type(input, '15{Enter}');
  expect(onChange).toHaveBeenLastCalledWith(15);
});
