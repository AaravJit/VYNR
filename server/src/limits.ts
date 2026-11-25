import type { CounterStore } from './store.ts';

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Fixed-window limiter backed by a CounterStore. */
export class WindowLimiter {
  private readonly name: string;
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly store: CounterStore;
  private readonly clock: Clock;

  constructor(name: string, limit: number, windowMs: number, store: CounterStore, clock: Clock) {
    this.name = name;
    this.limit = limit;
    this.windowMs = windowMs;
    this.store = store;
    this.clock = clock;
  }

  private window(now: number): number {
    return Math.floor(now / this.windowMs) * this.windowMs;
  }

  /** Returns 0 if allowed (and counts the hit), otherwise seconds until retry. */
  hit(key: string): number {
    const now = this.clock.now();
    const start = this.window(now);
    const k = `${this.name}:${key}`;
    if (this.store.get(k, String(start)) >= this.limit) {
      return Math.max(1, Math.ceil((start + this.windowMs - now) / 1000));
    }
    this.store.add(k, String(start), 1);
    return 0;
  }

  /** Drops expired windows so storage stays bounded. */
  sweep(): void {
    this.store.prune(`${this.name}:`, String(this.window(this.clock.now())));
  }
}

/** Hard cap on upstream calls per UTC day across all users. */
export class DailyBudget {
  private readonly limit: number;
  private readonly store: CounterStore;
  private readonly clock: Clock;

  constructor(limit: number, store: CounterStore, clock: Clock) {
    this.limit = limit;
    this.store = store;
    this.clock = clock;
  }

  tryConsume(): boolean {
    const day = utcDay(this.clock.now());
    if (this.store.get('budget', day) >= this.limit) return false;
    this.store.add('budget', day, 1);
    return true;
  }

  remaining(): number {
    return Math.max(0, this.limit - this.store.get('budget', utcDay(this.clock.now())));
  }

  sweep(): void {
    this.store.prune('budget', utcDay(this.clock.now()));
  }
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface Pricing {
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
}

/**
 * Daily spend ceiling in US dollars, estimated from the token usage the AI
 * provider reports for every call (including failed or refused ones). Once
 * the day's estimate reaches the limit, no more upstream calls are made.
 */
export class SpendCeiling {
  private readonly limitUsd: number;
  private readonly pricing: Pricing;
  private readonly store: CounterStore;
  private readonly clock: Clock;

  constructor(limitUsd: number, pricing: Pricing, store: CounterStore, clock: Clock) {
    this.limitUsd = limitUsd;
    this.pricing = pricing;
    this.store = store;
    this.clock = clock;
  }

  canSpend(): boolean {
    return this.spentToday() < this.limitUsd;
  }

  spentToday(): number {
    return this.store.get('spend', utcDay(this.clock.now()));
  }

  record(usage: TokenUsage): void {
    const cost =
      (usage.inputTokens * this.pricing.inputUsdPerMTok + usage.outputTokens * this.pricing.outputUsdPerMTok) / 1_000_000;
    if (cost > 0) this.store.add('spend', utcDay(this.clock.now()), cost);
  }

  sweep(): void {
    this.store.prune('spend', utcDay(this.clock.now()));
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
