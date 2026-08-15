import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { Memory } from './models/Memory';
import type { Photo } from './models/Photo';
import type { SiteConfig } from './models/SiteConfig';

/**
 * These are routing and rendering smoke tests, so the services return fixed
 * content rather than whatever happens to be in src/data. The real memorial
 * details are supplied at build time and the demonstration data is meant to be
 * deleted; neither should be able to turn CI red.
 */
const siteConfig: SiteConfig = {
  title: 'In Loving Memory',
  name: 'Test Person',
  dateOfBirth: '',
  dateOfDeath: '',
  welcomeText: 'A place to remember and share memories.',
  mainPhoto: '',
};

const memories: Memory[] = [
  { id: 'newer', name: 'Second Contributor', message: 'The newer memory.', created: '2026-06-01T00:00:00.000Z' },
  { id: 'older', name: 'First Contributor', message: 'The older memory.', created: '2026-01-01T00:00:00.000Z' },
];

const photos: Photo[] = [
  {
    id: 'photo-1',
    url: 'placeholders/photo-1.svg',
    thumbnailUrl: 'placeholders/photo-1.svg',
    caption: 'A test photograph',
  },
];

vi.mock('./services/siteService', () => ({
  siteService: { getSiteConfig: () => Promise.resolve(siteConfig) },
}));

vi.mock('./services/memoryService', () => ({
  memoryService: {
    getMemories: () => Promise.resolve(memories),
    addMemory: () => Promise.reject(new Error('not used in these tests')),
  },
}));

vi.mock('./services/photoService', () => ({
  photoService: {
    getPhotos: () => Promise.resolve(photos),
    uploadPhotos: () => Promise.reject(new Error('not used in these tests')),
  },
}));

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

    expect(await screen.findByRole('heading', { level: 1, name: 'Test Person' })).toBeInTheDocument();
    expect(screen.getByText('A place to remember and share memories.')).toBeInTheDocument();
  });

  it('moves between pages using the navigation', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('link', { name: 'Memories' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Memories' })).toBeInTheDocument();
  });

  it('shows the memories, newest first', async () => {
    renderApp('/memories');

    const rendered = await screen.findAllByRole('article');
    expect(rendered).toHaveLength(2);
    expect(rendered[0]).toHaveTextContent('The newer memory.');
    expect(rendered[1]).toHaveTextContent('The older memory.');
  });

  it('shows the photograph gallery', async () => {
    renderApp('/photos');

    expect(await screen.findByRole('button', { name: /A test photograph/ })).toBeInTheDocument();
  });

  it('shows a friendly page for an unknown route', async () => {
    renderApp('/no-such-page');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});
