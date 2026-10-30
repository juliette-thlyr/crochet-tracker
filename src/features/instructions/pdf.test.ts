import { openPdf } from './pdf';

const getDocument = vi.fn(() => ({ promise: Promise.resolve({ numPages: 2, destroy: vi.fn() }) }));
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({ GlobalWorkerOptions: {}, getDocument }));
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url', () => ({ default: '/assets/pdf.worker.js' }));

test('tells pdf.js where its decoders, colour profiles, fonts and character maps are', async () => {
  const pdf = await openPdf('https://example.test/pattern.pdf');
  expect(pdf.numPages).toBe(2);
  // Without these, pictures stored as JPEG 2000 / JBIG2 (common in exported patterns) come out blank.
  expect(getDocument).toHaveBeenCalledWith({
    url: 'https://example.test/pattern.pdf',
    wasmUrl: '/pdfjs/wasm/',
    iccUrl: '/pdfjs/iccs/',
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
  });
});
