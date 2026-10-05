import { fitWithin } from './images';

test.each([
  [4000, 3000, 1600, { width: 1600, height: 1200 }],
  [3000, 4000, 1600, { width: 1200, height: 1600 }],
  [800, 600, 1600, { width: 800, height: 600 }],
])('fitWithin(%i, %i, %i)', (w, h, max, out) => {
  expect(fitWithin(w, h, max)).toEqual(out);
});
