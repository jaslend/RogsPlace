import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '../context/SessionContext';
import type { Session } from '../models/Session';
import { RequireRole } from './RequireRole';

const getSession = vi.fn<() => Promise<Session>>();

vi.mock('../services/authService', () => ({
  authService: {
    getSession: () => getSession(),
    redeemInvite: () => Promise.resolve({ role: 'contributor' }),
    logout: () => Promise.resolve({ role: 'visitor' }),
  },
}));

function renderGuarded() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <RequireRole action="add a memory">
          <p>The form</p>
        </RequireRole>
      </SessionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getSession.mockReset();
});

describe('RequireRole', () => {
  it('shows the form to a contributor', async () => {
    getSession.mockResolvedValue({ role: 'contributor' });

    renderGuarded();

    expect(await screen.findByText('The form')).toBeInTheDocument();
  });

  it('shows the form to an administrator', async () => {
    getSession.mockResolvedValue({ role: 'administrator' });

    renderGuarded();

    expect(await screen.findByText('The form')).toBeInTheDocument();
  });

  it('explains the invitation to a visitor instead of showing the form', async () => {
    getSession.mockResolvedValue({ role: 'visitor' });

    renderGuarded();

    expect(await screen.findByText(/You need an invitation to do this/i)).toBeInTheDocument();
    expect(screen.queryByText('The form')).not.toBeInTheDocument();
  });

  it('names the action the visitor was trying to take', async () => {
    getSession.mockResolvedValue({ role: 'visitor' });

    renderGuarded();

    expect(await screen.findByText(/can add a memory/i)).toBeInTheDocument();
  });

  it('offers a visitor what they can still do', async () => {
    getSession.mockResolvedValue({ role: 'visitor' });

    renderGuarded();

    expect(await screen.findByRole('link', { name: 'read the memories' })).toBeInTheDocument();
  });

  it('shows nothing contributor-only while the role is still unknown', async () => {
    // A promise that never settles: the loading state must not leak the form.
    getSession.mockReturnValue(new Promise<Session>(() => {}));

    renderGuarded();

    expect(screen.queryByText('The form')).not.toBeInTheDocument();
    expect(screen.getByText(/Checking your invitation/i)).toBeInTheDocument();
  });

  it('treats a failed session lookup as a visitor rather than letting them through', async () => {
    getSession.mockRejectedValue(new Error('the network is down'));

    renderGuarded();

    // Failing closed: if we cannot establish a role, offer nothing.
    expect(await screen.findByText(/You need an invitation to do this/i)).toBeInTheDocument();
    expect(screen.queryByText('The form')).not.toBeInTheDocument();
  });
});
