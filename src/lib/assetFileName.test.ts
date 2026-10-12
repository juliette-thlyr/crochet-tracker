import { assetFileName } from './assetFileName';

test('module assets like the pdf.js worker are published with a .js extension', () => {
  expect(assetFileName({ names: ['pdf.worker.min.mjs'] })).toBe('assets/[name]-[hash].js');
});

test('other assets keep their extension', () => {
  expect(assetFileName({ names: ['index.css'] })).toBe('assets/[name]-[hash][extname]');
  expect(assetFileName({ names: [] })).toBe('assets/[name]-[hash][extname]');
});
