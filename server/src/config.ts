import { FEATURES, type Feature } from './economy/routes.ts';
import { isPricedModel } from './pricing.ts';

export interface ServerConfig {
  port: number;
  host: string;
  anthropicApiKey: string | null;
  /** Fast first-pass model (cheap). */
  model: string;
  /** Escalation model for uncertain answers, or null to disable the cascade. */
  escalationModel: string | null;
  /** Escalate when the first answer's top confidence is below this (0..1). */
  escalateBelow: number;
  /** Explicit output caps (tokens, thinking included). */
  maxOutputTokens: number;
  escalationMaxOutputTokens: number;
  /** Max decoded JPEG size accepted from clients. */
  maxImageBytes: number;
  /** Max longest edge (px) the client may claim; the app sends ≤1024. */
  maxImageEdge: number;
  perInstallPerMinute: number;
  perInstallPerDay: number;
  perIpPerMinute: number;
  perIpPerDay: number;
  /** Hard cap on recognitions per UTC day across all users. */
  globalDailyBudget: number;
  /** Hard spend ceilings in US dollars (reserved at worst case before each call). */
  dailySpendUsd: number;
  monthlySpendUsd: number;
  /** Max concurrent upstream AI calls. */
  maxConcurrent: number;
  upstreamTimeoutMs: number;
  /** How long an identical image's result is reused without a new model call. */
  resultCacheMs: number;
  /** SQLite file for persistent counters. ':memory:' keeps them in memory (tests only). */
  stateFile: string;
  /** Trust the last X-Forwarded-For hop (only behind a known reverse proxy). */
  trustProxy: boolean;
  /** Daily identifications per install for accounts with an active VYNR Black subscription. */
  perInstallPerDayBlack: number;
  /** SQLite file for the authoritative economy (accounts, VC ledger, collectibles, market). */
  economyStateFile: string;
  /** Enabled feature flags; unfinished features stay off. */
  features: Set<Feature>;
  accountsPerIpPerDay: number;
  economyWritesPerMinute: number;
}

function features(raw: string | undefined): Set<Feature> {
  const list = (raw ?? 'economy,crates,marketplace,seasons,social')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const f of list) if (!(FEATURES as readonly string[]).includes(f)) throw new Error(`Unknown feature flag ${f}`);
  return new Set(list as Feature[]);
}

function int(env: NodeJS.ProcessEnv, key: string, fallback: number, min = 0): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) throw new Error(`${key} must be an integer >= ${min}`);
  return n;
}

function num(env: NodeJS.ProcessEnv, key: string, fallback: number, min = 0, max = Number.POSITIVE_INFINITY): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${key} must be a number between ${min} and ${max}`);
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const key = env.ANTHROPIC_API_KEY?.trim() || null;
  const model = env.RECOGNITION_MODEL?.trim() || 'claude-haiku-5-5';
  const rawEscalation = env.RECOGNITION_ESCALATION_MODEL?.trim();
  const escalationModel = rawEscalation === 'off' || rawEscalation === 'none' ? null : rawEscalation || 'claude-sonnet-5-5';
  for (const m of [model, escalationModel]) {
    if (m && !isPricedModel(m)) throw new Error(`No price is configured for model ${m}; add it to src/pricing.ts so spend limits stay enforced.`);
  }
  return {
    port: int(env, 'PORT', 8787, 1),
    host: env.HOST?.trim() || '0.0.0.0',
    anthropicApiKey: key,
    model,
    escalationModel,
    escalateBelow: num(env, 'ESCALATE_BELOW_CONFIDENCE', 0.7, 0, 1),
    maxOutputTokens: int(env, 'MAX_OUTPUT_TOKENS', 1024, 256),
    escalationMaxOutputTokens: int(env, 'ESCALATION_MAX_OUTPUT_TOKENS', 3000, 256),
    maxImageBytes: int(env, 'MAX_IMAGE_BYTES', 1_000_000, 1024),
    maxImageEdge: int(env, 'MAX_IMAGE_EDGE', 1280, 64),
    perInstallPerMinute: int(env, 'RATE_PER_INSTALL_PER_MINUTE', 6, 1),
    perInstallPerDay: int(env, 'RATE_PER_INSTALL_PER_DAY', 25, 1),
    perIpPerMinute: int(env, 'RATE_PER_IP_PER_MINUTE', 20, 1),
    perIpPerDay: int(env, 'RATE_PER_IP_PER_DAY', 300, 1),
    globalDailyBudget: int(env, 'GLOBAL_DAILY_REQUEST_BUDGET', 2000, 0),
    dailySpendUsd: num(env, 'DAILY_SPEND_LIMIT_USD', 2, 0),
    monthlySpendUsd: num(env, 'MONTHLY_SPEND_LIMIT_USD', 50, 0),
    maxConcurrent: int(env, 'MAX_CONCURRENT_UPSTREAM', 8, 1),
    upstreamTimeoutMs: int(env, 'UPSTREAM_TIMEOUT_MS', 20_000, 1000),
    resultCacheMs: int(env, 'RESULT_CACHE_SECONDS', 86_400, 0) * 1000,
    stateFile: env.STATE_FILE?.trim() || './data/vynr-state.sqlite',
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    perInstallPerDayBlack: int(env, 'RATE_PER_INSTALL_PER_DAY_BLACK', 40, 1),
    economyStateFile: env.ECONOMY_STATE_FILE?.trim() || './data/vynr-economy.sqlite',
    features: features(env.FEATURES),
    accountsPerIpPerDay: int(env, 'ACCOUNTS_PER_IP_PER_DAY', 5, 1),
    economyWritesPerMinute: int(env, 'ECONOMY_WRITES_PER_MINUTE', 60, 1),
  };
}
