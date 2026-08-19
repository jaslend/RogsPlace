import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/apiClient';
import { SiteConfigProvider } from '../context/SiteConfigContext';
import type { IssuedInvite, ModerationQueue } from '../models/Moderation';
import type { SiteConfig } from '../models/SiteConfig';
import { AdminPage } from './AdminPage';

const getQueue = vi.fn<() => Promise<ModerationQueue>>();
const approveMemory = vi.fn<(id: string) => Promise<void>>();
const removeMemory = vi.fn<(id: string) => Promise<void>>();
const saveSiteConfig = vi.fn<(config: SiteConfig) => Promise<SiteConfig>>();
const rotateInvite = vi.fn<() => Promise<IssuedInvite>>();

vi.mock('../services/adminService', () => ({
  adminService: {
    getQueue: () => getQueue(),
    approveMemory: (id: string) => approveMemory(id),
    removeMemory: (id: string) => removeMemory(id),
    approvePhoto: vi.fn(),
    removePhoto: vi.fn(),
    saveSiteConfig: (config: SiteConfig) => saveSiteConfig(config),
    rotateInvite: () => rotateInvite(),
  },
}));

const siteConfig: SiteConfig = {
  title: 'In Loving Memory',
  name: 'Test Person',
  dateOfBirth: '',
  dateOfDeath: '',
  welcomeText: 'A place to remember.',
  mainPhoto: '',
};

vi.mock('../services/siteService', () => ({
  siteService: { getSiteConfig: () => Promise.resolve(siteConfig) },
}));

const waitingMemory = {
  id: 'memory-waiting',
  name: 'Alex',
  message: 'A memory awaiting approval.',
  created: '2026-08-18T09:30:00.000Z',
};

function renderAdmin() {
  return render(
    <MemoryRouter>
      <SiteConfigProvider>
        <AdminPage />
      </SiteConfigProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getQueue.mockResolvedValue({ memories: [waitingMemory], photos: [] });
  approveMemory.mockResolvedValue(undefined);
  removeMemory.mockResolvedValue(undefined);
  saveSiteConfig.mockImplementation((config) => Promise.resolve(config));
  rotateInvite.mockResolvedValue({ token: 'a-new-invitation-token', version: 2 });
});

describe('the moderation queue', () => {
  it('shows what is waiting', async () => {
    renderAdmin();

    expect(await screen.findByText('A memory awaiting approval.')).toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('publishes a memory and reloads', async () => {
    const user = userEvent.setup();
    renderAdmin();

    await user.click(await screen.findByRole('button', { name: 'Publish this memory' }));

    expect(approveMemory).toHaveBeenCalledWith('memory-waiting');
    await waitFor(() => expect(getQueue).toHaveBeenCalledTimes(2));
  });

  it('deletes a memory when asked', async () => {
    const user = userEvent.setup();
    renderAdmin();

    await user.click(await screen.findByRole('button', { name: /Delete permanently/ }));

    expect(removeMemory).toHaveBeenCalledWith('memory-waiting');
  });

  it('says so when nothing is waiting', async () => {
    getQueue.mockResolvedValue({ memories: [], photos: [] });

    renderAdmin();

    expect(await screen.findByText('Nothing is waiting')).toBeInTheDocument();
  });

  it('reports a failure without losing the queue', async () => {
    approveMemory.mockRejectedValue(new ApiError('That could not be saved.', 500));
    const user = userEvent.setup();
    renderAdmin();

    await user.click(await screen.findByRole('button', { name: 'Publish this memory' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That could not be saved.');
    expect(screen.getByText('A memory awaiting approval.')).toBeInTheDocument();
  });
});

describe('the memorial details', () => {
  it('loads the current details into the form', async () => {
    renderAdmin();

    expect(await screen.findByLabelText('Name')).toHaveValue('Test Person');
  });

  it('saves an edit', async () => {
    const user = userEvent.setup();
    renderAdmin();

    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Someone Else');
    await user.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() =>
      expect(saveSiteConfig).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Someone Else' }),
      ),
    );
  });

  it('keeps a date blank rather than inventing one', async () => {
    const user = userEvent.setup();
    renderAdmin();

    await screen.findByLabelText('Name');
    await user.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() =>
      expect(saveSiteConfig).toHaveBeenCalledWith(
        expect.objectContaining({ dateOfBirth: '', dateOfDeath: '' }),
      ),
    );
  });
});

describe('the family invitation', () => {
  it('warns that a new link signs everyone out before it is used', async () => {
    renderAdmin();

    expect(
      await screen.findByText(/signs out everybody using the old link/i),
    ).toBeInTheDocument();
  });

  it('shows the new link once, as a full invitation URL', async () => {
    const user = userEvent.setup();
    renderAdmin();

    await user.click(screen.getByRole('button', { name: 'Create a new invitation link' }));

    const shown = await screen.findByText(/\/invite\/a-new-invitation-token$/);
    expect(shown).toBeInTheDocument();
    expect(screen.getByText(/cannot be shown again/i)).toBeInTheDocument();
  });

  it('explains a failure rather than pretending it worked', async () => {
    rotateInvite.mockRejectedValue(new Error('the network is down'));
    const user = userEvent.setup();
    renderAdmin();

    await user.click(screen.getByRole('button', { name: 'Create a new invitation link' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not be created/i);
    expect(alert).not.toHaveTextContent('the network is down');
  });
});
