import { Link } from 'react-router-dom';
import { MemoryCard } from '../components/MemoryCard';
import { EmptyState, ErrorState, LoadingState } from '../components/StatePanel';
import { useAsyncData } from '../hooks/useAsyncData';
import type { Memory } from '../models/Memory';
import type { Photo } from '../models/Photo';
import { memoryService } from '../services/memoryService';
import { photoService } from '../services/photoService';

interface MemoriesPageData {
  memories: Memory[];
  photosById: Map<string, Photo>;
}

/**
 * Memories are shown newest first. Photographs are fetched alongside them only
 * so that a memory referencing a photoId can display it; a failure to load the
 * gallery must not hide the memories themselves.
 */
async function loadMemoriesPageData(): Promise<MemoriesPageData> {
  const [memories, photos] = await Promise.all([
    memoryService.getMemories(),
    photoService.getPhotos().catch(() => [] as Photo[]),
  ]);

  return {
    memories,
    photosById: new Map(photos.map((photo) => [photo.id, photo])),
  };
}

export function MemoriesPage() {
  const { data, status, error, reload } = useAsyncData<MemoriesPageData>(
    loadMemoriesPageData,
    'The memories could not be loaded.',
  );

  return (
    <div className="container container--reading">
      <header className="page-header">
        <h1>Memories</h1>
        <p>
          Messages and memories shared by family and friends, with the most recent first.{' '}
          <Link to="/add-memory">Add a memory of your own</Link>.
        </p>
      </header>

      {status === 'loading' ? <LoadingState label="Loading the memories…" /> : null}

      {status === 'error' ? (
        <ErrorState message={error ?? 'The memories could not be loaded.'} onRetry={reload} />
      ) : null}

      {status === 'success' && data !== null ? (
        data.memories.length === 0 ? (
          <EmptyState title="No memories have been shared yet">
            <p>
              When someone adds a memory it will appear here.{' '}
              <Link to="/add-memory">Be the first to add one</Link>.
            </p>
          </EmptyState>
        ) : (
          <div className="stack">
            {data.memories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                photo={memory.photoId ? data.photosById.get(memory.photoId) : undefined}
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
