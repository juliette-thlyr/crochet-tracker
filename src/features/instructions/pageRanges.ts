const SYNTAX = 'Use page numbers like 3, 3-4 or 3, 5-6.';

export function parsePageRanges(input: string, max?: number): { pages: number[] } | { error: string } {
  const text = input.replace(/\s+/g, '');
  if (text === '') return { error: 'Enter at least one page.' };
  const pages: number[] = [];
  for (const token of text.split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(token);
    if (!m) return { error: SYNTAX };
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]);
    if (from < 1 || to < from) return { error: SYNTAX };
    for (let n = from; n <= to; n++) if (!pages.includes(n)) pages.push(n);
  }
  if (max !== undefined) {
    const tooFar = pages.find((n) => n > max);
    if (tooFar !== undefined) return { error: `Page ${tooFar} doesn't exist — the PDF has ${max} pages.` };
  }
  return { pages };
}
