/**
 * Process-local primitives. Rate limits and spend ceilings are persistent and
 * live in store.ts; the concurrency cap is per process by design.
 */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export class Semaphore {
  private active = 0;
  private readonly max: number;

  constructor(max: number) {
    this.max = max;
  }

  tryAcquire(): boolean {
    if (this.active >= this.max) return false;
    this.active++;
    return true;
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
  }
}
