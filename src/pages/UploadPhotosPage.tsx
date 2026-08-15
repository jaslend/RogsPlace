import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { appConfig } from '../config/appConfig';
import { photoService } from '../services/photoService';
import { toUserMessage } from '../utils/errors';
import {
  acceptAttribute,
  acceptedFormatsLabel,
  validateSelectedFiles,
  type RejectedFile,
} from '../utils/fileValidation';
import { formatFileSize } from '../utils/formatDate';
import styles from './UploadPhotosPage.module.css';

interface SelectedPhoto {
  /** Stable key for React, unrelated to any future server-side id. */
  key: string;
  file: File;
  previewUrl: string;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

const { maxFiles, maxBytesPerFile } = appConfig.upload;

export function UploadPhotosPage() {
  const [selected, setSelected] = useState<SelectedPhoto[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  // Object URLs are only released when the component goes away, so previews
  // survive re-renders; individual URLs are released as photographs are removed.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  useEffect(
    () => () => {
      for (const photo of selectedRef.current) URL.revokeObjectURL(photo.previewUrl);
    },
    [],
  );

  const handleFilesChosen = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files ?? []);
    // Allow the same file to be chosen again after it has been removed.
    event.target.value = '';
    if (chosen.length === 0) return;

    setUploadState('idle');
    setUploadError(null);

    const current = selectedRef.current;
    const { accepted, rejected: newlyRejected } = validateSelectedFiles(
      chosen,
      current.map((photo) => photo.file),
    );
    setRejected(newlyRejected);

    if (accepted.length > 0) {
      setSelected([
        ...current,
        ...accepted.map((file) => ({
          key: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ]);
    }
  }, []);

  const removePhoto = useCallback((key: string) => {
    setSelected((current) => {
      const photo = current.find((candidate) => candidate.key === key);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return current.filter((candidate) => candidate.key !== key);
    });
    setRejected([]);
  }, []);

  const clearSelection = useCallback(() => {
    setSelected((current) => {
      for (const photo of current) URL.revokeObjectURL(photo.previewUrl);
      return [];
    });
    setRejected([]);
  }, []);

  async function handleUpload() {
    if (selected.length === 0) return;

    setUploadState('uploading');
    setUploadError(null);
    setProgress(0);

    try {
      const result = await photoService.uploadPhotos(
        selected.map((photo) => photo.file),
        setProgress,
      );
      setUploadedCount(result.uploadedCount);
      clearSelection();
      setUploadState('success');
    } catch (cause) {
      setUploadError(
        toUserMessage(cause, 'The photographs could not be uploaded. Please try again.'),
      );
      setUploadState('error');
    }
  }

  const isUploading = uploadState === 'uploading';

  return (
    <div className="container">
      <header className="page-header">
        <h1>Upload photographs</h1>
        <p>
          Choose up to {maxFiles} photographs at a time. Each one may be up to{' '}
          {formatFileSize(maxBytesPerFile)}, in {acceptedFormatsLabel} format.
        </p>
      </header>

      {uploadState === 'success' ? (
        <div className="notice notice--success notice--spaced" role="status">
          <p className="notice__heading">
            Thank you — {uploadedCount} {uploadedCount === 1 ? 'photograph' : 'photographs'}{' '}
            {uploadedCount === 1 ? 'was' : 'were'} accepted.
          </p>
          <p>
            {appConfig.useMockData
              ? 'This site is not yet connected to its photograph storage, so nothing has left your device.'
              : 'They will appear in the gallery once they have been processed.'}
          </p>
        </div>
      ) : null}

      {uploadState === 'error' && uploadError ? (
        <div className="notice notice--error notice--spaced" role="alert">
          <p className="notice__heading">The upload did not complete</p>
          <p>{uploadError}</p>
        </div>
      ) : null}

      {rejected.length > 0 ? (
        <div className="notice notice--error notice--spaced" role="alert">
          <p className="notice__heading">
            {rejected.length === 1
              ? 'One photograph could not be added'
              : `${rejected.length} photographs could not be added`}
          </p>
          <ul>
            {rejected.map((item) => (
              <li key={`${item.fileName}-${item.reason}`}>
                <strong>{item.fileName}</strong> — {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.dropArea}>
        <label className="field__label" htmlFor="photo-files">
          Choose photographs
        </label>
        <span className="field__hint" id="photo-files-hint">
          {selected.length} of {maxFiles} selected.
        </span>
        <input
          id="photo-files"
          className={styles.fileInput}
          type="file"
          accept={acceptAttribute}
          multiple
          onChange={handleFilesChosen}
          aria-describedby="photo-files-hint"
          disabled={isUploading || selected.length >= maxFiles}
        />
      </div>

      {selected.length > 0 ? (
        <section aria-labelledby="selected-heading" className={styles.selectedSection}>
          <h2 id="selected-heading">Selected photographs</h2>

          <ul className={styles.previewGrid}>
            {selected.map((photo) => (
              <li key={photo.key} className={styles.preview}>
                <img
                  className={styles.previewImage}
                  src={photo.previewUrl}
                  alt={`Preview of ${photo.file.name}`}
                />
                <span className={styles.previewName}>{photo.file.name}</span>
                <span className={styles.previewSize}>{formatFileSize(photo.file.size)}</span>
                <div className={styles.previewActions}>
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={() => removePhoto(photo.key)}
                    disabled={isUploading}
                  >
                    Remove
                    <span className="visually-hidden"> {photo.file.name}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {isUploading ? (
            <div aria-live="polite" className={styles.progressBlock}>
              <label className="field__label" htmlFor="upload-progress">
                Uploading… {progress}% complete
              </label>
              <progress id="upload-progress" className={styles.progress} max={100} value={progress}>
                {progress}%
              </progress>
            </div>
          ) : null}

          <div className={styles.actions}>
            <button type="button" className="button" onClick={handleUpload} disabled={isUploading}>
              {isUploading
                ? 'Uploading…'
                : `Upload ${selected.length} ${selected.length === 1 ? 'photograph' : 'photographs'}`}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={clearSelection}
              disabled={isUploading}
            >
              Remove all
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
