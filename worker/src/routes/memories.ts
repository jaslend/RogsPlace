import type { Env } from '../env';
import { json } from '../http';
import { keys, readJson } from '../storage';
import type { Memory } from '../types';

/**
 * The published memories, newest first.
 *
 * This reads one object rather than listing and fetching every memory. The
 * index is only ever rewritten by an administrator approving or removing
 * something, so there is no concurrent-write problem: submissions land in their
 * own object and only join the index when approved.
 */
export async function listMemories(request: Request, env: Env): Promise<Response> {
  const memories = (await readJson<Memory[]>(env, keys.memoriesIndex)) ?? [];

  return json(memories, request, env, { cacheControl: 'public, max-age=30' });
}
