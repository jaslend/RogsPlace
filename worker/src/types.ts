import type { Memory } from '../../src/models/Memory';
import type { Photo } from '../../src/models/Photo';
import type { SiteConfig } from '../../src/models/SiteConfig';

// The browser and the Worker share one definition of every public shape, so the
// two cannot drift apart.
export type { Memory, Photo, SiteConfig };

/**
 * Where an item sits in moderation. Nothing reaches the public endpoints until
 * an administrator has moved it to 'published'.
 */
export type ModerationStatus = 'pending' | 'published' | 'rejected';

/**
 * What is stored for a photograph, in metadata/photos/<id>.json.
 *
 * No URL is stored: URLs are composed from the origin of the incoming request,
 * so moving the site to another domain does not require rewriting stored data.
 */
export interface StoredPhoto {
  id: string;
  caption?: string;
  uploadedBy?: string;
  uploaded?: string;
  status: ModerationStatus;
  /** Extension of the stored original, e.g. "jpg". Derived by the Worker. */
  originalExtension: string;
  /** Content type established by sniffing the file, not by trusting the client. */
  contentType: string;
}

/** An entry in index/photos.json: everything needed to render the gallery. */
export type PhotoIndexEntry = Pick<StoredPhoto, 'id' | 'caption' | 'uploadedBy' | 'uploaded'>;
