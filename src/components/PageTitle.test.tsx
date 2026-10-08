import { render, screen } from '@testing-library/react';
import PageTitle from './PageTitle';

test('page title shows the logo before the title, in the page colour', () => {
  render(<PageTitle color="text-stash">Stash</PageTitle>);
  const title = screen.getByRole('heading', { name: 'Stash' });
  expect(title).toHaveClass('text-stash');
  expect(title.firstElementChild).toHaveAttribute('src', '/icons/icon.svg');
});
