import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { photoProcessing, uploadLimits } from '../config/limits';
import { PhotoPreparationError, preparePhoto } from './preparePhoto';

/**
 * jsdom has no canvas, so the decode and encode steps are stubbed. What is being
 * tested is the arithmetic in between -- which dimensions are asked for, and how
 * the quality ladder responds to a blob that is too large -- rather than the
 * browser's image handling.
 */

/** Records what each canvas was asked to draw. */
let drawnSizes: Array<{ width: number; height: number }>;

/** Bytes the stubbed encoder claims to produce, in the order it is called. */
let encodedSizes: number[];
let encodeCalls: Array<{ type: string; quality: number }>;

function stubDecodeTo(width: number, height: number) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width, height, close: vi.fn() })),
  );
}

beforeEach(() => {
  drawnSizes = [];
  encodedSizes = [];
  encodeCalls = [];

  stubDecodeTo(4000, 3000);

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return {
      fillStyle: '',
      fillRect: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage: vi.fn(() => {
        drawnSizes.push({ width: this.width, height: this.height });
      }),
    } as unknown as CanvasRenderingContext2D;
  });

  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    callback: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    encodeCalls.push({ type: type ?? '', quality: quality ?? 0 });
    const size = encodedSizes.shift() ?? 100_000;
    callback(new Blob([new Uint8Array(size)], { type: 'image/jpeg' }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function chosenFile(): File {
  return new File([new Uint8Array(64)], 'holiday.jpg', { type: 'image/jpeg' });
}

describe('preparePhoto', () => {
  it('caps the long edge and keeps the shape of the picture', async () => {
    stubDecodeTo(4000, 3000);

    const prepared = await preparePhoto(chosenFile());

    expect(prepared.width).toBe(photoProcessing.maxImageEdge);
    expect(prepared.height).toBe(Math.round((photoProcessing.maxImageEdge * 3000) / 4000));
  });

  it('caps the long edge of a portrait photograph the same way', async () => {
    stubDecodeTo(3000, 4000);

    const prepared = await preparePhoto(chosenFile());

    expect(prepared.height).toBe(photoProcessing.maxImageEdge);
    expect(prepared.width).toBe(Math.round((photoProcessing.maxImageEdge * 3000) / 4000));
  });

  it('leaves a photograph smaller than the cap at its own size', async () => {
    stubDecodeTo(800, 600);

    const prepared = await preparePhoto(chosenFile());

    expect(prepared.width).toBe(800);
    expect(prepared.height).toBe(600);
  });

  it('applies the stored orientation before the metadata is discarded', async () => {
    await preparePhoto(chosenFile());

    // Without this a portrait photograph would be stored on its side: the
    // rotation lives in the EXIF block that re-encoding throws away.
    expect(createImageBitmap).toHaveBeenCalledWith(expect.anything(), {
      imageOrientation: 'from-image',
    });
  });

  it('produces a thumbnail as well, from the same decode', async () => {
    stubDecodeTo(4000, 3000);

    const prepared = await preparePhoto(chosenFile());

    expect(prepared.thumbnail.type).toBe('image/jpeg');
    // The last canvas drawn is the thumbnail's.
    expect(drawnSizes.at(-1)).toEqual({
      width: photoProcessing.maxThumbnailEdge,
      height: Math.round((photoProcessing.maxThumbnailEdge * 3000) / 4000),
    });
    expect(createImageBitmap).toHaveBeenCalledTimes(1);
  });

  it('always encodes as JPEG, which is what strips the metadata', async () => {
    await preparePhoto(chosenFile());

    expect(encodeCalls.every((call) => call.type === 'image/jpeg')).toBe(true);
  });

  it('settles for a lower quality rather than sending too large a body', async () => {
    encodedSizes = [uploadLimits.maxUploadBytes + 1, 500_000];

    const prepared = await preparePhoto(chosenFile());

    expect(prepared.image.size).toBe(500_000);
    expect(encodeCalls.slice(0, 2).map((call) => call.quality)).toEqual([
      photoProcessing.imageQualities[0],
      photoProcessing.imageQualities[1],
    ]);
  });

  it('stops at the first quality that fits', async () => {
    encodedSizes = [400_000];

    await preparePhoto(chosenFile());

    // One encode for the photograph, one for the thumbnail, and no retries.
    expect(encodeCalls).toHaveLength(2);
  });

  it('refuses a photograph that will not fit at any quality', async () => {
    encodedSizes = photoProcessing.imageQualities.map(() => uploadLimits.maxUploadBytes + 1);

    await expect(preparePhoto(chosenFile())).rejects.toBeInstanceOf(PhotoPreparationError);
  });

  it('releases the decoded image even when preparation fails', async () => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 4000, height: 3000, close })),
    );
    encodedSizes = photoProcessing.imageQualities.map(() => uploadLimits.maxUploadBytes + 1);

    await expect(preparePhoto(chosenFile())).rejects.toThrow();
    expect(close).toHaveBeenCalled();
  });
});
