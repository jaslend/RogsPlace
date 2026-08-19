import type { Memory } from './Memory';
import type { Photo } from './Photo';

/** Everything waiting for an administrator to look at it. */
export interface ModerationQueue {
  /** Oldest first: whatever has been waiting longest is dealt with first. */
  memories: Memory[];
  photos: Photo[];
}

/** A newly issued family invitation. The token is shown once and not stored. */
export interface IssuedInvite {
  token: string;
  version: number;
}
