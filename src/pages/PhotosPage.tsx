import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { PhotoCard } from '../components/PhotoCard';
import { PhotoLightbox } from '../components/PhotoLightbox';
import { EmptyState, ErrorState, LoadingState } from '../components/StatePanel';
import { useAsyncData } from '../hooks/useAsyncData';
import type { Photo } from '../models/Photo';
import { photoService } from '../services/photoService';
import styles from './PhotosPage.module.css';

export function PhotosPage() {
  const { data, status, error, reload } = useAsyncData<Photo[]>(
    () => photoService.getPhotos(),
    'The photographs could not be loaded.',
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const photos = data ?? [];
  const selectedPhoto = selectedIndex === null ? null : (photos[selectedIndex] ?? null);

  const openPhoto = useCallback(
    (photo: Photo) => {
      setSelectedIndex(photos.findIndex((candidate) => candidate.id === photo.id));
    },
    [photos],
  );

  const closePhoto = useCallback(() => setSelectedIndex(null), []);

  const showPrevious = useCallback(() => {
    setSelectedIndex((index) => (index === null || index === 0 ? index : index - 1));
  }, []);

  const showNext = useCallback(() => {
    setSelectedIndex((index) =>
      index === null || index >= photos.length - 1 ? index : index + 1,
    );
  }, [photos.length]);

  return (
    <div className="container">
      <header className="page-header">
        <h1>Photographs</h1>
        <p>
          Choose a photograph to see it larger.{' '}
          <Link to="/upload-photos">Upload photographs of your own</Link>.
        </p>
      </header>

      {status === 'loading' ? <LoadingState label="Loading the photographs…" /> : null}

      {status === 'error' ? (
        <ErrorState message={error ?? 'The photographs could not be loaded.'} onRetry={reload} />
      ) : null}

      {status === 'success' ? (
        photos.length === 0 ? (
          <EmptyState title="No photographs have been shared yet">
            <p>
              When photographs are uploaded they will appear here.{' '}
              <Link to="/upload-photos">Upload the first ones</Link>.
            </p>
          </EmptyState>
        ) : (
          <ul className={styles.grid}>
            {photos.map((photo) => (
              <li key={photo.id}>
                <PhotoCard photo={photo} onSelect={openPhoto} />
              </li>
            ))}
          </ul>
        )
      ) : null}

      {selectedPhoto && selectedIndex !== null ? (
        <PhotoLightbox
          photo={selectedPhoto}
          onClose={closePhoto}
          onPrevious={selectedIndex > 0 ? showPrevious : undefined}
          onNext={selectedIndex < photos.length - 1 ? showNext : undefined}
        />
      ) : null}
    </div>
  );
}
