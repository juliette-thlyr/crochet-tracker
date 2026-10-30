// Copies pdf.js's helper files (image decoders, colour profiles, standard fonts, character maps)
// into public/pdfjs/ so the app can serve them. Runs before `npm run dev` and `npm run build`.
// Without them, PDF pictures stored as JPEG 2000 or JBIG2 render blank.
import { cpSync, rmSync } from 'node:fs';

const from = new URL('../node_modules/pdfjs-dist/', import.meta.url);
const to = new URL('../public/pdfjs/', import.meta.url);
rmSync(to, { recursive: true, force: true });
for (const dir of ['wasm', 'iccs', 'standard_fonts', 'cmaps']) {
  cpSync(new URL(`${dir}/`, from), new URL(`${dir}/`, to), { recursive: true });
}
