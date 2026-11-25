import type { IncomingMessage, ServerResponse } from 'node:http';

import { clientIp, readBody, send } from '../http.ts';
import type { Clock } from '../limits.ts';
import type { QuotaStore } from '../store.ts';
import { RequestError } from '../validation.ts';
import {
  BillingNotConfiguredError,
  BillingRejectedError,
  BLACK_BENEFITS,
  BLACK_PRODUCTS,
  type BillingVerifier,
} from './billing.ts';
import { isRarity, type ServerCatalog } from './catalog.ts';
import { oddsFor } from './config.ts';
import { EconomyError, type EconomyStore, IDEMPOTENCY_KEY } from './store.ts';

export const FEATURES = ['economy', 'crates', 'marketplace', 'seasons', 'social', 'subscriptions'] as const;
export type Feature = (typeof FEATURES)[number];

export interface EconomyRouteDeps {
  store: EconomyStore;
  catalog: ServerCatalog;
  limits: QuotaStore;
  clock: Clock;
  features: ReadonlySet<Feature>;
  billing: { apple: BillingVerifier; google: BillingVerifier };
  trustProxy: boolean;
  /** Account creations allowed per IP per day. */
  accountsPerIpPerDay: number;
  /** Economy write requests allowed per account per minute. */
  writesPerMinute: number;
}

const MINUTE = 60_000;
const DAY = 86_400_000;
const MAX_BODY = 8 * 1024;
const ID = /^[a-z]+_[A-Za-z0-9_-]{8,40}$/;
const SLUG = /^[a-z0-9-]{1,64}$/;

type Handler = (ctx: Ctx) => Promise<unknown> | unknown;
interface Ctx {
  req: IncomingMessage;
  account: string | null;
  params: string[];
  query: URLSearchParams;
  body: () => Promise<Record<string, unknown>>;
  key: () => string;
  now: number;
}

interface Route {
  method: string;
  pattern: RegExp;
  auth: boolean;
  feature: Feature;
  write: boolean;
  handler: Handler;
}

/**
 * HTTP routes for the authoritative economy. Every route validates its input,
 * every write needs a bearer token and is rate limited per account, and every
 * VC or ownership change goes through `EconomyStore` in one transaction.
 * Responses never include another player's account id.
 */
