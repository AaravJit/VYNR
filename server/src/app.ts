import type { IncomingMessage, ServerResponse } from 'node:http';

import type { ServerConfig } from './config.ts';
import { type Clock, DailyBudget, Semaphore, SpendCeiling, systemClock, WindowLimiter } from './limits.ts';
import { type CounterStore, MemoryCounterStore } from './store.ts';
import { UpstreamError, type VisionProvider } from './providers/types.ts';
import { INSTALL_ID_PATTERN, parseRecognizeRequest, RequestError } from './validation.ts';

export type Logger = (line: string) => void;

export interface AppDeps {
  config: ServerConfig;
  provider: VisionProvider;
  clock?: Clock;
  log?: Logger;
  /** Defaults to in-memory counters; production passes a SqliteCounterStore. */
  store?: CounterStore;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000',
};

function send(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload).toString(),
    ...extra,
  });
  res.end(payload);
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) {
      reject(new RequestError(413, 'image_too_large', 'Request body too large'));
      req.resume();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > maxBytes) {
        failed = true;
        reject(new RequestError(413, 'image_too_large', 'Request body too large'));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!failed) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (e) => {
      if (!failed) reject(e);
    });
  });
}

function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    const raw = Array.isArray(xff) ? xff.join(',') : xff;
    // The last hop is the one appended by our own (trusted) proxy; earlier hops are client-controlled.
    const last = raw?.split(',').map((s) => s.trim()).filter(Boolean).pop();
    if (last) return last;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * Creates the request handler. Stateless apart from in-memory rate-limit
 * counters. Images are held in memory only for the duration of the request and
 * are never written to disk or logged.
 */
export function createApp(deps: AppDeps) {
  const { config, provider } = deps;
  const clock = deps.clock ?? systemClock;
  const log = deps.log ?? ((line: string) => console.log(line));

  const store = deps.store ?? new MemoryCounterStore();

  const installMinute = new WindowLimiter('im', config.perInstallPerMinute, MINUTE, store, clock);
  const installDay = new WindowLimiter('id', config.perInstallPerDay, DAY, store, clock);
  const ipMinute = new WindowLimiter('pm', config.perIpPerMinute, MINUTE, store, clock);
  const ipDay = new WindowLimiter('pd', config.perIpPerDay, DAY, store, clock);
  const budget = new DailyBudget(config.globalDailyBudget, store, clock);
  const spend = new SpendCeiling(
    config.dailySpendLimitUsd,
    { inputUsdPerMTok: config.inputUsdPerMTok, outputUsdPerMTok: config.outputUsdPerMTok },
    store,
    clock,
  );
  const concurrency = new Semaphore(config.maxConcurrent);
  // Base64 inflates by 4/3; allow a little room for the JSON wrapper.
  const maxBodyBytes = Math.ceil((config.maxImageBytes * 4) / 3) + 1024;

  function sweep(): void {
    for (const l of [installMinute, installDay, ipMinute, ipDay, budget, spend]) l.sweep();
  }

  async function recognize(req: IncomingMessage, res: ServerResponse): Promise<number> {
    const contentType = req.headers['content-type'] ?? '';
    if (!/^application\/json\b/i.test(contentType)) {
      send(res, 415, { error: 'unsupported_media_type' });
      return 415;
    }
    const installId = req.headers['x-install-id'];
    if (typeof installId !== 'string' || !INSTALL_ID_PATTERN.test(installId)) {
      send(res, 400, { error: 'invalid_install_id' });
      return 400;
    }

    const ip = clientIp(req, config.trustProxy);
    // Order matters: minute windows first so bursts don't burn the daily allowance.
    for (const [limiter, key] of [
      [ipMinute, ip],
      [installMinute, installId],
      [ipDay, ip],
      [installDay, installId],
    ] as const) {
      const retryAfter = limiter.hit(key);
      if (retryAfter > 0) {
        send(res, 429, { error: 'rate_limited' }, { 'Retry-After': String(retryAfter) });
        return 429;
      }
    }

    let image;
    try {
      const raw = await readBody(req, maxBodyBytes);
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new RequestError(400, 'invalid_json', 'Body is not valid JSON');
      }
      image = parseRecognizeRequest(body, config);
    } catch (err) {
      if (err instanceof RequestError) {
        send(res, err.status, { error: err.code });
        return err.status;
      }
      throw err;
    }

    if (!concurrency.tryAcquire()) {
      send(res, 429, { error: 'busy' }, { 'Retry-After': '2' });
      return 429;
    }
    try {
      if (!spend.canSpend() || !budget.tryConsume()) {
        send(res, 503, { error: 'daily_budget_exhausted' }, { 'Retry-After': '3600' });
        return 503;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.upstreamTimeoutMs);
      const onClose = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on('close', onClose);
      try {
        const result = await provider.identify(image, controller.signal, (usage) => spend.record(usage));
        send(res, 200, result);
        return 200;
      } catch (err) {
        if (err instanceof UpstreamError) {
          if (err.kind === 'misconfigured') log(`ERROR upstream credentials rejected (${provider.id})`);
          const status = err.kind === 'refused' ? 422 : controller.signal.aborted ? 504 : 502;
          send(res, status, { error: err.kind === 'refused' ? 'image_rejected' : 'upstream_failed' });
          return status;
        }
        throw err;
      } finally {
        clearTimeout(timer);
        res.off('close', onClose);
      }
    } finally {
      concurrency.release();
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = clock.now();
    const path = (req.url ?? '/').split('?')[0];
    let status = 500;
    try {
      if (req.method === 'GET' && path === '/health') {
        send(res, 200, { ok: true, provider: provider.id });
        status = 200;
      } else if (path === '/v1/recognize') {
        if (req.method !== 'POST') {
          send(res, 405, { error: 'method_not_allowed' }, { Allow: 'POST' });
          status = 405;
        } else {
          status = await recognize(req, res);
        }
      } else {
        send(res, 404, { error: 'not_found' });
        status = 404;
      }
    } catch (err) {
      log(`ERROR unhandled ${err instanceof Error ? err.name : 'error'}`);
      if (!res.headersSent) send(res, 500, { error: 'internal' });
      status = 500;
    }
    // No ids, IPs, headers or bodies are logged.
    log(`${req.method} ${path} ${status} ${clock.now() - started}ms`);
  }

  return { handle, sweep, budget, spend };
}
