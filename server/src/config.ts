export interface ServerConfig {
  port: number;
  host: string;
  anthropicApiKey: string | null;
  model: string;
  /** Max decoded JPEG size accepted from clients. */
  maxImageBytes: number;
  /** Max longest edge (px) the client may claim; the app sends ≤1024. */
  maxImageEdge: number;
  perInstallPerMinute: number;
  perInstallPerDay: number;
  perIpPerMinute: number;
  perIpPerDay: number;
  /** Hard cap on upstream AI calls per UTC day across all users (cost control). */
  globalDailyBudget: number;
  /** Max concurrent upstream AI calls. */
  maxConcurrent: number;
  upstreamTimeoutMs: number;
  /** Trust the first X-Forwarded-For hop (only behind a known reverse proxy). */
  trustProxy: boolean;
  /** SQLite file for limits, budget and spend (':memory:' disables persistence). */
  quotaDbPath: string;
  /** Daily spend ceiling in USD, estimated from reported token usage. */
  dailySpendLimitUsd: number;
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
}

function num(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${key} must be a number >= 0`);
  return n;
}

function int(env: NodeJS.ProcessEnv, key: string, fallback: number, min = 0): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) throw new Error(`${key} must be an integer >= ${min}`);
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const key = env.ANTHROPIC_API_KEY?.trim() || null;
  return {
    port: int(env, 'PORT', 8787, 1),
    host: env.HOST?.trim() || '0.0.0.0',
    anthropicApiKey: key,
    model: env.RECOGNITION_MODEL?.trim() || 'claude-opus-5-5',
    maxImageBytes: int(env, 'MAX_IMAGE_BYTES', 1_500_000, 1024),
    maxImageEdge: int(env, 'MAX_IMAGE_EDGE', 1600, 64),
    perInstallPerMinute: int(env, 'RATE_PER_INSTALL_PER_MINUTE', 6, 1),
    perInstallPerDay: int(env, 'RATE_PER_INSTALL_PER_DAY', 50, 1),
    perIpPerMinute: int(env, 'RATE_PER_IP_PER_MINUTE', 20, 1),
    perIpPerDay: int(env, 'RATE_PER_IP_PER_DAY', 300, 1),
    globalDailyBudget: int(env, 'GLOBAL_DAILY_REQUEST_BUDGET', 2000, 0),
    maxConcurrent: int(env, 'MAX_CONCURRENT_UPSTREAM', 8, 1),
    upstreamTimeoutMs: int(env, 'UPSTREAM_TIMEOUT_MS', 20_000, 1000),
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    quotaDbPath: env.QUOTA_DB_PATH?.trim() || './data/quota.db',
    dailySpendLimitUsd: num(env, 'DAILY_SPEND_LIMIT_USD', 20),
    // List price of the default model; set these to match RECOGNITION_MODEL if you change it.
    inputUsdPerMTok: num(env, 'PRICE_INPUT_USD_PER_MTOK', 4),
    outputUsdPerMTok: num(env, 'PRICE_OUTPUT_USD_PER_MTOK', 20),
  };
}
