import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState, LoadingState, StatePanel } from '../components/StatePanel';
import { useSession } from '../context/SessionContext';
import { authService } from '../services/authService';
import { toUserMessage } from '../utils/errors';

type RedeemStatus = 'redeeming' | 'accepted' | 'refused';

/**
 * Exchanges an invitation link for a contributor session.
 *
 * The token is taken from the URL and posted to the Worker, which is the only
 * thing that can decide whether it is genuine.
 */
export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { setSession } = useSession();
  const [status, setStatus] = useState<RedeemStatus>('redeeming');
  const [message, setMessage] = useState<string | null>(null);
  // React runs effects twice in development; the invitation is only redeemed once.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (token === undefined || token.trim() === '') {
      setMessage('That invitation link is not complete.');
      setStatus('refused');
      return;
    }

    authService
      .redeemInvite(token)
      .then((session) => {
        setSession(session);
        setStatus('accepted');
      })
      .catch((cause: unknown) => {
        setMessage(toUserMessage(cause, 'That invitation link could not be accepted.'));
        setStatus('refused');
      });
  }, [token, setSession]);

  return (
    <div className="container container--reading">
      <header className="page-header">
        <h1>Your invitation</h1>
      </header>

      {status === 'redeeming' ? <LoadingState label="Checking your invitation…" /> : null}

      {status === 'refused' ? (
        <ErrorState message={message ?? 'That invitation link could not be accepted.'} />
      ) : null}

      {status === 'accepted' ? (
        <StatePanel title="Thank you — your invitation has been accepted">
          <p>
            You can now <Link to="/add-memory">add a memory</Link> or{' '}
            <Link to="/upload-photos">upload photographs</Link>. Everything shared is checked before
            it appears on the site.
          </p>
          <p>This browser will remember you, so you only need to do this once.</p>
        </StatePanel>
      ) : null}
    </div>
  );
}
