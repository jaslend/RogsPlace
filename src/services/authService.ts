import { apiClient } from '../api/apiClient';
import { appConfig } from '../config/appConfig';
import type { Session } from '../models/Session';
import { delay } from '../utils/delay';

export interface AuthService {
  /** The current role, as the server sees it. */
  getSession(): Promise<Session>;
  /** Exchanges an invitation token for a contributor session. */
  redeemInvite(token: string): Promise<Session>;
  logout(): Promise<Session>;
}

/**
 * Used while no backend is configured.
 *
 * Everyone is treated as a contributor, because there is nothing to protect:
 * the mock services keep submissions in the browser and discard them on reload,
 * and the forms say so. Gating them would only make the demonstration site
 * useless without making anything safer.
 */
function createMockAuthService(): AuthService {
  return {
    async getSession() {
      await delay(80);
      return { role: 'contributor' };
    },
    async redeemInvite() {
      await delay(200);
      return { role: 'contributor' };
    },
    async logout() {
      await delay(80);
      return { role: 'visitor' };
    },
  };
}

function createHttpAuthService(): AuthService {
  return {
    getSession() {
      return apiClient.get<Session>('/api/auth/session');
    },
    redeemInvite(token: string) {
      // The token travels in the body rather than the URL so that it does not
      // end up in server logs or a Referer header.
      return apiClient.post<Session>('/api/auth/invite', { token });
    },
    logout() {
      return apiClient.post<Session>('/api/auth/logout', {});
    },
  };
}

export const authService: AuthService = appConfig.useMockData
  ? createMockAuthService()
  : createHttpAuthService();
