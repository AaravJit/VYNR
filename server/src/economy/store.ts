import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import { candidatesSupport, isRarity, type Rarity, rarityRank, type ServerCatalog, type ServerVehicle } from './catalog.ts';
import { type AchievementConfig, type CrateConfig, type EconomyConfig, inPool, oddsFor, poolVehicles } from './config.ts';
import { migrate, openEconomyDb } from './db.ts';

/** A failure the client should see, with an HTTP status and a stable code. */
export class EconomyError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message = code) {
    super(message);
    this.name = 'EconomyError';
    this.status = status;
    this.code = code;
  }
}

/** Source of randomness. Production uses node:crypto; tests inject a deterministic one. */
export interface Rng {
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}
export const cryptoRng: Rng = { int: (n) => randomInt(n) };

const DAY = 86_400_000;
const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);
const newId = (prefix: string) => `${prefix}_${randomBytes(12).toString('base64url')}`;
const hashToken = (token: string) => createHash('sha256').update(`vynr-token:${token}`).digest('hex');

export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,64}$/;
const HANDLE = /^[A-Za-z0-9_]{3,20}$/;
/** A small denylist for public handles; reports and moderation handle the rest. */
const HANDLE_DENY = /(admin|vynr|support|official|moderator|fuck|shit|cunt|nigg|fag|rape|nazi)/i;

export interface Collectible {
  id: string;
  vehicleId: string;
  serial: number;
  colour: string;
  edition: string;
  origin: 'discovered' | 'unboxed' | 'showroom';
  ownerId: string | null;
  acquiredAt: number;
  createdAt: number;
}

interface CollectibleRow {
  id: string;
  vehicle_id: string;
  serial: number;
  colour: string;
  edition: string;
  origin: Collectible['origin'];
  owner_id: string | null;
  acquired_at: number;
  created_at: number;
}

const toCollectible = (r: CollectibleRow): Collectible => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  serial: r.serial,
  colour: r.colour,
  edition: r.edition,
  origin: r.origin,
  ownerId: r.owner_id,
  acquiredAt: r.acquired_at,
  createdAt: r.created_at,
});

export interface Listing {
  id: string;
  collectibleId: string;
  vehicleId: string;
  rarity: Rarity;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  seller: string | null;
  createdAt: number;
}

export interface PublicSettings {
  handle: string | null;
  public: boolean;
  environment?: string;
  scannerSkin?: string;
  frame?: string;
  title?: string;
  showcase?: string[];
}

export interface StoreOptions {
  catalog: ServerCatalog;
  config: EconomyConfig;
  rng?: Rng;
}

/**
 * The authoritative economy. Every operation that moves VC or collectibles
 * runs inside one `BEGIN IMMEDIATE` transaction, so two requests (or two server
 * processes on one host sharing the file) can never both spend the same VC or
 * sell the same collectible. Clients send intentions (open this crate, buy this
 * listing at this price); prices, balances, outcomes and ownership are always
 * decided here.
 */
export class EconomyStore {
  readonly db: DatabaseSync;
  private readonly catalog: ServerCatalog;
  private readonly cfg: EconomyConfig;
  private readonly rng: Rng;

  constructor(path: string, opts: StoreOptions) {
    this.db = openEconomyDb(path);
    migrate(this.db);
    this.catalog = opts.catalog;
    this.cfg = opts.config;
    this.rng = opts.rng ?? cryptoRng;
  }

  close(): void {
    this.db.close();
  }

  get config(): EconomyConfig {
    return this.cfg;
  }

