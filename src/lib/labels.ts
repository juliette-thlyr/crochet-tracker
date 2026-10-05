import type { Database } from './database.types';

export type YarnWeight = Database['public']['Enums']['yarn_weight'];
export type ProjectStatus = Database['public']['Enums']['project_status'];

export const WEIGHTS: { value: YarnWeight; label: string }[] = [
  { value: 'lace', label: 'Lace' },
  { value: 'fingering', label: 'Fingering' },
  { value: 'sport', label: 'Sport' },
  { value: 'dk', label: 'DK' },
  { value: 'worsted', label: 'Worsted' },
  { value: 'aran', label: 'Aran' },
  { value: 'bulky', label: 'Bulky' },
  { value: 'super_bulky', label: 'Super bulky' },
  { value: 'jumbo', label: 'Jumbo' },
];

export function weightLabel(w: YarnWeight | null): string {
  return WEIGHTS.find((x) => x.value === w)?.label ?? '';
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  idea: 'Ideas',
  in_progress: 'In progress',
  finished: 'Finished',
  frogged: 'Frogged',
};
