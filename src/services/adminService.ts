import { apiClient } from '../api/apiClient';
import { appConfig } from '../config/appConfig';
import type { IssuedInvite, ModerationQueue } from '../models/Moderation';
import type { SiteConfig } from '../models/SiteConfig';
import { delay } from '../utils/delay';

export interface AdminService {
  getQueue(): Promise<ModerationQueue>;
  approveMemory(id: string): Promise<void>;
  removeMemory(id: string): Promise<void>;
  approvePhoto(id: string): Promise<void>;
  removePhoto(id: string): Promise<void>;
  saveSiteConfig(config: SiteConfig): Promise<SiteConfig>;
  rotateInvite(): Promise<IssuedInvite>;
}

/**
 * Used while no backend is configured, so the administration screens can be
 * built and looked at without one. Nothing here persists.
 */
function createMockAdminService(): AdminService {
  let queue: ModerationQueue = {
    memories: [
      {
        id: 'demo-pending-1',
        name: 'Demo Contributor',
        message: 'An example submission, shown so that the moderation queue can be reviewed.',
        created: '2026-08-18T09:30:00.000Z',
      },
    ],
    photos: [],
  };

  return {
    async getQueue() {
      await delay(200);
      return { memories: [...queue.memories], photos: [...queue.photos] };
    },
    async approveMemory(id) {
      await delay(200);
      queue = { ...queue, memories: queue.memories.filter((memory) => memory.id !== id) };
    },
    async removeMemory(id) {
      await delay(200);
      queue = { ...queue, memories: queue.memories.filter((memory) => memory.id !== id) };
    },
    async approvePhoto(id) {
      await delay(200);
      queue = { ...queue, photos: queue.photos.filter((photo) => photo.id !== id) };
    },
    async removePhoto(id) {
      await delay(200);
      queue = { ...queue, photos: queue.photos.filter((photo) => photo.id !== id) };
    },
    async saveSiteConfig(config) {
      await delay(300);
      return config;
    },
    async rotateInvite() {
      await delay(300);
      return { token: 'example-invitation-token-not-a-real-one', version: 1 };
    },
  };
}

function createHttpAdminService(): AdminService {
  return {
    getQueue() {
      return apiClient.get<ModerationQueue>('/api/admin/queue');
    },
    async approveMemory(id) {
      await apiClient.post(`/api/admin/memories/${encodeURIComponent(id)}/approve`, {});
    },
    async removeMemory(id) {
      await apiClient.post(`/api/admin/memories/${encodeURIComponent(id)}/remove`, {});
    },
    async approvePhoto(id) {
      await apiClient.post(`/api/admin/photos/${encodeURIComponent(id)}/approve`, {});
    },
    async removePhoto(id) {
      await apiClient.post(`/api/admin/photos/${encodeURIComponent(id)}/remove`, {});
    },
    saveSiteConfig(config) {
      return apiClient.put<SiteConfig>('/api/config', config);
    },
    rotateInvite() {
      return apiClient.post<IssuedInvite>('/api/admin/invite/rotate', {});
    },
  };
}

export const adminService: AdminService = appConfig.useMockData
  ? createMockAdminService()
  : createHttpAdminService();
