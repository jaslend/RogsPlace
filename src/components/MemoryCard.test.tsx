import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Memory } from '../models/Memory';
import type { Photo } from '../models/Photo';
import { MemoryCard } from './MemoryCard';

const memory: Memory = {
  id: 'memory-1',
  name: 'Alex Taylor',
  message: 'A memory worth keeping.',
  created: '2026-07-02T18:20:00.000Z',
};

const photo: Photo = {
  id: 'photo-1',
  url: 'placeholders/photo-1.svg',
  thumbnailUrl: 'placeholders/photo-1.svg',
  caption: 'A day by the sea',
};

describe('MemoryCard', () => {
  it('shows the contributor, the message and the date', () => {
    render(<MemoryCard memory={memory} />);

    expect(screen.getByRole('heading', { name: 'Alex Taylor' })).toBeInTheDocument();
    expect(screen.getByText('A memory worth keeping.')).toBeInTheDocument();
    expect(screen.getByText(/2 July 2026/)).toBeInTheDocument();
  });

  it('shows the associated photograph and its caption when one is supplied', () => {
    render(<MemoryCard memory={{ ...memory, photoId: photo.id }} photo={photo} />);

    const image = screen.getByRole('img', { name: 'A day by the sea' });
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image.getAttribute('src')).toContain('placeholders/photo-1.svg');
  });

  it('shows no photograph when none is supplied', () => {
    render(<MemoryCard memory={memory} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('leaves out the date when the stored value cannot be read', () => {
    render(<MemoryCard memory={{ ...memory, created: 'not-a-date' }} />);

    expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
  });
});
