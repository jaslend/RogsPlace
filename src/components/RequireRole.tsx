import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { mayContribute } from '../models/Session';
import { LoadingState, StatePanel } from './StatePanel';

interface RequireRoleProps {
  children: ReactNode;
  /** What the visitor is trying to do, e.g. "add a memory". */
  action: string;
  /** The least the caller must be. Defaults to a contributor. */
  requires?: 'contributor' | 'administrator';
}

/**
 * Shows an explanation instead of a form when the visitor is not entitled to
 * what they asked for.
 *
 * THIS IS NOT A SECURITY CONTROL. It exists so that someone without an
 * invitation is told why, rather than filling in a form and having it refused.
 * Anyone can bypass it from their browser's console; nothing is protected by
 * it. Every write endpoint in the Worker checks for itself, Cloudflare Access
 * guards the administrative routes at the edge, and those are the checks that
 * matter.
 */
export function RequireRole({ children, action, requires = 'contributor' }: RequireRoleProps) {
  const { role, status } = useSession();

  if (status === 'loading') {
    return <LoadingState label="Checking your invitation…" />;
  }

  const permitted =
    requires === 'administrator' ? role === 'administrator' : mayContribute(role);

  if (!permitted) {
    return requires === 'administrator' ? (
      <StatePanel title="This part of the site is not yours to see">
        <p>
          Only whoever looks after this memorial can {action}. If that should be you, you will need
          to sign in through the link you were given.
        </p>
        <p>
          You can still <Link to="/memories">read the memories</Link> and{' '}
          <Link to="/photos">look through the photographs</Link>.
        </p>
      </StatePanel>
    ) : (
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
