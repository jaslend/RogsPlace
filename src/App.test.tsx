import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('shows the memorial on the home page', async () => {
    renderApp();

    expect(await screen.findByRole('heading', { level: 1, name: 'Roger' })).toBeInTheDocument();
    expect(screen.getByText(/A place to remember Roger/)).toBeInTheDocument();
  });

  it('moves between pages using the navigation', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('link', { name: 'Memories' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Memories' })).toBeInTheDocument();
  });

  it('shows the demonstration memories, newest first', async () => {
    renderApp('/memories');

    const memories = await screen.findAllByRole('article');
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0]).toHaveTextContent('A third example memory');
  });

  it('shows the photograph gallery', async () => {
    renderApp('/photos');

    expect(
      await screen.findByRole('button', { name: /Placeholder photograph one/ }),
    ).toBeInTheDocument();
  });

  it('shows a friendly page for an unknown route', async () => {
    renderApp('/no-such-page');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});
