import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { ServerConfig } from './config.ts';
import { type Clock, Semaphore, systemClock } from './limits.ts';
import { type Identification, UpstreamError, type VisionProvider } from './providers/types.ts';
import type { RecognitionResponse } from './shared/types.ts';
import { type BillingVerifier, UnconfiguredVerifier } from './economy/billing.ts';
import { loadCatalog } from './economy/catalog.ts';
import { createEconomyRoutes } from './economy/routes.ts';
import type { EconomyStore } from './economy/store.ts';
import { clientIp, readBody, send } from './http.ts';
import { QuotaStore } from './store.ts';
import { INSTALL_ID_PATTERN, parseRecognizeRequest, RequestError, type ValidImage } from './validation.ts';

export type Logger = (line: string) => void;

export interface AppDeps {
  config: ServerConfig;
  provider: VisionProvider;
  clock?: Clock;
  log?: Logger;
  /** Persistent counters. Defaults to a SQLite file at config.stateFile. */
  store?: QuotaStore;
  /** The authoritative economy. When absent, only recognition is served. */
  economy?: EconomyStore;
  billing?: { apple: BillingVerifier; google: BillingVerifier };
}

const MINUTE = 60_000;
const DAY = 86_400_000;

/**
 * Creates the request handler. Rate limits, request and spend ceilings, and the
 * result cache persist in SQLite. Images are held in memory only for the
 * duration of the request and are never written to disk or logged; the cache
 * stores only a SHA-256 of the (already redacted) image and the JSON answer.
 */
export function createApp(deps: AppDeps) {
  const { config, provider } = deps;
  const clock = deps.clock ?? systemClock;
  const log = deps.log ?? ((line: string) => console.log(line));
  const store = deps.store ?? new QuotaStore(config.stateFile);

  const economy = deps.economy
    ? createEconomyRoutes({
        store: deps.economy,
        catalog: loadCatalog(),
        limits: store,
        clock,
        features: config.features,
        billing: deps.billing ?? { apple: new UnconfiguredVerifier('apple'), google: new UnconfiguredVerifier('google') },
        trustProxy: config.trustProxy,
        accountsPerIpPerDay: config.accountsPerIpPerDay,
        writesPerMinute: config.economyWritesPerMinute,
      })
    : null;

  const concurrency = new Semaphore(config.maxConcurrent);
  // Identical photos in flight share one model call instead of paying twice.
  const inflight = new Map<string, Promise<Identification>>();
  // Base64 inflates by 4/3; allow a little room for the JSON wrapper.
  const maxBodyBytes = Math.ceil((config.maxImageBytes * 4) / 3) + 1024;
  const limits = {
    dailyRequests: config.globalDailyBudget,
    dailySpendMicros: Math.round(config.dailySpendUsd * 1e6),
    monthlySpendMicros: Math.round(config.monthlySpendUsd * 1e6),
  };

  function sweep(): void {
    store.sweep(clock.now(), DAY);
  }

  /** Calls the provider under the spend reservation, timeout and client-disconnect cancellation. */
  async function callProvider(image: ValidImage, res: ServerResponse): Promise<Identification> {
    const reservation = store.reserve(clock.now(), provider.worstCaseMicros, limits);
    if (!reservation.ok) {
      log(`WARN recognition ceiling reached (${reservation.reason})`);
      throw new RequestError(503, 'daily_budget_exhausted', reservation.reason);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.upstreamTimeoutMs);
    const onClose = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on('close', onClose);
    let actual = 0;
    try {
      const result = await provider.identify(image, controller.signal);
      actual = result.calls.reduce((a, c) => a + c.costMicros, 0);
      return result;
    } catch (err) {
      if (err instanceof UpstreamError) {
        actual = err.costMicros;
        if (controller.signal.aborted && err.kind === 'unavailable') throw new RequestError(504, 'upstream_failed', 'timeout');
      }
      throw err;
    } finally {
      clearTimeout(timer);
      res.off('close', onClose);
      store.settle(reservation.day, provider.worstCaseMicros, actual);
    }
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
    const now = clock.now();
    // Identification never needs an account. With one, the answer can later back a verified discovery.
    const account = economy?.accountFor(req, now) ?? null;
    const installDaily = account && deps.economy!.hasBlack(account, now) ? config.perInstallPerDayBlack : config.perInstallPerDay;
    for (const [key, limit, windowMs] of [
      [`ip:m:${ip}`, config.perIpPerMinute, MINUTE],
      [`install:m:${installId}`, config.perInstallPerMinute, MINUTE],
      [`ip:d:${ip}`, config.perIpPerDay, DAY],
      [`install:d:${installId}`, installDaily, DAY],
    ] as const) {
      const retryAfter = store.hit(key, limit, windowMs, now);
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

    // Deduplication: the same photo (byte-identical after redaction and metadata stripping) is answered from cache.
    const hash = createHash('sha256').update(image.jpeg).digest('hex');
    const cached = config.resultCacheMs > 0 ? store.getCached(hash, clock.now()) : null;
    const withRecord = (r: RecognitionResponse) =>
      account && r.vehicleDetected && r.candidates.length > 0 ? { ...r, recognitionId: deps.economy!.recordRecognition(account, r.candidates, clock.now()) } : r;
    if (cached) {
      send(res, 200, withRecord(JSON.parse(cached) as RecognitionResponse), { 'X-Recognition-Cache': 'hit' });
      return 200;
    }

    let pending = inflight.get(hash);
    const owner = !pending;
    if (!pending) {
      if (!concurrency.tryAcquire()) {
        send(res, 429, { error: 'busy' }, { 'Retry-After': '2' });
        return 429;
      }
      pending = callProvider(image, res).finally(() => {
        concurrency.release();
        inflight.delete(hash);
      });
      inflight.set(hash, pending);
    }
    try {
      const { response } = await pending;
      if (owner && config.resultCacheMs > 0) store.putCached(hash, JSON.stringify(response), clock.now() + config.resultCacheMs);
      send(res, 200, withRecord(response));
      return 200;
    } catch (err) {
      if (err instanceof RequestError) {
        send(res, err.status, { error: err.code }, err.status === 503 ? { 'Retry-After': '3600' } : {});
        return err.status;
      }
      if (err instanceof UpstreamError) {
        if (err.kind === 'misconfigured') log(`ERROR upstream credentials rejected (${provider.id})`);
        const status = err.kind === 'refused' ? 422 : 502;
        send(res, status, { error: err.kind === 'refused' ? 'image_rejected' : 'upstream_failed' });
        return status;
      }
      throw err;
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
        const handled = economy ? await economy.handle(req, res, path ?? '/') : null;
        if (handled === null) {
          send(res, 404, { error: 'not_found' });
          status = 404;
        } else {
          status = handled;
        }
      }
    } catch (err) {
      log(`ERROR unhandled ${err instanceof Error ? err.name : 'error'}`);
      if (!res.headersSent) send(res, 500, { error: 'internal' });
      status = 500;
    }
    // No ids, IPs, headers or bodies are logged.
    log(`${req.method} ${path} ${status} ${clock.now() - started}ms`);
  }

  return { handle, sweep, store };
}
