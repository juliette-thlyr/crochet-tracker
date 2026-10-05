import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionForm from './SessionForm';

test('computes the end from start and duration', async () => {
  const onSave = vi.fn();
  render(<SessionForm onSave={onSave} onCancel={vi.fn()} />);
  // datetime-local inputs cannot be typed into character by character in jsdom
  fireEvent.change(screen.getByLabelText('Started'), { target: { value: '2026-09-22T21:05' } });
  const minutes = screen.getByLabelText('Duration (minutes)');
  await userEvent.clear(minutes);
  await userEvent.type(minutes, '25');
  await userEvent.click(screen.getByRole('button', { name: 'Save time' }));
  const { started_at, ended_at } = onSave.mock.calls[0][0];
  expect(new Date(ended_at).getTime() - new Date(started_at).getTime()).toBe(25 * 60 * 1000);
  expect(new Date(started_at).getTime()).toBe(new Date('2026-09-22T21:05').getTime());
});

test('refuses a duration of 0', async () => {
  const onSave = vi.fn();
  render(<SessionForm onSave={onSave} onCancel={vi.fn()} />);
  const minutes = screen.getByLabelText('Duration (minutes)');
  await userEvent.clear(minutes);
  await userEvent.type(minutes, '0');
  await userEvent.click(screen.getByRole('button', { name: 'Save time' }));
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('at least 1 minute');
});
