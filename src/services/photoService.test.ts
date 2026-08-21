import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreparedPhoto } from '../utils/preparePhoto';

const apiRequest = vi.fn();
const preparePhoto = vi.fn();

vi.mock('../api/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  ApiError: class ApiError extends Error {},
}));

vi.mock('../utils/preparePhoto', () => ({
  preparePhoto: (file: File) => preparePhoto(file),
  PhotoPreparationError: class PhotoPreparationError extends Error {},
}));

const { createHttpPhotoService } = await import('./photoService');

function prepared(imageBytes = 400_000, thumbnailBytes = 20_000): PreparedPhoto {
  return {
    image: new Blob([new Uint8Array(imageBytes)], { type: 'image/jpeg' }),
    thumbnail: new Blob([new Uint8Array(thumbnailBytes)], { type: 'image/jpeg' }),
    width: 2560,
    height: 1920,
  };
}

/** A file far larger than anything that should reach the network. */
function chosenFile(name = 'holiday.jpg'): File {
  return new File([new Uint8Array(8 * 1024 * 1024)], name, { type: 'image/jpeg' });
}

beforeEach(() => {
  apiRequest.mockResolvedValue({ uploadedCount: 1 });
  preparePhoto.mockResolvedValue(prepared());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('uploading photographs', () => {
  it('sends the downscaled photograph rather than the file that was chosen', async () => {
    const file = chosenFile();

    await createHttpPhotoService().uploadPhotos([file]);

    expect(preparePhoto).toHaveBeenCalledWith(file);

    const body = apiRequest.mock.calls[0][1].body as FormData;
    const sent = body.get('photo') as File;
    expect(sent.size).toBe(400_000);
    expect(sent.size).toBeLessThan(file.size);
  });

  it('sends the thumbnail alongside it, so the gallery need not load full photographs', async () => {
    await createHttpPhotoService().uploadPhotos([chosenFile()]);

    const body = apiRequest.mock.calls[0][1].body as FormData;
    expect((body.get('thumbnail') as File).size).toBe(20_000);
  });

  it('does not pass on the name of the file that was chosen', async () => {
    await createHttpPhotoService().uploadPhotos([chosenFile('../../configuration/site.json')]);

    const body = apiRequest.mock.calls[0][1].body as FormData;
    expect((body.get('photo') as File).name).toBe('photo.jpg');
  });

  it('sends one request per photograph and reports progress as it goes', async () => {
    const onProgress = vi.fn();

    const result = await createHttpPhotoService().uploadPhotos(
      [chosenFile('one.jpg'), chosenFile('two.jpg')],
      onProgress,
    );

    expect(apiRequest).toHaveBeenCalledTimes(2);
    expect(result.uploadedCount).toBe(2);
    expect(onProgress.mock.calls.map(([percent]) => percent)).toEqual([0, 50, 100]);
  });

  it('does not upload a photograph that could not be prepared', async () => {
    preparePhoto.mockRejectedValue(new Error('not an image'));

    await expect(createHttpPhotoService().uploadPhotos([chosenFile()])).rejects.toThrow();
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