  private tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  /** Runs `fn` once per (account, key): a retry with the same key returns the first result unchanged. */
  private idempotent<T>(accountId: string, key: string, op: string, now: number, fn: () => T): T {
    if (!IDEMPOTENCY_KEY.test(key)) throw new EconomyError(400, 'invalid_idempotency_key');
    return this.tx(() => {
      const prior = this.db.prepare('SELECT op, response_json FROM idempotency WHERE account_id = ? AND key = ?').get(accountId, key) as
        | { op: string; response_json: string }
        | undefined;
      if (prior) {
        if (prior.op !== op) throw new EconomyError(409, 'idempotency_key_reused');
        return JSON.parse(prior.response_json) as T;
      }
      const out = fn();
      this.db
        .prepare('INSERT INTO idempotency (account_id, key, op, response_json, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(accountId, key, op, JSON.stringify(out), now);
      return out;
    });
  }

  private audit(accountId: string | null, action: string, ref: string | null, detail: Record<string, unknown>, now: number): void {
    this.db
      .prepare('INSERT INTO audit_events (account_id, action, ref, detail_json, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(accountId, action, ref, JSON.stringify(detail), now);
  }

  // ── Accounts ─────────────────────────────────────────────────────────

  /** Creates an anonymous account and returns its bearer token (shown once; only a hash is stored). */
  createAccount(now: number): { accountId: string; token: string } {
    const accountId = newId('acct');
    const token = randomBytes(32).toString('base64url');
    this.tx(() => {
      this.db.prepare('INSERT INTO accounts (id, created_at) VALUES (?, ?)').run(accountId, now);
      this.db.prepare('INSERT INTO wallets (account_id, balance) VALUES (?, 0)').run(accountId);
      this.db.prepare('INSERT INTO tokens (token_hash, account_id, created_at, last_used_at) VALUES (?, ?, ?, ?)').run(hashToken(token), accountId, now, now);
      for (const c of this.cfg.cosmetics.filter((x) => x.priceVc === 0)) {
        this.db.prepare("INSERT INTO owned_cosmetics (account_id, cosmetic_id, source, created_at) VALUES (?, ?, 'default', ?)").run(accountId, c.id, now);
      }
      this.audit(accountId, 'account.create', null, {}, now);
    });
    return { accountId, token };
  }

  authenticate(token: string, now: number): string | null {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    const row = this.db
      .prepare('SELECT t.account_id AS id, a.deleted_at AS deleted FROM tokens t JOIN accounts a ON a.id = t.account_id WHERE t.token_hash = ?')
      .get(hashToken(token)) as { id: string; deleted: number | null } | undefined;
    if (!row || row.deleted !== null) return null;
    this.db.prepare('UPDATE tokens SET last_used_at = ? WHERE token_hash = ? AND last_used_at < ?').run(now, hashToken(token), now - 60_000);
    return row.id;
  }

  accountCreatedAt(accountId: string): number {
    const row = this.db.prepare('SELECT created_at FROM accounts WHERE id = ?').get(accountId) as { created_at: number } | undefined;
    if (!row) throw new EconomyError(404, 'account_not_found');
    return row.created_at;
  }

  /**
   * Deletes an account: tokens, profile, discoveries, wishlist and reports by
   * the player are removed; collectibles are burned and listings cancelled; the
   * wallet is emptied. Ledger and ownership rows keep only the random account
   * id (no personal data) so other players' provenance stays consistent.
   */
  deleteAccount(accountId: string, now: number): void {
    this.tx(() => {
      const balance = this.balanceOf(accountId);
      if (balance > 0) this.move(accountId, -balance, 'account_deleted', null, now);
      this.db.prepare("UPDATE listings SET status = 'cancelled', closed_at = ? WHERE seller_id = ? AND status = 'active'").run(now, accountId);
      const owned = this.db.prepare('SELECT id FROM collectibles WHERE owner_id = ?').all(accountId) as { id: string }[];
      for (const { id } of owned) {
        this.db.prepare('UPDATE collectibles SET owner_id = NULL, burned_at = ? WHERE id = ?').run(now, id);
        this.db
          .prepare("INSERT INTO ownership_events (collectible_id, from_account, to_account, kind, created_at) VALUES (?, ?, NULL, 'account_deleted', ?)")
          .run(id, accountId, now);
      }
      for (const sql of [
        'DELETE FROM tokens WHERE account_id = ?',
        'DELETE FROM recognitions WHERE account_id = ?',
        'DELETE FROM discoveries WHERE account_id = ?',
        'DELETE FROM wishlist WHERE account_id = ?',
        'DELETE FROM watchlist WHERE account_id = ?',
        'DELETE FROM blocks WHERE account_id = ? OR blocked_id = ?',
        'DELETE FROM reports WHERE reporter_id = ?',
        'DELETE FROM idempotency WHERE account_id = ?',
        'DELETE FROM season_progress WHERE account_id = ?',
        'DELETE FROM owned_cosmetics WHERE account_id = ?',
      ]) {
        const n = (sql.match(/\?/g) ?? []).length;
        this.db.prepare(sql).run(...Array(n).fill(accountId));
      }
      this.db.prepare("UPDATE accounts SET deleted_at = ?, handle = NULL, public_profile = 0, profile_json = '{}' WHERE id = ?").run(now, accountId);
      this.audit(accountId, 'account.delete', null, {}, now);
    });
  }

  /** Everything the server holds about one account, for a data export request. */
  exportAccount(accountId: string): Record<string, unknown> {
    const q = (sql: string, ...args: (string | number)[]) => this.db.prepare(sql).all(...args);
    return {
      account: this.db.prepare('SELECT id, created_at, handle, public_profile, profile_json FROM accounts WHERE id = ?').get(accountId),
      balance: this.balanceOf(accountId),
      ledger: q('SELECT delta, balance_after, reason, ref, created_at FROM ledger WHERE account_id = ? ORDER BY id', accountId),
      discoveries: q('SELECT vehicle_id, first, rewarded_vc, xp, created_at FROM discoveries WHERE account_id = ? ORDER BY created_at', accountId),
      collectibles: q('SELECT * FROM collectibles WHERE owner_id = ?', accountId),
      listings: q('SELECT id, collectible_id, price, status, created_at, closed_at FROM listings WHERE seller_id = ?', accountId),
      purchases: q('SELECT id, collectible_id, price, closed_at FROM listings WHERE buyer_id = ?', accountId),
      crateOpenings: q('SELECT crate_id, price, collectible_id, rarity, pity_applied, created_at FROM crate_openings WHERE account_id = ?', accountId),
      cosmetics: q('SELECT cosmetic_id, source, created_at FROM owned_cosmetics WHERE account_id = ?', accountId),
      entitlements: q('SELECT platform, environment, product_id, state, expires_at, updated_at FROM entitlements WHERE account_id = ?', accountId),
      wishlist: q('SELECT vehicle_id FROM wishlist WHERE account_id = ?', accountId),
      blocks: q('SELECT blocked_id, created_at FROM blocks WHERE account_id = ?', accountId),
    };
  }

  // ── Wallet ───────────────────────────────────────────────────────────

  balanceOf(accountId: string): number {
    const row = this.db.prepare('SELECT balance FROM wallets WHERE account_id = ?').get(accountId) as { balance: number } | undefined;
    if (!row) throw new EconomyError(404, 'account_not_found');
    return row.balance;
  }

  /** The only way VC moves. Must run inside a transaction. Throws if the balance would go negative. */
  private move(accountId: string, delta: number, reason: string, ref: string | null, now: number): number {
    if (!Number.isSafeInteger(delta) || delta === 0) throw new Error('invalid delta');
    const balance = this.balanceOf(accountId);
    const after = balance + delta;
    if (after < 0) throw new EconomyError(402, 'insufficient_vc');
    this.db.prepare('UPDATE wallets SET balance = ? WHERE account_id = ?').run(after, accountId);
    this.db
      .prepare('INSERT INTO ledger (account_id, delta, balance_after, reason, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(accountId, delta, after, reason, ref, now);
    return after;
  }

  /**
   * Operator-only credit (support compensation, simulations). Never reachable
   * from the public API; every use is audited.
   */
  operatorGrant(accountId: string, amount: number, reason: string, now: number): number {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('invalid amount');
    return this.tx(() => {
      const balance = this.move(accountId, amount, 'operator_grant', reason, now);
      this.audit(accountId, 'operator.grant', null, { amount, reason }, now);
      return balance;
    });
  }

  ledger(accountId: string, limit = 50, beforeId?: number) {
    const rows = this.db
      .prepare(
        `SELECT id, delta, balance_after AS balanceAfter, reason, ref, created_at AS createdAt FROM ledger
         WHERE account_id = ? AND id < ? ORDER BY id DESC LIMIT ?`,
      )
      .all(accountId, beforeId ?? Number.MAX_SAFE_INTEGER, Math.min(100, Math.max(1, limit)));
    return rows;
  }

  // ── Collectibles ─────────────────────────────────────────────────────

  private mint(vehicle: ServerVehicle, ownerId: string, origin: Collectible['origin'], edition: string, now: number): Collectible {
    const next = this.db.prepare('SELECT COALESCE(MAX(serial), 0) + 1 AS n FROM collectibles WHERE vehicle_id = ?').get(vehicle.id) as {
      n: number;
    };
    const c: Collectible = {
      id: newId('vc'),
      vehicleId: vehicle.id,
      serial: next.n,
      colour: this.cfg.colours[this.rng.int(this.cfg.colours.length)]!,
      edition,
      origin,
      ownerId,
      acquiredAt: now,
      createdAt: now,
    };
    this.db
      .prepare(
        'INSERT INTO collectibles (id, vehicle_id, serial, colour, edition, origin, owner_id, acquired_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(c.id, c.vehicleId, c.serial, c.colour, c.edition, c.origin, ownerId, now, now);
    this.db
      .prepare('INSERT INTO ownership_events (collectible_id, from_account, to_account, kind, created_at) VALUES (?, NULL, ?, ?, ?)')
      .run(c.id, ownerId, origin, now);
    return c;
  }

  private collectibleRow(id: string): CollectibleRow | undefined {
    return this.db.prepare('SELECT * FROM collectibles WHERE id = ? AND burned_at IS NULL').get(id) as CollectibleRow | undefined;
  }

  inventory(accountId: string): Collectible[] {
    return (this.db.prepare('SELECT * FROM collectibles WHERE owner_id = ? ORDER BY acquired_at DESC').all(accountId) as unknown as CollectibleRow[]).map(
      toCollectible,
    );
  }

  /** A collectible with its public provenance. Owners are shown by public handle only, or as "Private collector". */
  provenance(collectibleId: string) {
    const row = this.db.prepare('SELECT * FROM collectibles WHERE id = ?').get(collectibleId) as CollectibleRow | undefined;
    if (!row) throw new EconomyError(404, 'collectible_not_found');
    const events = this.db
      .prepare(
        `SELECT e.kind, e.price, e.created_at AS at,
           CASE WHEN a.public_profile = 1 THEN a.handle ELSE NULL END AS toHandle
         FROM ownership_events e LEFT JOIN accounts a ON a.id = e.to_account
         WHERE e.collectible_id = ? ORDER BY e.id`,
      )
      .all(collectibleId);
    const { ownerId: _owner, ...pub } = toCollectible(row);
    return { collectible: { ...pub, burned: row.owner_id === null }, history: events };
  }

  /** Removes a collectible from circulation for a small VC refund. The discovery record is never touched. */
  scrap(accountId: string, collectibleId: string, key: string, now: number) {
    return this.idempotent(accountId, key, 'scrap', now, () => {
      const row = this.collectibleRow(collectibleId);
      if (!row || row.owner_id !== accountId) throw new EconomyError(404, 'collectible_not_found');
      if (this.activeListingFor(collectibleId)) throw new EconomyError(409, 'listed');
      const vehicle = this.catalog.vehicle(row.vehicle_id)!;
      const refund = this.cfg.scrapVc[vehicle.rarity];
      this.db.prepare('UPDATE collectibles SET owner_id = NULL, burned_at = ? WHERE id = ?').run(now, collectibleId);
      this.db
        .prepare("INSERT INTO ownership_events (collectible_id, from_account, to_account, kind, created_at) VALUES (?, ?, NULL, 'scrapped', ?)")
        .run(collectibleId, accountId, now);
      const balance = this.move(accountId, refund, 'scrap', collectibleId, now);
      this.audit(accountId, 'collectible.scrap', collectibleId, { refund }, now);
      return { refund, balance };
    });
  }

  // ── Discoveries ──────────────────────────────────────────────────────

  /** Stores the candidates of a cloud answer so a discovery can later be checked against it. */
  recordRecognition(accountId: string, candidates: { make: string; model: string; confidence: number }[], now: number): string {
    const id = newId('rec');
    this.db
      .prepare('INSERT INTO recognitions (id, account_id, candidates_json, created_at) VALUES (?, ?, ?, ?)')
      .run(id, accountId, JSON.stringify(candidates.map((c) => ({ make: c.make, model: c.model, confidence: c.confidence }))), now);
    return id;
  }

  /**
   * Records a verified discovery: the player chose a catalog vehicle that a
   * recent cloud answer, made for this account, supports. Rewards are decided
   * here, with daily and per-vehicle limits so repeated scans cannot farm VC.
   * A collectible is minted for the first discovery of a vehicle; repeat
   * sightings mint again only for rarer vehicles, at most once a week each.
   */
  claimDiscovery(accountId: string, recognitionId: string, vehicleId: string, now: number) {
    const vehicle = this.catalog.vehicle(vehicleId);
    if (!vehicle) throw new EconomyError(400, 'unknown_vehicle');
    return this.tx(() => {
      const rec = this.db.prepare('SELECT account_id, candidates_json, created_at, claimed FROM recognitions WHERE id = ?').get(recognitionId) as
        | { account_id: string; candidates_json: string; created_at: number; claimed: number }
        | undefined;
      if (!rec || rec.account_id !== accountId) throw new EconomyError(404, 'recognition_not_found');
      if (rec.claimed) throw new EconomyError(409, 'already_claimed');
      if (now - rec.created_at > this.cfg.claimWindowMs) throw new EconomyError(410, 'claim_expired');
      const candidates = JSON.parse(rec.candidates_json) as { make: string; model: string; confidence: number }[];
      if (!candidatesSupport(this.catalog, vehicle, candidates)) throw new EconomyError(422, 'not_supported_by_recognition');
      this.db.prepare('UPDATE recognitions SET claimed = 1 WHERE id = ?').run(recognitionId);

      const day = utcDay(now);
      const prior = this.db.prepare('SELECT COUNT(*) AS n FROM discoveries WHERE account_id = ? AND vehicle_id = ?').get(accountId, vehicleId) as {
        n: number;
      };
      const first = prior.n === 0;
      const rewardedToday = this.db
        .prepare('SELECT COUNT(*) AS n FROM discoveries WHERE account_id = ? AND day = ? AND rewarded_vc > 0')
        .get(accountId, day) as { n: number };
      const repeatsToday = this.db
        .prepare('SELECT COUNT(*) AS n FROM discoveries WHERE account_id = ? AND vehicle_id = ? AND day = ? AND first = 0 AND rewarded_vc > 0')
        .get(accountId, vehicleId, day) as { n: number };
      const underDaily = rewardedToday.n < this.cfg.dailyRewardedDiscoveries;
      const reward = !underDaily
        ? 0
        : first
          ? this.cfg.discoveryVc[vehicle.rarity]
          : repeatsToday.n < this.cfg.dailyRepeatsPerVehicle
            ? this.cfg.repeatDiscoveryVc[vehicle.rarity]
            : 0;
      const xp = underDaily ? this.cfg.discoveryXp[vehicle.rarity] * (first ? 1 : 0.25) : 0;

      const id = newId('disc');
      this.db
        .prepare(
          'INSERT INTO discoveries (id, account_id, vehicle_id, recognition_id, first, rewarded_vc, xp, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(id, accountId, vehicleId, recognitionId, first ? 1 : 0, reward, Math.round(xp), day, now);
      const balance = reward > 0 ? this.move(accountId, reward, first ? 'discovery' : 'repeat_discovery', id, now) : this.balanceOf(accountId);

      let mintRepeat = false;
      if (!first && rarityRank(vehicle.rarity) >= rarityRank(this.cfg.repeatMint.minRarity)) {
        const recent = this.db
          .prepare(
            `SELECT COUNT(*) AS n FROM collectibles c JOIN ownership_events e ON e.collectible_id = c.id AND e.kind = 'discovered'
             WHERE e.to_account = ? AND c.vehicle_id = ? AND e.created_at > ?`,
          )
          .get(accountId, vehicleId, now - this.cfg.repeatMint.cooldownDays * DAY) as { n: number };
        mintRepeat = recent.n === 0;
      }
      const collectible = first || mintRepeat ? this.mint(vehicle, accountId, 'discovered', 'standard', now) : null;

      // Season XP: doubled for vehicles matching the season theme.
      for (const s of this.activeSeasons(now)) {
        const seasonXp = Math.round(xp * (inPool(this.catalog, vehicle, s.theme) ? 2 : 1));
        if (seasonXp > 0) {
          this.db
            .prepare(
              'INSERT INTO season_progress (account_id, season_id, xp) VALUES (?, ?, ?) ON CONFLICT(account_id, season_id) DO UPDATE SET xp = xp + excluded.xp',
            )
            .run(accountId, s.id, seasonXp);
        }
      }
      this.audit(accountId, 'discovery.claim', id, { vehicleId, first, reward }, now);
      return { discoveryId: id, vehicleId, first, rewardVc: reward, xp: Math.round(xp), balance, collectible };
    });
  }

  /** Verified discovery history. Selling or scrapping a collectible never removes a discovery. */
  discoveries(accountId: string) {
    return this.db
      .prepare('SELECT id, vehicle_id AS vehicleId, first, rewarded_vc AS rewardVc, xp, created_at AS createdAt FROM discoveries WHERE account_id = ? ORDER BY created_at DESC')
      .all(accountId);
  }

  stats(accountId: string) {
    const rows = this.db.prepare('SELECT vehicle_id, xp FROM discoveries WHERE account_id = ?').all(accountId) as { vehicle_id: string; xp: number }[];
    const vehicles = new Set(rows.map((r) => r.vehicle_id));
    const makes = new Set([...vehicles].map((v) => this.catalog.vehicle(v)?.manufacturerId));
    const countries = new Set([...vehicles].map((v) => this.catalog.countryOf(this.catalog.vehicle(v)!)));
    const owned = this.inventory(accountId);
    return {
      discoveries: rows.length,
      distinctVehicles: vehicles.size,
      distinctMakes: makes.size,
      distinctCountries: countries.size,
      xp: rows.reduce((a, r) => a + r.xp, 0),
      discoveredRarities: [...new Set([...vehicles].map((v) => this.catalog.vehicle(v)!.rarity))],
      owned: owned.length,
      ownedDistinctVehicles: new Set(owned.map((c) => c.vehicleId)).size,
      ownedDistinctMakes: new Set(owned.map((c) => this.catalog.vehicle(c.vehicleId)?.manufacturerId)).size,
      catalogSize: this.catalog.vehicles.length,
    };
  }

  // ── Crates ───────────────────────────────────────────────────────────

  crate(crateId: string, now: number): CrateConfig {
    const c = this.cfg.crates.find((x) => x.id === crateId);
    if (!c || !c.enabled) throw new EconomyError(404, 'crate_not_found');
    if ((c.availableFrom !== null && now < c.availableFrom) || (c.availableUntil !== null && now >= c.availableUntil)) {
      throw new EconomyError(409, 'crate_unavailable');
    }
    return c;
  }

  /** Openings of this crate since the player last received `minRarity` or better from it. */
  private sincePity(accountId: string, c: CrateConfig): number {
    if (!c.pity) return 0;
    const rows = this.db
      .prepare('SELECT rarity FROM crate_openings WHERE account_id = ? AND crate_id = ? ORDER BY created_at DESC, rowid DESC')
      .all(accountId, c.id) as { rarity: string }[];
    let n = 0;
    for (const r of rows) {
      if (isRarity(r.rarity) && rarityRank(r.rarity) >= rarityRank(c.pity.minRarity)) break;
      n++;
    }
    return n;
  }

  pityStatus(accountId: string, crateId: string) {
    const c = this.cfg.crates.find((x) => x.id === crateId);
    if (!c?.pity) return null;
    return { minRarity: c.pity.minRarity, after: c.pity.after, openedSince: this.sincePity(accountId, c) };
  }

  private draw(c: CrateConfig, pity: boolean): ServerVehicle {
    const odds = oddsFor(this.catalog, c);
    let rarities = odds.rarities;
    if (pity && c.pity) rarities = rarities.filter((r) => rarityRank(r.rarity) >= rarityRank(c.pity!.minRarity));
    // Integer weights in parts per million keep the draw exact and auditable.
    const weights = rarities.map((r) => Math.round(r.probability * 1e6));
    let roll = this.rng.int(weights.reduce((a, b) => a + b, 0));
    let rarity = rarities[rarities.length - 1]!.rarity;
    for (let i = 0; i < rarities.length; i++) {
      if (roll < weights[i]!) {
        rarity = rarities[i]!.rarity;
        break;
      }
      roll -= weights[i]!;
    }
    const pool = poolVehicles(this.catalog, c.pool).filter((v) => v.rarity === rarity);
    return pool[this.rng.int(pool.length)]!;
  }

  /**
   * Opens a crate: deducts VC, draws on the server, mints the collectible and
   * records the opening in one transaction. Retrying with the same idempotency
   * key (after a dropped connection or an app crash) returns the same result
   * instead of charging again.
   */
  openCrate(accountId: string, crateId: string, key: string, now: number) {
    return this.idempotent(accountId, key, `crate:${crateId}`, now, () => {
      const c = this.crate(crateId, now);
      this.move(accountId, -c.priceVc, 'crate', crateId, now);
      const pity = !!c.pity && this.sincePity(accountId, c) >= c.pity.after - 1;
      const vehicle = this.draw(c, pity);
      const collectible = this.mint(vehicle, accountId, 'unboxed', c.edition ?? 'standard', now);
      const openingId = newId('open');
      this.db
        .prepare(
          'INSERT INTO crate_openings (id, account_id, crate_id, price, collectible_id, rarity, pity_applied, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(openingId, accountId, crateId, c.priceVc, collectible.id, vehicle.rarity, pity ? 1 : 0, now);
      const duplicate =
        (this.db.prepare('SELECT COUNT(*) AS n FROM collectibles WHERE owner_id = ? AND vehicle_id = ?').get(accountId, vehicle.id) as { n: number }).n > 1;
      this.audit(accountId, 'crate.open', openingId, { crateId, vehicleId: vehicle.id, rarity: vehicle.rarity, pity }, now);
      return { openingId, crateId, collectible, rarity: vehicle.rarity, pityApplied: pity, duplicate, balance: this.balanceOf(accountId) };
    });
  }

  /** Openings the client has not acknowledged yet, so an interrupted reveal can be shown again. */
  unseenOpenings(accountId: string) {
    return this.db
      .prepare(
        `SELECT o.id AS openingId, o.crate_id AS crateId, o.rarity, o.pity_applied AS pityApplied, o.created_at AS createdAt, c.vehicle_id AS vehicleId, c.id AS collectibleId
         FROM crate_openings o JOIN collectibles c ON c.id = o.collectible_id WHERE o.account_id = ? AND o.seen = 0 ORDER BY o.created_at`,
      )
      .all(accountId);
  }

  markOpeningSeen(accountId: string, openingId: string): void {
    this.db.prepare('UPDATE crate_openings SET seen = 1 WHERE id = ? AND account_id = ?').run(openingId, accountId);
  }

  /** The deterministic alternative to crates: buy the exact vehicle you want at a fixed price. */
  buyShowroom(accountId: string, vehicleId: string, key: string, now: number) {
    const vehicle = this.catalog.vehicle(vehicleId);
    if (!vehicle) throw new EconomyError(400, 'unknown_vehicle');
    return this.idempotent(accountId, key, `showroom:${vehicleId}`, now, () => {
      const price = this.cfg.showroomVc[vehicle.rarity];
      this.move(accountId, -price, 'showroom', vehicleId, now);
      const collectible = this.mint(vehicle, accountId, 'showroom', 'standard', now);
      this.audit(accountId, 'showroom.buy', collectible.id, { vehicleId, price }, now);
      return { collectible, price, balance: this.balanceOf(accountId) };
    });
  }

  // ── Marketplace ──────────────────────────────────────────────────────

  private activeListingFor(collectibleId: string): { id: string } | undefined {
    return this.db.prepare("SELECT id FROM listings WHERE collectible_id = ? AND status = 'active'").get(collectibleId) as { id: string } | undefined;
  }

  /** Trading needs a few verified discoveries and a day of account age, which makes throwaway farming accounts expensive. */
  tradeEligibility(accountId: string, now: number): { eligible: boolean; reason: string | null } {
    const age = now - this.accountCreatedAt(accountId);
    const found = (this.db.prepare('SELECT COUNT(*) AS n FROM discoveries WHERE account_id = ?').get(accountId) as { n: number }).n;
    if (age < DAY) return { eligible: false, reason: 'account_too_new' };
    if (found < 3) return { eligible: false, reason: 'needs_discoveries' };
    return { eligible: true, reason: null };
  }

  private requireTrader(accountId: string, now: number): void {
    const e = this.tradeEligibility(accountId, now);
    if (!e.eligible) throw new EconomyError(403, e.reason!);
  }

  createListing(accountId: string, collectibleId: string, price: number, key: string, now: number) {
    return this.idempotent(accountId, key, `list:${collectibleId}`, now, () => {
      this.requireTrader(accountId, now);
      const row = this.collectibleRow(collectibleId);
      if (!row || row.owner_id !== accountId) throw new EconomyError(404, 'collectible_not_found');
      const vehicle = this.catalog.vehicle(row.vehicle_id)!;
      const bounds = this.cfg.market.priceBounds[vehicle.rarity];
      if (!Number.isSafeInteger(price) || price < bounds.min || price > bounds.max) {
        throw new EconomyError(422, 'price_out_of_bounds', `Price must be between ${bounds.min} and ${bounds.max} VC`);
      }
      if (now - row.acquired_at < this.cfg.market.tradeHoldMs) throw new EconomyError(409, 'trade_hold');
      if (this.activeListingFor(collectibleId)) throw new EconomyError(409, 'already_listed');
      const active = (this.db.prepare("SELECT COUNT(*) AS n FROM listings WHERE seller_id = ? AND status = 'active'").get(accountId) as { n: number }).n;
      if (active >= this.cfg.market.maxActiveListings) throw new EconomyError(429, 'too_many_listings');
      const today = (this.db.prepare('SELECT COUNT(*) AS n FROM listings WHERE seller_id = ? AND created_at >= ?').get(accountId, now - DAY) as { n: number }).n;
      if (today >= this.cfg.market.maxListingsPerDay) throw new EconomyError(429, 'listing_rate_limited');
      const id = newId('lst');
      this.db
        .prepare(
          "INSERT INTO listings (id, collectible_id, seller_id, vehicle_id, rarity, price, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)",
        )
        .run(id, collectibleId, accountId, vehicle.id, vehicle.rarity, price, now);
      this.audit(accountId, 'market.list', id, { collectibleId, price }, now);
      return { listingId: id, price, fee: this.fee(price) };
    });
  }

  fee(price: number): number {
    return Math.ceil(price * this.cfg.market.feeRate);
  }

  cancelListing(accountId: string, listingId: string, now: number): void {
    this.tx(() => {
      const r = this.db.prepare("UPDATE listings SET status = 'cancelled', closed_at = ? WHERE id = ? AND seller_id = ? AND status = 'active'").run(
        now,
        listingId,
        accountId,
      );
      if (r.changes !== 1) throw new EconomyError(404, 'listing_not_found');
      this.audit(accountId, 'market.cancel', listingId, {}, now);
    });
  }

  /**
   * Buys a listing at the price the buyer saw. Everything happens in one
   * transaction: the listing must still be active, the buyer cannot be the
   * seller, VC moves from buyer to seller minus the burned fee, and ownership
   * transfers. Two buyers racing for one listing: exactly one succeeds.
   */
  buyListing(accountId: string, listingId: string, expectedPrice: number, key: string, now: number) {
    return this.idempotent(accountId, key, `buy:${listingId}`, now, () => {
      this.requireTrader(accountId, now);
      const l = this.db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId) as
        | { id: string; collectible_id: string; seller_id: string; vehicle_id: string; price: number; status: string }
        | undefined;
      if (!l || l.status !== 'active') throw new EconomyError(409, 'listing_unavailable');
      if (l.price !== expectedPrice) throw new EconomyError(409, 'price_changed');
      if (l.seller_id === accountId) throw new EconomyError(403, 'own_listing');
      if (this.isBlockedEitherWay(accountId, l.seller_id)) throw new EconomyError(403, 'blocked');
      const row = this.collectibleRow(l.collectible_id);
      if (!row || row.owner_id !== l.seller_id) throw new EconomyError(409, 'listing_unavailable');

      const fee = this.fee(l.price);
      this.move(accountId, -l.price, 'market_purchase', listingId, now);
      this.move(l.seller_id, l.price - fee, 'market_sale', listingId, now);
      this.db.prepare('UPDATE collectibles SET owner_id = ?, acquired_at = ? WHERE id = ?').run(accountId, now, l.collectible_id);
      this.db
        .prepare("INSERT INTO ownership_events (collectible_id, from_account, to_account, kind, price, created_at) VALUES (?, ?, ?, 'sale', ?, ?)")
        .run(l.collectible_id, l.seller_id, accountId, l.price, now);
      this.db.prepare("UPDATE listings SET status = 'sold', buyer_id = ?, closed_at = ? WHERE id = ?").run(accountId, now, listingId);
      this.db
        .prepare('INSERT INTO sales (listing_id, collectible_id, vehicle_id, price, fee, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(listingId, l.collectible_id, l.vehicle_id, l.price, fee, now);
      this.db.prepare('DELETE FROM watchlist WHERE listing_id = ?').run(listingId);
      this.audit(accountId, 'market.buy', listingId, { price: l.price, fee, seller: l.seller_id }, now);
      return { listingId, collectibleId: l.collectible_id, price: l.price, fee, balance: this.balanceOf(accountId) };
    });
  }

  searchListings(
    viewer: string | null,
    q: { make?: string; vehicleId?: string; rarity?: Rarity; sort?: 'price_asc' | 'price_desc' | 'newest'; limit?: number; offset?: number },
  ): Listing[] {
    const where = ["l.status = 'active'"];
    const args: (string | number)[] = [];
    if (q.vehicleId) {
      where.push('l.vehicle_id = ?');
      args.push(q.vehicleId);
    }
    if (q.rarity) {
      where.push('l.rarity = ?');
      args.push(q.rarity);
    }
    if (q.make) {
      const ids = this.catalog.vehicles.filter((v) => v.manufacturerId === q.make).map((v) => v.id);
      if (ids.length === 0) return [];
      where.push(`l.vehicle_id IN (${ids.map(() => '?').join(',')})`);
      args.push(...ids);
    }
    if (viewer) {
      where.push('l.seller_id NOT IN (SELECT blocked_id FROM blocks WHERE account_id = ?) AND l.seller_id NOT IN (SELECT account_id FROM blocks WHERE blocked_id = ?)');
      args.push(viewer, viewer);
    }
    const order = q.sort === 'price_desc' ? 'l.price DESC' : q.sort === 'newest' ? 'l.created_at DESC' : 'l.price ASC';
    const rows = this.db
      .prepare(
        `SELECT l.id, l.collectible_id, l.vehicle_id, l.rarity, l.price, l.status, l.created_at, l.seller_id,
           CASE WHEN a.public_profile = 1 THEN a.handle ELSE NULL END AS seller_handle
         FROM listings l JOIN accounts a ON a.id = l.seller_id
         WHERE ${where.join(' AND ')} ORDER BY ${order}, l.id LIMIT ? OFFSET ?`,
      )
      .all(...args, Math.min(50, Math.max(1, q.limit ?? 20)), Math.max(0, q.offset ?? 0)) as {
      id: string;
      collectible_id: string;
      vehicle_id: string;
      rarity: Rarity;
      price: number;
      status: Listing['status'];
      created_at: number;
      seller_id: string;
      seller_handle: string | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      collectibleId: r.collectible_id,
      vehicleId: r.vehicle_id,
      rarity: r.rarity,
      price: r.price,
      status: r.status,
      seller: r.seller_handle,
      createdAt: r.created_at,
    }));
  }

  saleHistory(vehicleId: string, limit = 20) {
    return this.db
      .prepare('SELECT price, created_at AS createdAt FROM sales WHERE vehicle_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(vehicleId, Math.min(100, limit));
  }

  setWishlist(accountId: string, vehicleId: string, on: boolean): void {
    if (!this.catalog.vehicle(vehicleId)) throw new EconomyError(400, 'unknown_vehicle');
    if (on) this.db.prepare('INSERT OR IGNORE INTO wishlist (account_id, vehicle_id) VALUES (?, ?)').run(accountId, vehicleId);
    else this.db.prepare('DELETE FROM wishlist WHERE account_id = ? AND vehicle_id = ?').run(accountId, vehicleId);
  }

  wishlist(accountId: string): string[] {
    return (this.db.prepare('SELECT vehicle_id FROM wishlist WHERE account_id = ?').all(accountId) as { vehicle_id: string }[]).map((r) => r.vehicle_id);
  }

  setWatch(accountId: string, listingId: string, on: boolean): void {
    if (on) {
      const l = this.db.prepare("SELECT id FROM listings WHERE id = ? AND status = 'active'").get(listingId);
      if (!l) throw new EconomyError(404, 'listing_not_found');
      const n = (this.db.prepare('SELECT COUNT(*) AS n FROM watchlist WHERE account_id = ?').get(accountId) as { n: number }).n;
      if (n >= 100) throw new EconomyError(429, 'watchlist_full');
      this.db.prepare('INSERT OR IGNORE INTO watchlist (account_id, listing_id) VALUES (?, ?)').run(accountId, listingId);
    } else {
      this.db.prepare('DELETE FROM watchlist WHERE account_id = ? AND listing_id = ?').run(accountId, listingId);
    }
  }

  watchlist(accountId: string): string[] {
    return (this.db.prepare('SELECT listing_id FROM watchlist WHERE account_id = ?').all(accountId) as { listing_id: string }[]).map((r) => r.listing_id);
  }

  // ── Achievements, seasons, cosmetics ─────────────────────────────────

  private meets(accountId: string, a: AchievementConfig): boolean {
    const s = this.stats(accountId);
    const r = a.rule;
    switch (r.kind) {
      case 'discoveries':
        return s.discoveries >= r.count;
      case 'distinct_vehicles':
        return s.distinctVehicles >= r.count;
      case 'distinct_makes':
        return s.distinctMakes >= r.count;
      case 'distinct_countries':
        return s.distinctCountries >= r.count;
      case 'discovered_rarity':
        return s.discoveredRarities.some((x) => rarityRank(x) >= rarityRank(r.rarity));
      case 'owned':
        return s.owned >= r.count;
      case 'owned_distinct_makes':
        return s.ownedDistinctMakes >= r.count;
      case 'pool_complete': {
        const owned = new Set(this.inventory(accountId).map((c) => c.vehicleId));
        const pool = poolVehicles(this.catalog, r.pool);
        return pool.length > 0 && pool.every((v) => owned.has(v.id));
      }
    }
  }

  achievements(accountId: string) {
    const claimed = new Set(
      (this.db.prepare('SELECT achievement_id FROM achievement_claims WHERE account_id = ?').all(accountId) as { achievement_id: string }[]).map(
        (r) => r.achievement_id,
      ),
    );
    return this.cfg.achievements.map((a) => ({ ...a, claimed: claimed.has(a.id), complete: claimed.has(a.id) || this.meets(accountId, a) }));
  }

  claimAchievement(accountId: string, achievementId: string, now: number) {
    const a = this.cfg.achievements.find((x) => x.id === achievementId);
    if (!a) throw new EconomyError(404, 'achievement_not_found');
    return this.tx(() => {
      if (!this.meets(accountId, a)) throw new EconomyError(409, 'not_complete');
      const r = this.db
        .prepare('INSERT OR IGNORE INTO achievement_claims (account_id, achievement_id, created_at) VALUES (?, ?, ?)')
        .run(accountId, a.id, now);
      if (r.changes !== 1) throw new EconomyError(409, 'already_claimed');
      const balance = a.rewardVc > 0 ? this.move(accountId, a.rewardVc, 'achievement', a.id, now) : this.balanceOf(accountId);
      return { achievementId: a.id, rewardVc: a.rewardVc, balance };
    });
  }

  activeSeasons(now: number) {
    return this.cfg.seasons.filter((s) => now >= s.startsAt && now < s.endsAt);
  }

  seasonProgress(accountId: string, seasonId: string) {
    const s = this.cfg.seasons.find((x) => x.id === seasonId);
    if (!s) throw new EconomyError(404, 'season_not_found');
    const xp = (this.db.prepare('SELECT xp FROM season_progress WHERE account_id = ? AND season_id = ?').get(accountId, seasonId) as { xp: number } | undefined)
      ?.xp ?? 0;
    const claims = this.db.prepare('SELECT tier, track FROM season_claims WHERE account_id = ? AND season_id = ?').all(accountId, seasonId) as {
      tier: number;
      track: string;
    }[];
    return { season: s, xp, claims };
  }

  /** Claims a season tier reward. Premium (VYNR Black) tiers give cosmetics only. */
  claimSeasonTier(accountId: string, seasonId: string, tier: number, track: 'free' | 'premium', now: number) {
    const s = this.cfg.seasons.find((x) => x.id === seasonId);
    const t = s?.tiers.find((x) => x.tier === tier);
    if (!s || !t) throw new EconomyError(404, 'tier_not_found');
    const reward = track === 'free' ? t.free : t.premium;
    if (!reward) throw new EconomyError(404, 'tier_not_found');
    if (track === 'premium' && !this.hasBlack(accountId, now)) throw new EconomyError(403, 'black_required');
    return this.tx(() => {
      const { xp } = this.seasonProgress(accountId, seasonId);
      if (xp < t.xp) throw new EconomyError(409, 'not_enough_xp');
      const r = this.db
        .prepare('INSERT OR IGNORE INTO season_claims (account_id, season_id, tier, track, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(accountId, seasonId, tier, track, now);
      if (r.changes !== 1) throw new EconomyError(409, 'already_claimed');
      if ('vc' in reward && reward.vc) this.move(accountId, reward.vc, 'season', `${seasonId}:${tier}`, now);
      if (reward.cosmetic) {
        this.db
          .prepare("INSERT OR IGNORE INTO owned_cosmetics (account_id, cosmetic_id, source, created_at) VALUES (?, ?, 'season', ?)")
          .run(accountId, reward.cosmetic, now);
      }
      return { seasonId, tier, track, reward, balance: this.balanceOf(accountId) };
    });
  }

  ownedCosmetics(accountId: string): string[] {
    return (this.db.prepare('SELECT cosmetic_id FROM owned_cosmetics WHERE account_id = ?').all(accountId) as { cosmetic_id: string }[]).map(
      (r) => r.cosmetic_id,
    );
  }

  /** Cosmetics the player can use now: owned ones plus VYNR Black items while the subscription is active. */
  usableCosmetics(accountId: string, now: number): Set<string> {
    const set = new Set(this.ownedCosmetics(accountId));
    if (this.hasBlack(accountId, now)) for (const c of this.cfg.cosmetics) if (c.black) set.add(c.id);
    return set;
  }

  buyCosmetic(accountId: string, cosmeticId: string, now: number) {
    const c = this.cfg.cosmetics.find((x) => x.id === cosmeticId);
    if (!c || c.priceVc === null || c.priceVc <= 0) throw new EconomyError(404, 'cosmetic_not_for_sale');
    return this.tx(() => {
      const r = this.db
        .prepare("INSERT OR IGNORE INTO owned_cosmetics (account_id, cosmetic_id, source, created_at) VALUES (?, ?, 'purchase', ?)")
        .run(accountId, c.id, now);
      if (r.changes !== 1) throw new EconomyError(409, 'already_owned');
      const balance = this.move(accountId, -c.priceVc!, 'cosmetic', c.id, now);
      return { cosmeticId: c.id, price: c.priceVc, balance };
    });
  }

  // ── Profiles and safety ──────────────────────────────────────────────

  updateProfile(
    accountId: string,
    p: { handle?: string | null; public?: boolean; showcase?: string[]; environment?: string; scannerSkin?: string; frame?: string; title?: string },
    now: number,
  ) {
    return this.tx(() => {
      const current = this.db.prepare('SELECT handle, public_profile, profile_json FROM accounts WHERE id = ?').get(accountId) as {
        handle: string | null;
        public_profile: number;
        profile_json: string;
      };
      let handle = current.handle;
      if (p.handle !== undefined) {
        if (p.handle !== null && (!HANDLE.test(p.handle) || HANDLE_DENY.test(p.handle))) throw new EconomyError(422, 'invalid_handle');
        if (p.handle !== null) {
          const taken = this.db.prepare('SELECT id FROM accounts WHERE handle = ? COLLATE NOCASE AND id <> ?').get(p.handle, accountId);
          if (taken) throw new EconomyError(409, 'handle_taken');
        }
        handle = p.handle;
      }
      const isPublic = p.public ?? current.public_profile === 1;
      if (isPublic && !handle) throw new EconomyError(422, 'handle_required');
      const profile = JSON.parse(current.profile_json) as Record<string, unknown>;
      const usable = this.usableCosmetics(accountId, now);
      for (const [field, kind] of [
        ['environment', 'garage_environment'],
        ['scannerSkin', 'scanner_skin'],
        ['frame', 'frame'],
        ['title', 'title'],
      ] as const) {
        const value = p[field];
        if (value === undefined) continue;
        const cos = this.cfg.cosmetics.find((c) => c.id === value && c.kind === kind);
        if (!cos || !usable.has(value)) throw new EconomyError(403, 'cosmetic_not_owned');
        profile[field] = value;
      }
      if (p.showcase !== undefined) {
        const slots = this.hasBlack(accountId, now) ? this.cfg.showcaseSlots.black : this.cfg.showcaseSlots.free;
        if (!Array.isArray(p.showcase) || p.showcase.length > slots || new Set(p.showcase).size !== p.showcase.length) {
          throw new EconomyError(422, 'invalid_showcase');
        }
        for (const id of p.showcase) {
          const row = this.collectibleRow(id);
          if (!row || row.owner_id !== accountId) throw new EconomyError(403, 'collectible_not_owned');
        }
        profile.showcase = p.showcase;
      }
      this.db
        .prepare('UPDATE accounts SET handle = ?, public_profile = ?, profile_json = ? WHERE id = ?')
        .run(handle, isPublic ? 1 : 0, JSON.stringify(profile), accountId);
      return { handle, public: isPublic, ...profile } as PublicSettings;
    });
  }

  /** A public profile: handle, showcase and discovery stats only. No location, no account id. */
  publicProfile(handle: string, viewer: string | null) {
    const a = this.db.prepare('SELECT id, handle, profile_json FROM accounts WHERE handle = ? COLLATE NOCASE AND public_profile = 1 AND deleted_at IS NULL').get(handle) as
      | { id: string; handle: string; profile_json: string }
      | undefined;
    if (!a || (viewer && this.isBlockedEitherWay(viewer, a.id))) throw new EconomyError(404, 'profile_not_found');
    const profile = JSON.parse(a.profile_json) as { showcase?: string[]; environment?: string; frame?: string; title?: string };
    const owned = new Set(this.inventory(a.id).map((c) => c.id));
    const showcase = (profile.showcase ?? []).filter((id) => owned.has(id)).map((id) => this.provenance(id).collectible);
    const s = this.stats(a.id);
    return {
      handle: a.handle,
      environment: profile.environment ?? 'env-standard',
      frame: profile.frame ?? null,
      title: profile.title ?? null,
      showcase,
      stats: { distinctVehicles: s.distinctVehicles, distinctMakes: s.distinctMakes, owned: s.owned, xp: s.xp },
      wishlist: this.wishlist(a.id),
    };
  }

  private accountIdForHandle(handle: string): string {
    const a = this.db.prepare('SELECT id FROM accounts WHERE handle = ? COLLATE NOCASE AND deleted_at IS NULL').get(handle) as { id: string } | undefined;
    if (!a) throw new EconomyError(404, 'profile_not_found');
    return a.id;
  }

  block(accountId: string, handle: string, now: number): void {
    const target = this.accountIdForHandle(handle);
    if (target === accountId) throw new EconomyError(422, 'cannot_block_self');
    this.db.prepare('INSERT OR IGNORE INTO blocks (account_id, blocked_id, created_at) VALUES (?, ?, ?)').run(accountId, target, now);
  }

  unblock(accountId: string, handle: string): void {
    const target = this.accountIdForHandle(handle);
    this.db.prepare('DELETE FROM blocks WHERE account_id = ? AND blocked_id = ?').run(accountId, target);
  }

  private isBlockedEitherWay(a: string, b: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM blocks WHERE (account_id = ? AND blocked_id = ?) OR (account_id = ? AND blocked_id = ?)').get(a, b, b, a);
  }

  report(accountId: string, handle: string, reason: string, now: number): string {
    if (!['offensive_name', 'harassment', 'cheating', 'other'].includes(reason)) throw new EconomyError(422, 'invalid_reason');
    const target = this.accountIdForHandle(handle);
    const recent = (this.db.prepare('SELECT COUNT(*) AS n FROM reports WHERE reporter_id = ? AND created_at >= ?').get(accountId, now - DAY) as { n: number }).n;
    if (recent >= 20) throw new EconomyError(429, 'report_rate_limited');
    const id = newId('rpt');
    this.db.prepare('INSERT INTO reports (id, reporter_id, target_account, reason, created_at) VALUES (?, ?, ?, ?, ?)').run(id, accountId, target, reason, now);
    this.audit(accountId, 'safety.report', id, { reason }, now);
    return id;
  }

  // ── Entitlements ─────────────────────────────────────────────────────

  hasBlack(accountId: string, now: number): boolean {
    return !!this.db
      .prepare("SELECT 1 FROM entitlements WHERE account_id = ? AND state IN ('active', 'grace') AND (expires_at IS NULL OR expires_at > ?)")
      .get(accountId, now);
  }

  entitlement(accountId: string, now: number) {
    const rows = this.db
      .prepare('SELECT platform, environment, product_id AS productId, state, expires_at AS expiresAt FROM entitlements WHERE account_id = ? ORDER BY updated_at DESC')
      .all(accountId);
    return { black: this.hasBlack(accountId, now), subscriptions: rows };
  }

  /** Stores a verified subscription state. Only called with output from a platform verifier, never with client claims. */
  upsertEntitlement(
    accountId: string,
    e: { platform: 'apple' | 'google'; environment: 'sandbox' | 'production'; productId: string; originalTransactionId: string; state: string; expiresAt: number | null },
    now: number,
  ): void {
    this.tx(() => {
      const existing = this.db.prepare('SELECT account_id FROM entitlements WHERE platform = ? AND original_transaction_id = ?').get(e.platform, e.originalTransactionId) as
        | { account_id: string }
        | undefined;
      if (existing && existing.account_id !== accountId) {
        // One store purchase belongs to one VYNR account; moving it is a "restore" the player confirms explicitly.
        this.audit(accountId, 'entitlement.transfer', e.originalTransactionId, { from: existing.account_id }, now);
      }
      this.db
        .prepare(
          `INSERT INTO entitlements (account_id, platform, environment, product_id, original_transaction_id, state, expires_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(platform, original_transaction_id) DO UPDATE SET account_id = excluded.account_id, state = excluded.state,
             expires_at = excluded.expires_at, product_id = excluded.product_id, environment = excluded.environment, updated_at = excluded.updated_at`,
        )
        .run(accountId, e.platform, e.environment, e.productId, e.originalTransactionId, e.state, e.expiresAt, now);
      this.audit(accountId, 'entitlement.update', e.originalTransactionId, { state: e.state, environment: e.environment }, now);
    });
  }

  /** Applies a server-to-server notification to the purchase it names, whoever owns it. */
  updateEntitlementByTransaction(platform: 'apple' | 'google', originalTransactionId: string, state: string, expiresAt: number | null, now: number): boolean {
    const r = this.db
      .prepare('UPDATE entitlements SET state = ?, expires_at = ?, updated_at = ? WHERE platform = ? AND original_transaction_id = ?')
      .run(state, expiresAt, now, platform, originalTransactionId);
    return r.changes === 1;
  }

  // ── Integrity ────────────────────────────────────────────────────────

  /** Checks the invariants the economy relies on. Used by tests, the simulation and an operator health check. */
  checkInvariants(): string[] {
    const problems: string[] = [];
    const mismatched = this.db
      .prepare(
        `SELECT w.account_id, w.balance, COALESCE(SUM(l.delta), 0) AS total FROM wallets w LEFT JOIN ledger l ON l.account_id = w.account_id
         GROUP BY w.account_id HAVING w.balance <> total`,
      )
      .all();
    if (mismatched.length) problems.push(`${mismatched.length} wallet(s) differ from their ledger`);
    const negative = this.db.prepare('SELECT COUNT(*) AS n FROM wallets WHERE balance < 0').get() as { n: number };
    if (negative.n) problems.push('negative balance');
    const badOwners = this.db
      .prepare(
        `SELECT c.id FROM collectibles c WHERE c.owner_id IS NOT NULL AND c.owner_id <> (
           SELECT e.to_account FROM ownership_events e WHERE e.collectible_id = c.id ORDER BY e.id DESC LIMIT 1)`,
      )
      .all();
    if (badOwners.length) problems.push(`${badOwners.length} collectible owner(s) differ from provenance`);
    const staleListings = this.db
      .prepare("SELECT l.id FROM listings l JOIN collectibles c ON c.id = l.collectible_id WHERE l.status = 'active' AND (c.owner_id IS NULL OR c.owner_id <> l.seller_id)")
      .all();
    if (staleListings.length) problems.push(`${staleListings.length} active listing(s) for collectibles the seller does not own`);
    return problems;
  }

  /** Totals for the economy dashboard and simulation: VC created, destroyed and in circulation. */
  totals() {
    const sum = (sql: string) => (this.db.prepare(sql).get() as { n: number | null }).n ?? 0;
    return {
      circulating: sum('SELECT SUM(balance) AS n FROM wallets'),
      minted: sum('SELECT SUM(delta) AS n FROM ledger WHERE delta > 0 AND reason <> \'market_sale\''),
      spent: -sum("SELECT SUM(delta) AS n FROM ledger WHERE delta < 0 AND reason <> 'market_purchase'"),
      feesBurned: sum('SELECT SUM(fee) AS n FROM sales'),
      collectibles: sum('SELECT COUNT(*) AS n FROM collectibles WHERE owner_id IS NOT NULL'),
      sales: sum('SELECT COUNT(*) AS n FROM sales'),
    };
  }

  static open(path: string, opts: StoreOptions): EconomyStore {
    return new EconomyStore(path, opts);
  }
}

export function newEconomyStoreForTests(catalog: ServerCatalog, config: EconomyConfig, rng?: Rng, path = ':memory:'): EconomyStore {
  return new EconomyStore(path, { catalog, config, rng });
}
