import { resolveAssetUrl } from '../config/appConfig';
import type { Photo } from '../models/Photo';
import styles from './PhotoCard.module.css';

interface PhotoCardProps {
  photo: Photo;
  onSelect: (photo: Photo) => void;
}

/**
 * A single gallery thumbnail. Only the thumbnail is requested here, and only
 * when it scrolls into view: the full-size image is fetched when the visitor
 * opens the photograph.
 */
export function PhotoCard({ photo, onSelect }: PhotoCardProps) {
  const description = photo.caption ?? 'Photograph';

  return (
    <button type="button" className={styles.trigger} onClick={() => onSelect(photo)}>
      <span className={styles.imageFrame}>
        <img
          className={styles.image}
          src={resolveAssetUrl(photo.thumbnailUrl)}
          alt={description}
          loading="lazy"
          decoding="async"
        />
      </span>
      <span className={styles.caption}>
        {photo.caption ?? 'View photograph'}
        <span className="visually-hidden"> — opens a larger view</span>
      </span>
    </button>
  );
}
