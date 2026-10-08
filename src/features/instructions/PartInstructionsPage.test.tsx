import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import PartInstructionsPage from './PartInstructionsPage';

const addPages = vi.fn();
const addPhotos = vi.fn();
const remove = vi.fn();
const fx = vi.hoisted(() => ({
  pdfPath: 'u/t-rex.pdf' as string | null,
  pdfUpdatedAt: '2026-10-01T10:00:00Z' as string | null,
  list: [] as unknown[],
  pagesPending: false,
}));

vi.mock('../patterns/api', () => ({
  usePattern: () => ({
    data: {
      id: 'p1', name: 'T-rex', pdf_path: fx.pdfPath, pdf_updated_at: fx.pdfUpdatedAt,
      parts: [{ id: 'pp1', name: 'Leg', count: 2, total_rows: 18, position: 0 }],
    },
    isPending: false, error: null, refetch: vi.fn(),
  }),
}));
vi.mock('./api', () => ({
  usePartInstructions: () => ({ data: fx.list, isPending: false, error: null }),
  useAddPdfPages: () => ({ mutate: addPages, isPending: fx.pagesPending, error: null }),
  useAddInstructionPhotos: () => ({ mutate: addPhotos, isPending: false, error: null }),
  useRemoveInstruction: () => ({ mutate: remove, error: null }),
  nextInstructionPosition: (l: { position: number }[]) => l.length,
}));
vi.mock('../../lib/storage', () => ({ useSignedUrl: () => undefined }));

const route = { route: '/patterns/p1/parts/pp1', path: '/patterns/:id/parts/:partId' };
beforeEach(() => {
  fx.pdfPath = 'u/t-rex.pdf';
  fx.pdfUpdatedAt = '2026-10-01T10:00:00Z';
  fx.list = [];
  fx.pagesPending = false;
  addPages.mockClear(); addPhotos.mockClear(); remove.mockClear();
});

test('adds the typed PDF pages after the existing pictures', async () => {
  fx.list = [{ id: 'i1', position: 0, kind: 'photo', pdf_page: null, image_path: 'u/a.jpg', created_at: '2026-10-02T00:00:00Z' }];
  renderWithProviders(<PartInstructionsPage />, route);
  expect(screen.getByRole('heading', { name: 'T-rex · Leg' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('PDF pages'), '3-4');
  await userEvent.click(screen.getByRole('button', { name: 'Add pages' }));
  expect(addPages).toHaveBeenCalledWith(
    { patternPartId: 'pp1', pdfPath: 'u/t-rex.pdf', pages: [3, 4], startPosition: 1 },
    expect.anything(),
  );
});

test('invalid page input shows a message and adds nothing', async () => {
  renderWithProviders(<PartInstructionsPage />, route);
  await userEvent.type(screen.getByLabelText('PDF pages'), 'abc');
  await userEvent.click(screen.getByRole('button', { name: 'Add pages' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Use page numbers like 3, 3-4 or 3, 5-6.');
  expect(addPages).not.toHaveBeenCalled();
});

test('without a PDF, adding pages is disabled with a hint', () => {
  fx.pdfPath = null;
  renderWithProviders(<PartInstructionsPage />, route);
  expect(screen.getByRole('button', { name: 'Add pages' })).toBeDisabled();
  expect(screen.getByText('Attach a PDF to the pattern first.')).toBeInTheDocument();
});

test('photos are added in one go', async () => {
  renderWithProviders(<PartInstructionsPage />, route);
  const a = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
  const b = new File(['b'], 'b.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('Add photos'), [a, b]);
  expect(addPhotos).toHaveBeenCalledWith({ patternPartId: 'pp1', files: [a, b], startPosition: 0 });
});

test('removing a picture asks first', async () => {
  fx.list = [{ id: 'i1', position: 0, kind: 'pdf_page', pdf_page: 3, image_path: 'u/p3.jpg', created_at: '2026-10-02T00:00:00Z' }];
  renderWithProviders(<PartInstructionsPage />, route);
  await userEvent.click(screen.getByRole('button', { name: 'Remove page 3' }));
  expect(remove).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
  expect(remove).toHaveBeenCalledWith(fx.list[0]);
});

test('a note appears when the PDF was replaced after pages were added', () => {
  fx.pdfUpdatedAt = '2026-10-05T00:00:00Z';
  fx.list = [{ id: 'i1', position: 0, kind: 'pdf_page', pdf_page: 3, image_path: 'u/p3.jpg', created_at: '2026-10-02T00:00:00Z' }];
  renderWithProviders(<PartInstructionsPage />, route);
  expect(screen.getByText('The PDF was replaced — re-add pages if they changed.')).toBeInTheDocument();
});

test('while pages convert, the button shows progress and photos are blocked', () => {
  fx.pagesPending = true;
  renderWithProviders(<PartInstructionsPage />, route);
  expect(screen.getByRole('button', { name: 'Add pages' })).toHaveTextContent('Converting pages…');
  expect(screen.getByRole('button', { name: 'Add pages' })).toBeDisabled();
  expect(screen.getByLabelText('Add photos')).toBeDisabled();
});
