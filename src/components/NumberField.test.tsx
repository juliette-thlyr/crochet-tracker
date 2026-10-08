import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import NumberField from './NumberField';

function Harness({ initial, emptyValue, min }: { initial: number | null; emptyValue?: number | null; min?: number }) {
  const [v, setV] = useState<number | null>(initial);
  return (
    <>
      <NumberField aria-label="Qty" value={v} onChange={setV} emptyValue={emptyValue} min={min} />
      <output aria-label="value">{v === null ? 'null' : String(v)}</output>
    </>
  );
}

test('typing replaces the selected value instead of appending to it', async () => {
  render(<Harness initial={1} min={1} emptyValue={1} />);
  const input = screen.getByLabelText('Qty');
  await userEvent.tab();
  await userEvent.keyboard('2');
  expect(input).toHaveValue('2');
  expect(screen.getByLabelText('value')).toHaveTextContent('2');
});

test('the field can be emptied while typing; leaving it empty restores emptyValue', async () => {
  render(<Harness initial={4} min={1} emptyValue={1} />);
  const input = screen.getByLabelText('Qty');
  await userEvent.clear(input);
  expect(input).toHaveValue('');
  await userEvent.tab();
  expect(input).toHaveValue('1');
  expect(screen.getByLabelText('value')).toHaveTextContent('1');
});

test('an optional field left empty becomes null', async () => {
  render(<Harness initial={18} min={1} />);
  const input = screen.getByLabelText('Qty');
  await userEvent.clear(input);
  await userEvent.tab();
  expect(input).toHaveValue('');
  expect(screen.getByLabelText('value')).toHaveTextContent('null');
});

test('a value can be corrected after it was raised', async () => {
  render(<Harness initial={null} min={1} />);
  const input = screen.getByLabelText('Qty');
  await userEvent.type(input, '18');
  await userEvent.tab();
  await userEvent.tab();
  expect(input).toHaveFocus();
  await userEvent.keyboard('24{Enter}');
  expect(screen.getByLabelText('value')).toHaveTextContent('24');
});

test('values below min are raised to min on commit', async () => {
  render(<Harness initial={2} min={1} emptyValue={1} />);
  await userEvent.tab();
  await userEvent.keyboard('0');
  await userEvent.tab();
  expect(screen.getByLabelText('value')).toHaveTextContent('1');
});
