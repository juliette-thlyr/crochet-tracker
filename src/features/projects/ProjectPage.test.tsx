import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import ProjectPage from './ProjectPage';

const updatePart = vi.fn();
const updateProject = vi.fn();
const addPart = vi.fn();
const removePlan = vi.fn();
const part = (id: string, name: string, position: number, extra = {}) => ({
  id, name, position, project_id: 'pr1', done: false, current_row: null, total_rows: null, resume_note: null,
  notes: null, time_sessions: [], part_yarns: [], ...extra,
});
vi.mock('./api', () => ({
  useProject: () => ({
    data: {
      id: 'pr1', name: 'T-rex for Léo', status: 'in_progress', start_date: '2026-09-12', finish_date: null,
      hook_size_mm: 4, notes: null, pattern: { id: 'pa1', name: 'T-rex', hook_size_mm: 3.5 },
      parts: [
        part('a', 'Head', 0, { done: true, current_row: 24, total_rows: 24 }),
        part('b', 'Leg 1', 2, { current_row: 12, total_rows: 18, resume_note: 'after 2nd increase' }),
      ],
      project_yarns: [{ id: 'pl1', skeins_planned: 2, yarn: { id: 'y1', name: 'Fern green' } }], project_photos: [],
    },
    isPending: false, error: null, refetch: vi.fn(),
  }),
  useUpdateProject: () => ({ mutate: updateProject }),
  useUpdatePart: () => ({ mutate: updatePart }),
  useAddPart: () => ({ mutate: addPart }),
  useDeletePart: () => ({ mutate: vi.fn() }),
  useMovePart: () => ({ mutate: vi.fn() }),
  usePlanYarn: () => ({ mutate: vi.fn() }),
  useRemovePlan: () => ({ mutate: removePlan }),
  useAddProjectPhoto: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProject: () => ({ mutate: vi.fn() }),
}));
vi.mock('../stash/api', () => ({ useYarns: () => ({ data: [] }) }));
vi.mock('../timer/StartTimerButton', () => ({ default: () => null }));
vi.mock('../../lib/storage', () => ({ useSignedUrl: () => undefined }));

test('shows parts with rows, resume notes and progress', () => {
  renderWithProviders(<ProjectPage />, { route: '/projects/pr1', path: '/projects/:id' });
  expect(screen.getByRole('heading', { name: 'T-rex for Léo' })).toBeInTheDocument();
  expect(screen.getByText('Parts · 1 of 2 done')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Leg 1/ })).toHaveTextContent('after 2nd increase');
  expect(screen.getByText('Row 12/18')).toBeInTheDocument();
});

test('shows the hook used against the pattern recommendation and saves a change', async () => {
  renderWithProviders(<ProjectPage />, { route: '/projects/pr1', path: '/projects/:id' });
  expect(screen.getByText('hook 4.0 mm (pattern: 3.5 mm) ▾')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Hook used'), '3.5 mm');
  expect(updateProject).toHaveBeenCalledWith({ id: 'pr1', patch: { hook_size_mm: 3.5 } });
});

test('ticking a part marks it done; status changes are saved', async () => {
  renderWithProviders(<ProjectPage />, { route: '/projects/pr1', path: '/projects/:id' });
  await userEvent.click(screen.getByRole('checkbox', { name: 'Leg 1 done' }));
  expect(updatePart).toHaveBeenCalledWith({ id: 'b', patch: { done: true } });
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'Finished');
  expect(updateProject).toHaveBeenCalledWith({ id: 'pr1', patch: { status: 'finished' } });
});

test('renaming the project saves the trimmed name on blur', async () => {
  renderWithProviders(<ProjectPage />, { route: '/projects/pr1', path: '/projects/:id' });
  await userEvent.click(screen.getByRole('button', { name: 'T-rex for Léo' }));
  const input = screen.getByLabelText('Project name');
  await userEvent.clear(input);
  await userEvent.type(input, 'Dino');
  await userEvent.tab();
  expect(updateProject).toHaveBeenCalledWith({ id: 'pr1', patch: { name: 'Dino' } });
});

test('a new part after a position gap gets the next free position', async () => {
  renderWithProviders(<ProjectPage />, { route: '/projects/pr1', path: '/projects/:id' });
  await userEvent.click(screen.getByRole('button', { name: '+ Add part' }));
  await userEvent.type(screen.getByLabelText('New part name'), 'Tail');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(addPart).toHaveBeenCalledWith({ projectId: 'pr1', name: 'Tail', position: 3 });
});

test('a planned yarn can be removed after confirmation', async () => {
  renderWithProviders(<ProjectPage />, { route: '/projects/pr1', path: '/projects/:id' });
  await userEvent.click(screen.getByRole('button', { name: 'Remove plan for Fern green' }));
  expect(removePlan).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
  expect(removePlan).toHaveBeenCalledWith({ projectId: 'pr1', yarnId: 'y1' });
});