export function createEconomyRoutes(deps: EconomyRouteDeps) {
  const { store, catalog } = deps;
  const routes: Route[] = [];
  const add = (method: string, path: string, feature: Feature, opts: { auth?: boolean; write?: boolean }, handler: Handler) => {
    const pattern = new RegExp(`^${path.replace(/:[a-z]+/g, '([^/]+)')}$`);
    routes.push({ method, pattern, feature, handler, auth: opts.auth ?? true, write: opts.write ?? method !== 'GET' });
  };

  const str = (v: unknown, field: string, re: RegExp): string => {
    if (typeof v !== 'string' || !re.test(v)) throw new RequestError(400, 'invalid_request', `invalid ${field}`);
    return v;
  };
  const int = (v: unknown, field: string, min: number, max: number): number => {
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) throw new RequestError(400, 'invalid_request', `invalid ${field}`);
    return v;
  };
  const vehicleParam = (v: string) => {
    const id = str(v, 'vehicle', SLUG);
    if (!catalog.vehicle(id)) throw new EconomyError(404, 'unknown_vehicle');
    return id;
  };

  // ── Public configuration ──
  add('GET', '/v1/config', 'economy', { auth: false }, ({ now }) => {
    const cfg = store.config;
    return {
      features: [...deps.features],
      catalogVersion: catalog.version,
      crates: cfg.crates
        .filter((c) => c.enabled && (c.availableFrom === null || now >= c.availableFrom) && (c.availableUntil === null || now < c.availableUntil))
        .map((c) => ({ id: c.id, name: c.name, description: c.description, priceVc: c.priceVc, availableUntil: c.availableUntil, odds: oddsFor(catalog, c) })),
      showroomVc: cfg.showroomVc,
      scrapVc: cfg.scrapVc,
      discoveryVc: cfg.discoveryVc,
      market: { feeRate: cfg.market.feeRate, priceBounds: cfg.market.priceBounds, tradeHoldMs: cfg.market.tradeHoldMs },
      cosmetics: cfg.cosmetics,
      seasons: cfg.seasons.filter((s) => now < s.endsAt),
      achievements: cfg.achievements.map(({ rule: _r, ...a }) => a),
      black: { benefits: BLACK_BENEFITS, products: BLACK_PRODUCTS, available: deps.features.has('subscriptions') && deps.billing.apple.configured },
    };
  });
  add('GET', '/v1/crates/:id/odds', 'crates', { auth: false }, ({ params, now }) => oddsFor(catalog, store.crate(str(params[0], 'crate', SLUG), now)));

  // ── Account ──
  add('POST', '/v1/account', 'economy', { auth: false }, ({ req, now }) => {
    const ip = clientIp(req, deps.trustProxy);
    const retry = deps.limits.hit(`acct:create:${ip}`, deps.accountsPerIpPerDay, DAY, now);
    if (retry > 0) throw new EconomyError(429, 'rate_limited');
    return store.createAccount(now);
  });
  add('DELETE', '/v1/account', 'economy', {}, ({ account, now }) => {
    store.deleteAccount(account!, now);
    return { deleted: true };
  });
  add('GET', '/v1/account/export', 'economy', {}, ({ account }) => store.exportAccount(account!));
  add('GET', '/v1/me', 'economy', {}, ({ account, now }) => ({
    balance: store.balanceOf(account!),
    stats: store.stats(account!),
    black: store.hasBlack(account!, now),
    trade: store.tradeEligibility(account!, now),
    cosmetics: [...store.usableCosmetics(account!, now)],
  }));
  add('GET', '/v1/wallet/ledger', 'economy', {}, ({ account, query }) => {
    const before = query.get('before');
    return store.ledger(account!, Number(query.get('limit') ?? 50), before ? Number(before) : undefined);
  });

  // ── Discoveries and collectibles ──
  add('GET', '/v1/discoveries', 'economy', {}, ({ account }) => store.discoveries(account!));
  add('POST', '/v1/discoveries', 'economy', {}, async ({ account, body, now }) => {
    const b = await body();
    return store.claimDiscovery(account!, str(b.recognitionId, 'recognitionId', ID), vehicleParam(String(b.vehicleId)), now);
  });
  add('GET', '/v1/inventory', 'economy', {}, ({ account }) => store.inventory(account!).map(({ ownerId: _o, ...c }) => c));
  add('GET', '/v1/collectibles/:id', 'economy', { auth: false }, ({ params }) => store.provenance(str(params[0], 'collectible', ID)));
  add('POST', '/v1/collectibles/:id/scrap', 'economy', {}, ({ account, params, key, now }) =>
    store.scrap(account!, str(params[0], 'collectible', ID), key(), now),
  );

  // ── Crates and showroom ──
  add('GET', '/v1/crates/:id/pity', 'crates', {}, ({ account, params }) => store.pityStatus(account!, str(params[0], 'crate', SLUG)));
  add('POST', '/v1/crates/:id/open', 'crates', {}, ({ account, params, key, now }) => store.openCrate(account!, str(params[0], 'crate', SLUG), key(), now));
  add('GET', '/v1/crates/openings/unseen', 'crates', {}, ({ account }) => store.unseenOpenings(account!));
  add('POST', '/v1/crates/openings/:id/seen', 'crates', {}, ({ account, params }) => {
    store.markOpeningSeen(account!, str(params[0], 'opening', ID));
    return { ok: true };
  });
  add('POST', '/v1/showroom/:vehicle', 'crates', {}, ({ account, params, key, now }) => store.buyShowroom(account!, vehicleParam(params[0]!), key(), now));

  // ── Marketplace ──
  add('GET', '/v1/market/listings', 'marketplace', { auth: false }, ({ account, query }) => {
    const rarity = query.get('rarity');
    const sort = query.get('sort');
    return store.searchListings(account, {
      make: query.get('make') ? str(query.get('make'), 'make', SLUG) : undefined,
      vehicleId: query.get('vehicleId') ? vehicleParam(query.get('vehicleId')!) : undefined,
      rarity: rarity && isRarity(rarity) ? rarity : undefined,
      sort: sort === 'price_desc' || sort === 'newest' ? sort : 'price_asc',
      limit: Number(query.get('limit') ?? 20) || 20,
      offset: Number(query.get('offset') ?? 0) || 0,
    });
  });
  add('POST', '/v1/market/listings', 'marketplace', {}, async ({ account, body, key, now }) => {
    const b = await body();
    return store.createListing(account!, str(b.collectibleId, 'collectibleId', ID), int(b.price, 'price', 1, 1_000_000), key(), now);
  });
  add('DELETE', '/v1/market/listings/:id', 'marketplace', {}, ({ account, params, now }) => {
    store.cancelListing(account!, str(params[0], 'listing', ID), now);
    return { cancelled: true };
  });
  add('POST', '/v1/market/listings/:id/buy', 'marketplace', {}, async ({ account, params, body, key, now }) => {
    const b = await body();
    return store.buyListing(account!, str(params[0], 'listing', ID), int(b.expectedPrice, 'expectedPrice', 1, 1_000_000), key(), now);
  });
  add('GET', '/v1/market/sales/:vehicle', 'marketplace', { auth: false }, ({ params }) => store.saleHistory(vehicleParam(params[0]!)));
  add('GET', '/v1/wishlist', 'marketplace', {}, ({ account }) => store.wishlist(account!));
  add('PUT', '/v1/wishlist/:vehicle', 'marketplace', {}, ({ account, params }) => {
    store.setWishlist(account!, vehicleParam(params[0]!), true);
    return { ok: true };
  });
  add('DELETE', '/v1/wishlist/:vehicle', 'marketplace', {}, ({ account, params }) => {
    store.setWishlist(account!, vehicleParam(params[0]!), false);
    return { ok: true };
  });
  add('GET', '/v1/watchlist', 'marketplace', {}, ({ account }) => store.watchlist(account!));
  add('PUT', '/v1/watchlist/:id', 'marketplace', {}, ({ account, params }) => {
    store.setWatch(account!, str(params[0], 'listing', ID), true);
    return { ok: true };
  });
  add('DELETE', '/v1/watchlist/:id', 'marketplace', {}, ({ account, params }) => {
    store.setWatch(account!, str(params[0], 'listing', ID), false);
    return { ok: true };
  });

  // ── Progression ──
  add('GET', '/v1/achievements', 'economy', {}, ({ account }) => store.achievements(account!).map(({ rule: _r, ...a }) => a));
  add('POST', '/v1/achievements/:id/claim', 'economy', {}, ({ account, params, now }) => store.claimAchievement(account!, str(params[0], 'achievement', SLUG), now));
  add('GET', '/v1/seasons/:id', 'seasons', {}, ({ account, params }) => store.seasonProgress(account!, str(params[0], 'season', SLUG)));
  add('POST', '/v1/seasons/:id/tiers/:tier/claim', 'seasons', {}, async ({ account, params, body, now }) => {
    const b = await body();
    const track = b.track === 'premium' ? 'premium' : b.track === 'free' ? 'free' : null;
    if (!track) throw new RequestError(400, 'invalid_request', 'invalid track');
    return store.claimSeasonTier(account!, str(params[0], 'season', SLUG), int(Number(params[1]), 'tier', 1, 100), track, now);
  });
  add('POST', '/v1/cosmetics/:id/buy', 'economy', {}, ({ account, params, now }) => store.buyCosmetic(account!, str(params[0], 'cosmetic', SLUG), now));

  // ── Social ──
  add('PUT', '/v1/profile', 'social', {}, async ({ account, body, now }) => {
    const b = await body();
    const opt = (k: string) => (b[k] === undefined ? undefined : str(b[k], k, SLUG));
    return store.updateProfile(
      account!,
      {
        handle: b.handle === undefined ? undefined : b.handle === null ? null : String(b.handle),
        public: b.public === undefined ? undefined : b.public === true,
        showcase: b.showcase === undefined ? undefined : Array.isArray(b.showcase) ? b.showcase.map((x) => str(x, 'showcase', ID)) : [],
        environment: opt('environment'),
        scannerSkin: opt('scannerSkin'),
        frame: opt('frame'),
        title: opt('title'),
      },
      now,
    );
  });
  add('GET', '/v1/profiles/:handle', 'social', { auth: false }, ({ account, params }) => store.publicProfile(decodeURIComponent(params[0]!), account));
  add('POST', '/v1/blocks/:handle', 'social', {}, ({ account, params, now }) => {
    store.block(account!, decodeURIComponent(params[0]!), now);
    return { ok: true };
  });
  add('DELETE', '/v1/blocks/:handle', 'social', {}, ({ account, params }) => {
    store.unblock(account!, decodeURIComponent(params[0]!));
    return { ok: true };
  });
  add('POST', '/v1/reports', 'social', {}, async ({ account, body, now }) => {
    const b = await body();
    return { reportId: store.report(account!, String(b.handle ?? ''), String(b.reason ?? ''), now) };
  });

  // ── Subscriptions ──
  add('GET', '/v1/entitlements', 'economy', {}, ({ account, now }) => store.entitlement(account!, now));
  add('POST', '/v1/entitlements/verify', 'subscriptions', {}, async ({ account, body, now }) => {
    const b = await body();
    const platform = b.platform === 'apple' || b.platform === 'google' ? b.platform : null;
    if (!platform) throw new RequestError(400, 'invalid_request', 'invalid platform');
    const proof = typeof b.proof === 'string' && b.proof.length > 0 && b.proof.length < 16_000 ? b.proof : null;
    const productId = Object.values(BLACK_PRODUCTS).find((p) => p.id === b.productId)?.id;
    if (!proof || !productId) throw new RequestError(400, 'invalid_request', 'invalid purchase');
    const verified = await deps.billing[platform].verifyPurchase(proof, productId);
    store.upsertEntitlement(account!, verified, now);
    return store.entitlement(account!, now);
  });
  for (const platform of ['apple', 'google'] as const) {
    add('POST', `/v1/billing/${platform}/notifications`, 'subscriptions', { auth: false, write: false }, async ({ body, now }) => {
      const parsed = await deps.billing[platform].parseNotification(await body());
      if (parsed) store.updateEntitlementByTransaction(platform, parsed.originalTransactionId, parsed.state, parsed.expiresAt, now);
      return { ok: true };
    });
  }

  function bearer(req: IncomingMessage): string | null {
    const h = req.headers.authorization;
    const m = typeof h === 'string' ? /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(h) : null;
    return m ? m[1]! : null;
  }

  /** The account for a request with a valid bearer token, if any. */
  function accountFor(req: IncomingMessage, now: number): string | null {
    const token = bearer(req);
    return token ? store.authenticate(token, now) : null;
  }

  /** Handles an economy request, or returns null when no route matches. */
  async function handle(req: IncomingMessage, res: ServerResponse, path: string): Promise<number | null> {
    const candidates = routes.filter((r) => r.pattern.test(path));
    if (candidates.length === 0) return null;
    const route = candidates.find((r) => r.method === req.method);
    if (!route) {
      send(res, 405, { error: 'method_not_allowed' }, { Allow: [...new Set(candidates.map((r) => r.method))].join(', ') });
      return 405;
    }
    if (!deps.features.has(route.feature) || (route.feature !== 'economy' && !deps.features.has('economy'))) {
      send(res, 404, { error: 'feature_disabled' });
      return 404;
    }
    const now = deps.clock.now();
    try {
      const account = accountFor(req, now);
      if (route.auth && !account) throw new EconomyError(401, 'unauthorized');
      if (route.write && account) {
        const retry = deps.limits.hit(`acct:w:${account}`, deps.writesPerMinute, MINUTE, now);
        if (retry > 0) {
          send(res, 429, { error: 'rate_limited' }, { 'Retry-After': String(retry) });
          return 429;
        }
      }
      const params = route.pattern.exec(path)!.slice(1);
      const query = new URL(req.url ?? '/', 'http://local').searchParams;
      let parsed: Record<string, unknown> | null = null;
      const body = async () => {
        if (parsed) return parsed;
        if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) throw new RequestError(415, 'unsupported_media_type', 'JSON only');
        let value: unknown;
        try {
          value = JSON.parse((await readBody(req, MAX_BODY)) || '{}');
        } catch (e) {
          if (e instanceof RequestError) throw e;
          throw new RequestError(400, 'invalid_json', 'Body is not valid JSON');
        }
        if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new RequestError(400, 'invalid_request', 'object expected');
        parsed = value as Record<string, unknown>;
        return parsed;
      };
      const key = () => {
        const k = req.headers['idempotency-key'];
        if (typeof k !== 'string' || !IDEMPOTENCY_KEY.test(k)) throw new EconomyError(400, 'idempotency_key_required');
        return k;
      };
      const out = await route.handler({ req, account, params, query, body, key, now });
      send(res, 200, out ?? { ok: true });
      return 200;
    } catch (err) {
      if (err instanceof EconomyError || err instanceof RequestError) {
        const status = err instanceof EconomyError ? err.status : err.status;
        send(res, status, { error: err.code, ...(err.message !== err.code ? { message: err.message } : {}) });
        return status;
      }
      if (err instanceof BillingNotConfiguredError) {
        send(res, 503, { error: 'billing_not_configured' });
        return 503;
      }
      if (err instanceof BillingRejectedError) {
        send(res, 402, { error: 'purchase_not_verified' });
        return 402;
      }
      throw err;
    }
  }

  return { handle, accountFor };
}
