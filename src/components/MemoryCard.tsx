import { resolveAssetUrl } from '../config/appConfig';
import type { Memory } from '../models/Memory';
import type { Photo } from '../models/Photo';
import { formatDateTime } from '../utils/formatDate';
import styles from './MemoryCard.module.css';

interface MemoryCardProps {
  memory: Memory;
  /** The photograph referenced by `memory.photoId`, when the page has it. */
  photo?: Photo | undefined;
}

export function MemoryCard({ memory, photo }: MemoryCardProps) {
  const formattedDate = formatDateTime(memory.created);

  return (
    <article className={`card ${styles.card}`}>
      <div className={styles.meta}>
        <h3 className={styles.name}>{memory.name}</h3>
        {formattedDate ? (
          <time className={styles.date} dateTime={memory.created}>
            {formattedDate}
          </time>
        ) : null}
      </div>

      <p className={styles.message}>{memory.message}</p>

      {photo ? (
        <figure className={styles.photo}>
          <img
            src={resolveAssetUrl(photo.thumbnailUrl)}
            alt={photo.caption ?? `A photograph shared with ${memory.name}'s memory`}
            loading="lazy"
            decoding="async"
          />
          {photo.caption ? (
            <figcaption className={styles.photoCaption}>{photo.caption}</figcaption>
          ) : null}
        </figure>
      ) : null}
    </article>
  );
}
