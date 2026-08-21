import { photoProcessing, uploadLimits } from '../config/limits';

const { maxImageEdge, maxThumbnailEdge, imageQualities, thumbnailQuality } = photoProcessing;

/** What the Worker is sent for one photograph. */
export interface PreparedPhoto {
  /** The downscaled, re-encoded photograph. Always JPEG, always EXIF-free. */
  image: Blob;
  /** A small version of the same picture, for the gallery grid. */
  thumbnail: Blob;
  width: number;
  height: number;
}

/**
 * A photograph that could not be prepared, carrying a message fit to show.
 *
 * Preparation failing means the file could not be decoded as an image, which is
 * a reason to refuse it rather than to send the original: the original is the
 * thing that carries the location data and blows the Worker's CPU budget.
 */
export class PhotoPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoPreparationError';
  }
}

/**
 * Anything that can be handed to drawImage. An ImageBitmap where the browser
 * offers one, because decoding off the main thread keeps the page responsive
 * while ten photographs are processed; an <img> otherwise.
 */
type DecodedImage = { source: CanvasImageSource; width: number; height: number; release(): void };

async function decode(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    // "from-image" applies the EXIF orientation to the pixels. Without it, a
    // photograph taken in portrait would be stored on its side: the orientation
    // tag says to rotate it, and stripping the metadata takes that instruction
    // away along with the location data.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(url);
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (cause) {
    URL.revokeObjectURL(url);
    throw cause;
  }
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new PhotoPreparationError('That image could not be read.'));
    image.src = url;
  });
}

/** Scales the long edge down to fit, never up: a small photograph is left alone. */
function scaleToFit(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function drawScaled(image: DecodedImage, maxEdge: number): HTMLCanvasElement {
  const { width, height } = scaleToFit(image.width, image.height, maxEdge);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (context === null) {
    throw new PhotoPreparationError('This browser could not process that photograph.');
  }

  // A photograph with transparency becomes JPEG, which has none. Filling first
  // means those areas come out white rather than black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image.source, 0, 0, width, height);

  return canvas;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new PhotoPreparationError('That photograph could not be prepared for upload.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Reduces a chosen photograph to something worth uploading.
 *
 * Two things come out of the one decode: a capped-size JPEG and its thumbnail.
 * Doing it here rather than in the Worker is what keeps the deployment on the
 * free plan -- the Worker never sees the 20MB original, so it never has to spend
 * its CPU budget on one -- and the re-encode strips the EXIF block on the way.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const decoded = await decode(file);

  try {
    const canvas = drawScaled(decoded, maxImageEdge);

    let image: Blob | null = null;
    for (const quality of imageQualities) {
      image = await toJpeg(canvas, quality);
      if (image.size <= uploadLimits.maxUploadBytes) break;
    }

    // Only reachable for an image that stays enormous at the lowest quality on
    // the ladder. Refusing is better than a request the Worker will reject.
    if (image === null || image.size > uploadLimits.maxUploadBytes) {
      throw new PhotoPreparationError(
        'That photograph could not be reduced to a size that can be uploaded.',
      );
    }

    const thumbnail = await toJpeg(drawScaled(decoded, maxThumbnailEdge), thumbnailQuality);

    return { image, thumbnail, width: canvas.width, height: canvas.height };
  } finally {
    decoded.release();
  }
}
