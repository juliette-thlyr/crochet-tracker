import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstructionsSection from './InstructionsSection';

const fx = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock('./api', () => ({ usePartInstructions: () => ({ data: fx.list }) }));
vi.mock('../../lib/storage', () => ({ useSignedUrl: (_b: string, p: string | null) => (p ? `https://signed/${p}` : undefined) }));

test('renders nothing without pictures', () => {
  fx.list = [];
  const { container } = render(<InstructionsSection patternPartId="pp1" />);
  expect(container).toBeEmptyDOMElement();
});

test('shows pictures in order and opens the full-screen viewer', async () => {
  fx.list = [
    { id: 'a', position: 0, kind: 'pdf_page', pdf_page: 3, image_path: 'u/p3.jpg' },
    { id: 'b', position: 1, kind: 'photo', pdf_page: null, image_path: 'u/ph.jpg' },
  ];
  render(<InstructionsSection patternPartId="pp1" />);
  expect(screen.getByRole('heading', { name: 'Instructions' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Open page 3' }));
  const viewer = screen.getByRole('dialog', { name: 'Instructions' });
  expect(viewer.querySelector('img')).toHaveAttribute('src', 'https://signed/u/p3.jpg');
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(viewer.querySelector('img')).toHaveAttribute('src', 'https://signed/u/ph.jpg');
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
