/**
 * In-memory fixed-window limiters. Good for a single instance; a multi-instance
 * deployment should move these counters to a shared store (e.g. Redis). The
 * global budget is the hard cost ceiling and resets at 00:00 UTC.
 */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

interface Window {
  start: number;
  count: number;
}

export class WindowLimiter {
  private readonly windows = new Map<string, Window>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly clock: Clock;

  constructor(limit: number, windowMs: number, clock: Clock = systemClock) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.clock = clock;
  }

  /** Returns 0 if allowed (and counts the hit), otherwise seconds until retry. */
  hit(key: string): number {
    const now = this.clock.now();
    const start = Math.floor(now / this.windowMs) * this.windowMs;
    let w = this.windows.get(key);
    if (!w || w.start !== start) {
      w = { start, count: 0 };
      this.windows.set(key, w);
    }
    if (w.count >= this.limit) return Math.max(1, Math.ceil((start + this.windowMs - now) / 1000));
    w.count++;
    return 0;
  }

  /** Drops expired windows so memory stays bounded. */
  sweep(): void {
    const start = Math.floor(this.clock.now() / this.windowMs) * this.windowMs;
    for (const [k, w] of this.windows) if (w.start !== start) this.windows.delete(k);
  }

  get size(): number {
    return this.windows.size;
  }
}

export class DailyBudget {
  private day = '';
  private used = 0;
  private readonly limit: number;
  private readonly clock: Clock;

  constructor(limit: number, clock: Clock = systemClock) {
    this.limit = limit;
    this.clock = clock;
  }

  private roll(): void {
    const d = new Date(this.clock.now()).toISOString().slice(0, 10);
    if (d !== this.day) {
      this.day = d;
      this.used = 0;
    }
  }

  tryConsume(): boolean {
    this.roll();
    if (this.used >= this.limit) return false;
    this.used++;
    return true;
  }

  remaining(): number {
    this.roll();
    return Math.max(0, this.limit - this.used);
  }
}

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
