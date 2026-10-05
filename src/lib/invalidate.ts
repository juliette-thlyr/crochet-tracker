import { useQueryClient } from '@tanstack/react-query';

/** Every cached feature root. Data is linked across features, so any change refreshes them all. */
const ROOT_KEYS = ['projects', 'parts', 'timer', 'yarns', 'patterns', 'pattern-types'] as const;

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => Promise.all(ROOT_KEYS.map((k) => qc.invalidateQueries({ queryKey: [k] })));
}
