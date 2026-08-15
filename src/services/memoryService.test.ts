import { describe, expect, it } from 'vitest';
import type { Memory } from '../models/Memory';
import { createMockMemoryService, sortByNewestFirst } from './memoryService';

const seed: Memory[] = [
  { id: 'a', name: 'Older', message: 'First', created: '2026-01-01T00:00:00.000Z' },
  { id: 'b', name: 'Newer', message: 'Second', created: '2026-06-01T00:00:00.000Z' },
];

describe('sortByNewestFirst', () => {
  it('puts the most recent memory first without mutating the input', () => {
    const sorted = sortByNewestFirst(seed);

    expect(sorted.map((memory) => memory.id)).toEqual(['b', 'a']);
    expect(seed.map((memory) => memory.id)).toEqual(['a', 'b']);
  });
});

describe('the mock memory service', () => {
  it('returns the seeded memories newest first', async () => {
    const service = createMockMemoryService(seed);

    expect((await service.getMemories()).map((memory) => memory.id)).toEqual(['b', 'a']);
  });

  it('adds a memory and returns it at the top of the list', async () => {
    const service = createMockMemoryService(seed);

    const added = await service.addMemory({ name: 'Alex', message: 'A new memory.' });

    expect(added.id).not.toBe('');
    expect(added.created).not.toBe('');
    expect((await service.getMemories())[0]).toEqual(added);
  });

  it('does not let a caller mutate the stored memories', async () => {
    const service = createMockMemoryService(seed);

    const memories = await service.getMemories();
    memories.pop();

    expect(await service.getMemories()).toHaveLength(2);
  });
});
