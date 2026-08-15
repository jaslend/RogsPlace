/** Resolves after `ms` milliseconds. Used to make mock services feel realistic. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
