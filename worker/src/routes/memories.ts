import { memoryFormLimits } from '../../../src/config/limits';
import { requireContributor } from '../auth/context';
import type { Role } from '../auth/session';
import type { Env } from '../env';
import { hasTrustedOrigin, json, problem } from '../http';
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

interface SubmittedMemory {
  name?: unknown;
  message?: unknown;
}

/** Rejects anything that is not a sensible single line or paragraph of text. */
function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;

  // Strip control characters other than newline and tab before measuring, so a
  // padded string cannot slip past the length limit.
  const cleaned = value.replaceAll(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '').trim();
  if (cleaned === '' || cleaned.length > maxLength) return null;

  return cleaned;
}

/**
 * Accepts a memory from a contributor and puts it in the moderation queue.
 *
 * Nothing submitted here is visible to anyone until an administrator approves
 * it: the memory is stored in its own object with a pending status and does not
 * join index/memories.json, which is what the public endpoint reads.
 *
 * The browser checks the same rules first, but those are a courtesy. These are
 * the ones that count.
 */
export async function createMemory(request: Request, env: Env, role: Role): Promise<Response> {
  const refusal = requireContributor(role, request, env);
  if (refusal !== null) return refusal;

  if (!hasTrustedOrigin(request, env)) {
    return problem(403, 'That request did not come from this site.', request, env);
  }

  let body: SubmittedMemory;
  try {
    body = (await request.json()) as SubmittedMemory;
  } catch {
    return problem(400, 'That memory could not be read.', request, env);
  }

  const name = cleanText(body.name, memoryFormLimits.maxNameLength);
  const message = cleanText(body.message, memoryFormLimits.maxMessageLength);

  if (name === null || message === null) {
    return problem(400, 'Please give your name and a memory, and keep both a sensible length.', request, env);
  }

  // The identifier is generated here. A browser never gets to choose one.
  const id = crypto.randomUUID();
  const memory: Memory = { id, name, message, created: new Date().toISOString() };

  await env.BUCKET.put(keys.memory(id), JSON.stringify({ ...memory, status: 'pending' }), {
    // Listed in the moderation queue without reading every object.
    customMetadata: { status: 'pending' },
  });

  // 202: accepted, not yet published.
  return json(memory, request, env, { status: 202 });
}
