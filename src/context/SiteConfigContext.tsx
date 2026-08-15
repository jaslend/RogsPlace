import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAsyncData, type AsyncStatus } from '../hooks/useAsyncData';
import type { SiteConfig } from '../models/SiteConfig';
import { siteService } from '../services/siteService';

interface SiteConfigContextValue {
  siteConfig: SiteConfig | null;
  status: AsyncStatus;
  error: string | null;
  reload: () => void;
}

const SiteConfigContext = createContext<SiteConfigContextValue | null>(null);

/**
 * Loads the memorial's content once and shares it with the header, footer and
 * home page. React context is enough here; there is no need for a state
 * management library.
 */
export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const { data, status, error, reload } = useAsyncData<SiteConfig>(
    () => siteService.getSiteConfig(),
    'The memorial details could not be loaded.',
  );

  const value = useMemo<SiteConfigContextValue>(
    () => ({ siteConfig: data, status, error, reload }),
    [data, status, error, reload],
  );

  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig(): SiteConfigContextValue {
  const value = useContext(SiteConfigContext);
  if (value === null) {
    throw new Error('useSiteConfig must be used inside a SiteConfigProvider.');
  }
  return value;
}
