import { useEffect, useId, useRef } from 'react';
import { resolveAssetUrl } from '../config/appConfig';
import type { Photo } from '../models/Photo';
import styles from './PhotoLightbox.module.css';

interface PhotoLightboxProps {
  photo: Photo;
  onClose: () => void;
  onPrevious?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
}

/**
 * Full-screen view of a single photograph.
 *
 * Escape or the Close button dismisses it, the arrow keys move between
 * photographs, and focus is moved into the dialog on open and returned to the
 * thumbnail on close.
 */
export function PhotoLightbox({ photo, onClose, onPrevious, onNext }: PhotoLightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowLeft') {
        onPrevious?.();
      } else if (event.key === 'ArrowRight') {
        onNext?.();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrevious, onNext]);

  const description = photo.caption ?? 'Photograph';

  return (
    <div
      className={styles.backdrop}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="visually-hidden">
          {description}
        </h2>

        <img className={styles.image} src={resolveAssetUrl(photo.url)} alt={description} />

        {photo.caption ? <p className={styles.caption}>{photo.caption}</p> : null}

        <div className={styles.controls}>
          {onPrevious ? (
            <button type="button" className={styles.control} onClick={onPrevious}>
              Previous
            </button>
          ) : null}
          <button ref={closeButtonRef} type="button" className={styles.control} onClick={onClose}>
            Close
          </button>
          {onNext ? (
            <button type="button" className={styles.control} onClick={onNext}>
              Next
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
