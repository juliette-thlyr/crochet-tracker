import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/render';
import Layout from './Layout';

vi.mock('../features/timer/TimerBar', () => ({ default: () => null }));

test('shows the logo and app name at the top of every page', () => {
  renderWithProviders(<Layout />, { route: '/projects', path: '/projects' });
  const banner = screen.getByRole('banner');
  expect(banner).toHaveTextContent('Crochet Tracker');
  expect(banner.querySelector('img[src="/icons/icon.svg"]')).not.toBeNull();
});
