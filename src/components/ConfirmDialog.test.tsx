import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

test('confirm and cancel call their handlers', async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog open title="Delete part?" message="Its time is deleted too." confirmLabel="Delete"
      onConfirm={onConfirm} onCancel={onCancel} />,
  );
  expect(screen.getByRole('dialog', { name: 'Delete part?' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onConfirm).toHaveBeenCalledOnce();
  expect(onCancel).toHaveBeenCalledOnce();
});

test('renders nothing when closed', () => {
  render(<ConfirmDialog open={false} title="X" message="Y" confirmLabel="OK" onConfirm={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.queryByRole('dialog')).toBeNull();
});
