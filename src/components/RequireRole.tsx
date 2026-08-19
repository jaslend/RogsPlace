import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { mayContribute } from '../models/Session';
import { LoadingState, StatePanel } from './StatePanel';

interface RequireRoleProps {
  children: ReactNode;
  /** What the visitor is trying to do, e.g. "add a memory". */
  action: string;
}

/**
 * Shows an explanation instead of a form when the visitor has no invitation.
 *
 * THIS IS NOT A SECURITY CONTROL. It exists so that someone without an
 * invitation is told why, rather than filling in a form and having it refused.
 * Anyone can bypass it from their browser's console; nothing is protected by
 * it. Every write endpoint in the Worker checks the session for itself, and
 * that check is the one that matters.
 */
export function RequireRole({ children, action }: RequireRoleProps) {
  const { role, status } = useSession();

  if (status === 'loading') {
    return <LoadingState label="Checking your invitation…" />;
  }

  if (!mayContribute(role)) {
    return (
      <StatePanel title="You need an invitation to do this">
        <p>
          Only people with the family invitation link can {action}. If someone shared a link with
          you, open it again to sign in; otherwise please ask whoever is looking after this
          memorial.
        </p>
        <p>
          You can still <Link to="/memories">read the memories</Link> and{' '}
          <Link to="/photos">look through the photographs</Link>.
        </p>
      </StatePanel>
    );
  }

  return <>{children}</>;
}
