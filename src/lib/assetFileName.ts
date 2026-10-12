/**
 * Build file names for emitted assets. Safari only runs module scripts served with a
 * JavaScript MIME type, and the host may not label `.mjs` that way, so module assets
 * (the pdf.js worker) are published as `.js`.
 */
export function assetFileName(asset: { names: readonly string[] }): string {
  return asset.names.some((n) => n.endsWith('.mjs')) ? 'assets/[name]-[hash].js' : 'assets/[name]-[hash][extname]';
}
