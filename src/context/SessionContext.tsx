import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useAsyncData, type AsyncStatus } from '../hooks/useAsyncData';
import type { Role, Session } from '../models/Session';
import { authService } from '../services/authService';

interface SessionContextValue {
  role: Role;
  status: AsyncStatus;
  /** Records a role the application has just been told about, e.g. after redeeming an invite. */
  setSession: (session: Session) => void;
  reload: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Loads the current role once and shares it.
 *
 * Nothing here is a security control: it decides what the interface offers, and
 * the Worker decides what is permitted. A visitor who edits this value in their
 * browser gains nothing but a form that fails on submission.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<Session | null>(null);
  const { data, status, reload } = useAsyncData<Session>(() => authService.getSession());

  const setSession = useCallback((session: Session) => setOverride(session), []);

  const value = useMemo<SessionContextValue>(
    () => ({
      // Until the request finishes, assume the least: no contributor-only UI
      // appears and then disappears.
      role: override?.role ?? data?.role ?? 'visitor',
      status,
      setSession,
      reload,
    }),
    [override, data, status, setSession, reload],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession must be used inside a SessionProvider.');
  }
  return value;
}
