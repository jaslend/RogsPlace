import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/apiClient';
import { SessionProvider } from '../context/SessionContext';
import type { Session } from '../models/Session';
import { InvitePage } from './InvitePage';

const redeemInvite = vi.fn<(token: string) => Promise<Session>>();

vi.mock('../services/authService', () => ({
  authService: {
    getSession: () => Promise.resolve({ role: 'visitor' }),
    redeemInvite: (token: string) => redeemInvite(token),
    logout: () => Promise.resolve({ role: 'visitor' }),
  },
}));

function renderInvite(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <Routes>
          <Route path="/invite/:token" element={<InvitePage />} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  redeemInvite.mockReset();
  redeemInvite.mockResolvedValue({ role: 'contributor' });
});

describe('InvitePage', () => {
  it('sends the token from the link to the server', async () => {
    renderInvite('/invite/a-family-invitation-token');

    expect(await screen.findByText(/your invitation has been accepted/i)).toBeInTheDocument();
    expect(redeemInvite).toHaveBeenCalledWith('a-family-invitation-token');
  });

  it('redeems only once, even though effects run twice in development', async () => {
    renderInvite('/invite/a-family-invitation-token');

    await screen.findByText(/your invitation has been accepted/i);
    expect(redeemInvite).toHaveBeenCalledTimes(1);
  });

  it('points an accepted contributor at what they can now do', async () => {
    renderInvite('/invite/a-family-invitation-token');

    expect(await screen.findByRole('link', { name: 'add a memory' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'upload photographs' })).toBeInTheDocument();
  });

  it('explains a refused invitation in the server’s words', async () => {
    redeemInvite.mockRejectedValue(new ApiError('That invitation link is not valid.', 401));

    renderInvite('/invite/an-old-token');

    expect(await screen.findByText('That invitation link is not valid.')).toBeInTheDocument();
  });

  it('does not leak an unexpected failure to the visitor', async () => {
    redeemInvite.mockRejectedValue(new Error('TypeError: undefined is not a function'));

    renderInvite('/invite/a-family-invitation-token');

    const message = await screen.findByText(/could not be accepted/i);
    expect(message).toBeInTheDocument();
    expect(screen.queryByText(/undefined is not a function/)).not.toBeInTheDocument();
  });
});
