import { parsePageRanges } from './pageRanges';

test.each([
  ['3', [3]],
  ['3-4', [3, 4]],
  ['3, 5, 7-8', [3, 5, 7, 8]],
  [' 2 ,2, 1-2 ', [2, 1]],
])('parsePageRanges(%j)', (input, pages) => {
  expect(parsePageRanges(input)).toEqual({ pages });
});

test.each([
  ['', 'Enter at least one page.'],
  ['abc', 'Use page numbers like 3, 3-4 or 3, 5-6.'],
  ['4-2', 'Use page numbers like 3, 3-4 or 3, 5-6.'],
  ['0', 'Use page numbers like 3, 3-4 or 3, 5-6.'],
  ['3,,4', 'Use page numbers like 3, 3-4 or 3, 5-6.'],
])('rejects %j', (input, error) => {
  expect(parsePageRanges(input)).toEqual({ error });
});

test('pages beyond the PDF are refused', () => {
  expect(parsePageRanges('7-9', 8)).toEqual({ error: "Page 9 doesn't exist — the PDF has 8 pages." });
  expect(parsePageRanges('7-8', 8)).toEqual({ pages: [7, 8] });
});
