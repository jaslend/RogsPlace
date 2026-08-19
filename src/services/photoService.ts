import { apiRequest } from '../api/apiClient';
import { appConfig } from '../config/appConfig';
import photosData from '../data/photos.json';
import type { Photo, PhotoUploadResult } from '../models/Photo';
import { delay } from '../utils/delay';

/** Reports overall upload progress as a whole percentage, 0 to 100. */
export type UploadProgressHandler = (percentComplete: number) => void;

export interface PhotoService {
  getPhotos(): Promise<Photo[]>;
  uploadPhotos(files: File[], onProgress?: UploadProgressHandler): Promise<PhotoUploadResult>;
}

/** Newest first where an upload date is known; undated photographs keep their order. */
export function sortByNewestFirst(photos: readonly Photo[]): Photo[] {
  return [...photos].sort((a, b) => {
    const aTime = a.uploaded ? new Date(a.uploaded).getTime() : 0;
    const bTime = b.uploaded ? new Date(b.uploaded).getTime() : 0;
    return bTime - aTime;
  });
}

function createMockPhotoService(seed: readonly Photo[] = photosData): PhotoService {
  const photos = sortByNewestFirst(seed);

  return {
    async getPhotos() {
      await delay(200);
      return [...photos];
    },

    /**
     * Simulates an upload so the page can be built and reviewed before the
     * Worker and R2 bucket exist. Nothing leaves the browser.
     */
    async uploadPhotos(files: File[], onProgress?: UploadProgressHandler) {
      onProgress?.(0);
      for (let index = 0; index < files.length; index += 1) {
        await delay(350);
        onProgress?.(Math.round(((index + 1) / files.length) * 100));
      }
      return { uploadedCount: files.length };
    },
  };
}

function createHttpPhotoService(): PhotoService {
  return {
    async getPhotos() {
      const photos = await apiRequest<Photo[]>('/api/photos');
      return sortByNewestFirst(photos);
    },

    /**
     * Sends the photographs to the Worker, which generates the object ids and
     * storage keys. The browser's filenames are metadata only and are never
     * used as a storage key.
     *
     * One request per photograph: a Worker has far less memory than ten
     * twenty-megabyte files would need, and uploading them separately means one
     * failure does not lose the rest. It also gives honest per-file progress,
     * which a single multipart request could not.
     */
    async uploadPhotos(files: File[], onProgress?: UploadProgressHandler) {
      onProgress?.(0);
      let uploadedCount = 0;

      for (const [index, file] of files.entries()) {
        const formData = new FormData();
        formData.append('photo', file, file.name);

        await apiRequest<PhotoUploadResult>('/api/photos', {
          method: 'POST',
          body: formData,
        });

        uploadedCount += 1;
        onProgress?.(Math.round(((index + 1) / files.length) * 100));
      }

      return { uploadedCount };
    },
  };
}

export const photoService: PhotoService = appConfig.useMockData
  ? createMockPhotoService()
  : createHttpPhotoService();
