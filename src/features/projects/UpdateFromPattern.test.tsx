import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import type { ProjectDetail } from './api';
import UpdateFromPattern from './UpdateFromPattern';

const apply = vi.fn();
const fixture = vi.hoisted(() => ({ patternParts: [] as unknown[] }));
vi.mock('../patterns/api', () => ({
  usePattern: () => ({ data: { id: 'pa1', parts: fixture.patternParts }, error: null }),
}));
vi.mock('./api', () => ({ useApplyPatternUpdate: () => ({ mutate: apply, isPending: false, error: null }) }));

const part = (id: string, name: string, position: number, pp: string | null, extra = {}) => ({
  id, name, position, pattern_part_id: pp, from_pattern: pp !== null, done: false, current_row: null, total_rows: null,
  time_sessions: [], part_yarns: [], ...extra,
});
const project = (parts: unknown[]) => ({ id: 'pr1', pattern: { id: 'pa1', name: 'T-rex', hook_size_mm: null }, parts }) as unknown as ProjectDetail;
const pp = (id: string, name: string, count: number, position: number) => ({ id, name, count, position, total_rows: null });

beforeEach(() => { apply.mockReset(); });

test('lists the changes, ticked by default except removals, and applies the ticked ones', async () => {
  fixture.patternParts = [pp('H', 'Head', 1, 0), pp('L', 'Back leg', 1, 1), pp('T', 'Tail', 1, 2)];
  const onClose = vi.fn();
  apply.mockImplementation((_v, opts) => opts.onSuccess());
  renderWithProviders(<UpdateFromPattern project={project([
    part('a', 'Head', 0, 'H'), part('b', 'Leg', 1, 'L'), part('h', 'Hat', 2, null, { from_pattern: true }),
  ])} onClose={onClose} />);

  expect(screen.getByRole('checkbox', { name: 'Rename Leg → Back leg' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'New part: Tail' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Hat is no longer in the pattern — delete it' })).not.toBeChecked();

  await userEvent.click(screen.getByRole('checkbox', { name: 'Rename Leg → Back leg' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(apply).toHaveBeenCalledWith({
    projectId: 'pr1',
    changes: [{ kind: 'add', pattern_part_id: 'T', name: 'Tail', total_rows: null, after_part_id: null }],
  }, expect.anything());
  expect(onClose).toHaveBeenCalled();
});

test('deleting parts asks for confirmation first', async () => {
  fixture.patternParts = [pp('H', 'Head', 1, 0)];
  renderWithProviders(<UpdateFromPattern project={project([
    part('a', 'Head', 0, 'H'), part('h', 'Hat', 1, null, { from_pattern: true }),
  ])} onClose={() => {}} />);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Hat is no longer in the pattern — delete it' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(apply).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Delete 1 part?' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(apply).toHaveBeenCalledWith({ projectId: 'pr1', changes: [{ kind: 'delete', part_id: 'h' }] }, expect.anything());
});

test('says when there is nothing to update', () => {
  fixture.patternParts = [pp('H', 'Head', 1, 0)];
  renderWithProviders(<UpdateFromPattern project={project([part('a', 'Head', 0, 'H')])} onClose={() => {}} />);
  expect(screen.getByText('Nothing to update.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
});
