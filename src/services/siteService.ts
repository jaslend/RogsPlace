import { apiClient } from '../api/apiClient';
import { appConfig, siteContentOverrides } from '../config/appConfig';
import siteData from '../data/site.json';
import type { SiteConfig } from '../models/SiteConfig';
import { delay } from '../utils/delay';

export interface SiteService {
  getSiteConfig(): Promise<SiteConfig>;
}

/**
 * Serves the placeholder content from src/data/site.json, with any details
 * supplied at build time layered on top. See `siteContentOverrides`.
 *
 * Once VITE_API_URL is set the Worker owns this content and the overrides no
 * longer apply: /api/config is then the single source of truth.
 */
function createMockSiteService(): SiteService {
  return {
    async getSiteConfig() {
      await delay(120);
      return { ...(siteData as SiteConfig), ...siteContentOverrides };
    },
  };
}

function createHttpSiteService(): SiteService {
  return {
    getSiteConfig() {
      return apiClient.get<SiteConfig>('/api/config');
    },
  };
}

/** Mock while no API is configured; a plain HTTP client once VITE_API_URL is set. */
export const siteService: SiteService = appConfig.useMockData
  ? createMockSiteService()
  : createHttpSiteService();
