import { apiClient } from '../api/apiClient';
import { appConfig } from '../config/appConfig';
import siteData from '../data/site.json';
import type { SiteConfig } from '../models/SiteConfig';
import { delay } from '../utils/delay';

export interface SiteService {
  getSiteConfig(): Promise<SiteConfig>;
}

function createMockSiteService(): SiteService {
  return {
    async getSiteConfig() {
      await delay(120);
      return siteData as SiteConfig;
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
