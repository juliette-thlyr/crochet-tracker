import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import NewProject from './NewProject';

const navigate = vi.fn();
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => navigate }));
const startProject = vi.fn();
const createBlank = vi.fn();
vi.mock('../../lib/storage', () => ({ useSignedUrl: () => undefined }));
vi.mock('../patterns/api', () => ({
  usePatternTypes: () => ({ data: [{ id: 't1', name: 'Amigurumi' }, { id: 't2', name: 'Bag' }] }),
  usePatterns: () => ({
    data: [
      { id: 'p1', name: 'T-rex', pattern_type_id: 't1', photo_path: null, type: { name: 'Amigurumi' }, parts: [{ count: 2 }, { count: 1 }], yarn_lines: [] },
      { id: 'p2', name: 'Bag A', pattern_type_id: 't2', photo_path: null, type: { name: 'Bag' }, parts: [{ count: 3 }], yarn_lines: [{ id: 'l1' }] },
    ],
    isPending: false, error: null,
  }),
  useStartProject: () => ({ mutate: startProject, isPending: false, error: null }),
}));
vi.mock('./api', () => ({ useCreateBlankProject: () => ({ mutate: createBlank, isPending: false, error: null }) }));

test('search and type chips narrow the patterns', async () => {
  renderWithProviders(<NewProject />);
  await userEvent.click(screen.getByRole('button', { name: 'Bag · 1' }));
  expect(screen.queryByRole('button', { name: /T-rex/ })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'All · 2' }));
  await userEvent.type(screen.getByLabelText('Search patterns'), 'rex');
  expect(screen.queryByRole('button', { name: /Bag A/ })).toBeNull();
});

test('tapping a pattern starts a project from it; blank starts a blank one', async () => {
  renderWithProviders(<NewProject />);
  await userEvent.click(screen.getByRole('button', { name: /T-rex/ }));
  expect(startProject).toHaveBeenCalledWith({ patternId: 'p1' }, expect.anything());
  await userEvent.click(screen.getByRole('button', { name: 'Start a blank project' }));
  expect(createBlank).toHaveBeenCalled();
});

test('a pattern with yarn lines opens the yarn step instead of starting at once', async () => {
  renderWithProviders(<NewProject />);
  await userEvent.click(screen.getByRole('button', { name: /Bag A/ }));
  expect(navigate).toHaveBeenCalledWith('/patterns/p2/start');
  expect(startProject).not.toHaveBeenCalledWith({ patternId: 'p2' }, expect.anything());
});
