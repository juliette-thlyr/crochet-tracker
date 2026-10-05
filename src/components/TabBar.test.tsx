import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/render';
import TabBar from './TabBar';

test('highlights the section of the current page', () => {
  renderWithProviders(<TabBar />, { route: '/patterns/abc', path: '/patterns/:id' });
  const patterns = screen.getByRole('link', { name: 'Patterns' });
  expect(patterns).toHaveAttribute('aria-current', 'page');
  expect(patterns).toHaveClass('text-patterns');
  expect(screen.getByRole('link', { name: 'Projects' })).toHaveClass('text-muted');
});

test('part pages belong to Projects', () => {
  renderWithProviders(<TabBar />, { route: '/parts/xyz', path: '/parts/:id' });
  expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
});
