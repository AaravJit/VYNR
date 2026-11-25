import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { DEFAULT_ECONOMY, oddsFor, poolVehicles, validateEconomy } from '../src/economy/config.ts';
import { migrate, MIGRATIONS, openEconomyDb, rollback } from '../src/economy/db.ts';
import { EconomyError, EconomyStore } from '../src/economy/store.ts';
import { candidatesFor, catalog, DAY, discover, key, seededRng, store, T0, trader } from './economyHelpers.ts';

const COMMON = 'toyota-corolla-e210';

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof EconomyError) return e.code;
    throw e;
  }
  return 'ok';
}

describe('schema', () => {
  it('applies migrations once and rolls back cleanly', () => {
    const db = openEconomyDb(':memory:');
    assert.deepEqual(migrate(db), MIGRATIONS.map((m) => m.version));
    assert.deepEqual(migrate(db), []);
    assert.deepEqual(rollback(db, 0), [...MIGRATIONS.map((m) => m.version)].reverse());
    const left = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT IN ('schema_migrations', 'sqlite_sequence')").all();
    assert.deepEqual(left, []);
  });

  it('rejects a negative balance at the database level', () => {
    const s = store();
    const { accountId } = s.createAccount(T0);
    assert.throws(() => s.db.prepare('UPDATE wallets SET balance = -1 WHERE account_id = ?').run(accountId), /CHECK constraint/);
  });
});

describe('economy config', () => {
  it('is valid and every crate publishes odds that sum to 1', () => {
    assert.deepEqual(validateEconomy(DEFAULT_ECONOMY, catalog), []);
    for (const c of DEFAULT_ECONOMY.crates) {
      const odds = oddsFor(catalog, c);
      const total = odds.items.reduce((a, i) => a + i.probability, 0);
      assert.ok(Math.abs(total - 1) < 1e-9, `${c.id} odds sum to ${total}`);
      assert.ok(odds.items.length > 0, `${c.id} has an empty pool`);
    }
  });

  it('refuses VC in a premium season reward and Black cosmetics sold for VC', () => {
    const bad = structuredClone(DEFAULT_ECONOMY);
    (bad.seasons[0]!.tiers[0]!.premium as unknown as { vc: number }).vc = 100;
    bad.cosmetics.push({ id: 'x', kind: 'frame', name: 'X', priceVc: 10, black: true, season: null });
    const errors = validateEconomy(bad, catalog);
    assert.ok(errors.some((e) => e.includes('premium rewards cannot include VC')));
    assert.ok(errors.some((e) => e.includes('Black items are not sold')));
  });
});

describe('verified discoveries', () => {
  it('requires a recent cloud answer for this account that supports the chosen vehicle', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    const b = s.createAccount(T0).accountId;
    const rec = s.recordRecognition(a, candidatesFor(COMMON), T0);
    assert.equal(code(() => s.claimDiscovery(b, rec, COMMON, T0)), 'recognition_not_found');
    assert.equal(code(() => s.claimDiscovery(a, rec, 'ferrari-sf90', T0)), 'unknown_vehicle');
    const other = catalog.vehicles.find((v) => v.manufacturerId !== 'toyota')!;
    assert.equal(code(() => s.claimDiscovery(a, rec, other.id, T0)), 'not_supported_by_recognition');
    assert.equal(code(() => s.claimDiscovery(a, rec, COMMON, T0 + 31 * 60_000)), 'claim_expired');
    const ok = s.claimDiscovery(a, rec, COMMON, T0 + 60_000);
    assert.equal(ok.first, true);
    assert.equal(ok.rewardVc, DEFAULT_ECONOMY.discoveryVc.common);
    assert.ok(ok.collectible);
    assert.equal(code(() => s.claimDiscovery(a, rec, COMMON, T0 + 60_000)), 'already_claimed');
  });

  it('ignores weak answers', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    const rec = s.recordRecognition(a, candidatesFor(COMMON, 0.2), T0);
    assert.equal(code(() => s.claimDiscovery(a, rec, COMMON, T0)), 'not_supported_by_recognition');
  });

  it('limits repeat rewards and minting so scanning one car cannot farm VC', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    const results = Array.from({ length: 6 }, (_, i) => discover(s, a, COMMON, T0 + i * 60_000));
    assert.deepEqual(
      results.map((r) => r.rewardVc),
      [40, 6, 6, 0, 0, 0],
    );
    assert.equal(results.filter((r) => r.collectible).length, 1, 'one collectible per vehicle per day');
    const tomorrow = discover(s, a, COMMON, T0 + DAY);
    assert.equal(tomorrow.rewardVc, 6);
    assert.ok(tomorrow.collectible);
  });

  it('caps rewarded discoveries per day', () => {
    const s = store({ config: { dailyRewardedDiscoveries: 3 } });
    const a = s.createAccount(T0).accountId;
    const ids = catalog.vehicles.slice(0, 5).map((v) => v.id);
    const rewards = ids.map((id, i) => discover(s, a, id, T0 + i).rewardVc);
    assert.equal(rewards.filter((r) => r > 0).length, 3);
  });

  it('keeps the discovery when the collectible is scrapped or sold', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    const d = discover(s, a, COMMON, T0);
    s.scrap(a, d.collectible!.id, key(), T0 + 1);
    assert.equal(s.discoveries(a).length, 1);
    assert.equal(s.inventory(a).length, 0);
    assert.equal(s.stats(a).distinctVehicles, 1);
  });
});

describe('crates', () => {
  it('charges once, mints once and returns the same result for a retried request', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    s.operatorGrant(a, 1000, 'test', T0);
    const k = key();
    const first = s.openCrate(a, 'street', k, T0);
    const retry = s.openCrate(a, 'street', k, T0 + 5000);
    assert.deepEqual(retry, first);
    assert.equal(s.balanceOf(a), 1000 - 150);
    assert.equal(s.inventory(a).length, 1);
    assert.equal(code(() => s.openCrate(a, 'performance', k, T0)), 'idempotency_key_reused');
  });

  it('refuses without enough VC and changes nothing', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    s.operatorGrant(a, 100, 'test', T0);
    assert.equal(code(() => s.openCrate(a, 'street', key(), T0)), 'insufficient_vc');
    assert.equal(s.balanceOf(a), 100);
    assert.equal(s.inventory(a).length, 0);
  });

  it('rolls back the charge when the transaction fails part way', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    s.operatorGrant(a, 500, 'test', T0);
    const target = s as unknown as { mint: () => never };
    const original = target.mint;
    target.mint = () => {
      throw new Error('disk full');
    };
    const k = key();
    assert.throws(() => s.openCrate(a, 'street', k, T0), /disk full/);
    target.mint = original;
    assert.equal(s.balanceOf(a), 500);
    assert.equal(s.inventory(a).length, 0);
    // The same key can be retried after a failure, and charges once.
    s.openCrate(a, 'street', k, T0);
    assert.equal(s.balanceOf(a), 350);
    assert.deepEqual(s.checkInvariants(), []);
  });

  it('keeps unseen openings so an interrupted reveal can be shown again', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    s.operatorGrant(a, 300, 'test', T0);
    const o = s.openCrate(a, 'street', key(), T0);
    assert.equal(s.unseenOpenings(a).length, 1);
    s.markOpeningSeen(a, o.openingId);
    assert.equal(s.unseenOpenings(a).length, 0);
  });

  it('applies the published pity guarantee', () => {
    const s = store({ seed: 7 });
    const a = s.createAccount(T0).accountId;
    s.operatorGrant(a, 150 * 200, 'test', T0);
    let since = 0;
    for (let i = 0; i < 200; i++) {
      const o = s.openCrate(a, 'street', key(), T0 + i);
      if (o.rarity === 'rare') since = 0;
      else since++;
      assert.ok(since < 15, 'never 15 street crates in a row without a rare');
    }
  });

  it('draws rarities at the published rates', () => {
    const s = store({ seed: 42, config: { crates: DEFAULT_ECONOMY.crates.map((c) => ({ ...c, pity: null })) } });
    const a = s.createAccount(T0).accountId;
    const n = 6000;
    s.operatorGrant(a, 360 * n, 'test', T0);
    const counts: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const o = s.openCrate(a, 'jdm', key(), T0 + i);
      counts[o.rarity] = (counts[o.rarity] ?? 0) + 1;
    }
    for (const r of oddsFor(catalog, DEFAULT_ECONOMY.crates.find((c) => c.id === 'jdm')!).rarities) {
      const expected = r.probability * n;
      const sd = Math.sqrt(n * r.probability * (1 - r.probability));
      assert.ok(Math.abs((counts[r.rarity] ?? 0) - expected) < 4 * sd, `${r.rarity}: ${counts[r.rarity]} vs ${expected.toFixed(0)}`);
    }
    // Every result came from the crate's pool.
    const pool = new Set(poolVehicles(catalog, DEFAULT_ECONOMY.crates.find((c) => c.id === 'jdm')!.pool).map((v) => v.id));
    assert.ok(s.inventory(a).every((c) => pool.has(c.vehicleId)));
  });

  it('offers a deterministic alternative at a fixed price', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    s.operatorGrant(a, 1000, 'test', T0);
    const r = s.buyShowroom(a, COMMON, key(), T0);
    assert.equal(r.collectible.vehicleId, COMMON);
    assert.equal(r.price, DEFAULT_ECONOMY.showroomVc.common);
  });
});

describe('marketplace', () => {
  it('needs trade eligibility, bounded prices and a trade hold', () => {
    const s = store();
    const fresh = s.createAccount(T0).accountId;
    const d = discover(s, fresh, COMMON, T0);
    assert.equal(code(() => s.createListing(fresh, d.collectible!.id, 100, key(), T0)), 'account_too_new');
    const seller = trader(s, T0);
    const item = s.inventory(seller.accountId)[0]!;
    assert.equal(code(() => s.createListing(seller.accountId, item.id, 5, key(), T0)), 'price_out_of_bounds');
    assert.equal(code(() => s.createListing(seller.accountId, item.id, 100_000, key(), T0)), 'price_out_of_bounds');
    const recent = discover(s, seller.accountId, 'toyota-rav4-xa50', T0).collectible ?? discover(s, seller.accountId, catalog.vehicles[9]!.id, T0).collectible!;
    assert.equal(code(() => s.createListing(seller.accountId, recent.id, 100, key(), T0)), 'trade_hold');
    assert.equal(code(() => s.createListing(seller.accountId, 'vc_nope', 100, key(), T0)), 'collectible_not_found');
  });

  it('transfers atomically, burns the fee and records provenance', () => {
    const s = store();
    const seller = trader(s, T0);
    const buyer = trader(s, T0, 1000);
    const item = s.inventory(seller.accountId)[0]!;
    const sellerBefore = s.balanceOf(seller.accountId);
    const buyerBefore = s.balanceOf(buyer.accountId);
    const { listingId } = s.createListing(seller.accountId, item.id, 200, key(), T0);
    assert.equal(code(() => s.buyListing(seller.accountId, listingId, 200, key(), T0)), 'own_listing');
    assert.equal(code(() => s.buyListing(buyer.accountId, listingId, 150, key(), T0)), 'price_changed');
    const sale = s.buyListing(buyer.accountId, listingId, 200, key(), T0 + 1);
    assert.equal(sale.fee, 10);
    assert.equal(s.balanceOf(buyer.accountId), buyerBefore - 200);
    assert.equal(s.balanceOf(seller.accountId), sellerBefore + 190);
    assert.ok(s.inventory(buyer.accountId).some((c) => c.id === item.id));
    assert.ok(!s.inventory(seller.accountId).some((c) => c.id === item.id));
    const p = s.provenance(item.id);
    assert.deepEqual(
      p.history.map((h) => (h as { kind: string }).kind),
      ['discovered', 'sale'],
    );
    assert.ok(!('ownerId' in p.collectible));
    assert.equal(code(() => s.buyListing(buyer.accountId, listingId, 200, key(), T0 + 2)), 'listing_unavailable');
    assert.equal(s.totals().feesBurned, 10);
    assert.deepEqual(s.checkInvariants(), []);
  });

  it('cannot sell a listed collectible twice or scrap it while listed', () => {
    const s = store();
    const seller = trader(s, T0);
    const item = s.inventory(seller.accountId)[0]!;
    s.createListing(seller.accountId, item.id, 100, key(), T0);
    assert.equal(code(() => s.createListing(seller.accountId, item.id, 120, key(), T0)), 'already_listed');
    assert.equal(code(() => s.scrap(seller.accountId, item.id, key(), T0)), 'listed');
  });

  it('lets exactly one of two racing buyers win, across two server processes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vynr-econ-'));
    try {
      const path = join(dir, 'economy.db');
      const s1 = store({ path });
      const s2 = new EconomyStore(path, { catalog, config: DEFAULT_ECONOMY, rng: seededRng(2) });
      const seller = trader(s1, T0);
      const b1 = trader(s1, T0, 1000);
      const b2 = trader(s1, T0, 1000);
      const item = s1.inventory(seller.accountId)[0]!;
      const { listingId } = s1.createListing(seller.accountId, item.id, 300, key(), T0);
      const before = s1.balanceOf(b1.accountId) + s1.balanceOf(b2.accountId);
      const outcomes = [code(() => s1.buyListing(b1.accountId, listingId, 300, key(), T0)), code(() => s2.buyListing(b2.accountId, listingId, 300, key(), T0))];
      assert.deepEqual(outcomes.sort(), ['listing_unavailable', 'ok']);
      assert.equal(s1.balanceOf(b1.accountId) + s2.balanceOf(b2.accountId), before - 300);
      assert.deepEqual(s2.checkInvariants(), []);
      s1.close();
      s2.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prevents spending the same VC twice from two connections', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vynr-econ-'));
    try {
      const path = join(dir, 'economy.db');
      const s1 = store({ path });
      const s2 = new EconomyStore(path, { catalog, config: DEFAULT_ECONOMY, rng: seededRng(3) });
      const sellerA = trader(s1, T0);
      const sellerB = trader(s1, T0);
      const buyer = trader(s1, T0, 400);
      const l1 = s1.createListing(sellerA.accountId, s1.inventory(sellerA.accountId)[0]!.id, 300, key(), T0).listingId;
      const l2 = s1.createListing(sellerB.accountId, s1.inventory(sellerB.accountId)[0]!.id, 300, key(), T0).listingId;
      const before = s1.balanceOf(buyer.accountId);
      assert.ok(before >= 300 && before < 600);
      const outcomes = [code(() => s1.buyListing(buyer.accountId, l1, 300, key(), T0)), code(() => s2.buyListing(buyer.accountId, l2, 300, key(), T0))];
      assert.deepEqual(outcomes.sort(), ['insufficient_vc', 'ok']);
      assert.equal(s1.balanceOf(buyer.accountId), before - 300);
      s1.close();
      s2.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('hides blocked sellers and refuses trades between blocked players', () => {
    const s = store();
    const seller = trader(s, T0);
    const buyer = trader(s, T0, 1000);
    s.updateProfile(seller.accountId, { handle: 'seller_one', public: true }, T0);
    const { listingId } = s.createListing(seller.accountId, s.inventory(seller.accountId)[0]!.id, 100, key(), T0);
    assert.equal(s.searchListings(buyer.accountId, {}).length, 1);
    s.block(buyer.accountId, 'seller_one', T0);
    assert.equal(s.searchListings(buyer.accountId, {}).length, 0);
    assert.equal(code(() => s.buyListing(buyer.accountId, listingId, 100, key(), T0)), 'blocked');
  });

  it('searches by make, rarity and price order', () => {
    const s = store();
    const seller = trader(s, T0);
    for (const [i, c] of s.inventory(seller.accountId).entries()) s.createListing(seller.accountId, c.id, 100 + i * 50, key(), T0);
    const toyota = s.searchListings(null, { make: 'toyota', sort: 'price_desc' });
    assert.ok(toyota.length >= 2);
    assert.ok(toyota.every((l) => catalog.vehicle(l.vehicleId)!.manufacturerId === 'toyota'));
    assert.ok(toyota[0]!.price >= toyota[1]!.price);
    assert.equal(s.searchListings(null, { rarity: 'legendary' }).length, 0);
  });
});

describe('progression, cosmetics and subscriptions', () => {
  it('pays each achievement once, only when complete', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    assert.equal(code(() => s.claimAchievement(a, 'first-spot', T0)), 'not_complete');
    discover(s, a, COMMON, T0);
    assert.equal(s.claimAchievement(a, 'first-spot', T0).rewardVc, 50);
    assert.equal(code(() => s.claimAchievement(a, 'first-spot', T0)), 'already_claimed');
  });

  it('keeps premium season rewards cosmetic and behind an active subscription', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    for (const v of catalog.vehicles.filter((x) => catalog.countryOf(x) === 'JP').slice(0, 4)) discover(s, a, v.id, T0);
    assert.equal(code(() => s.claimSeasonTier(a, 'midnight-japan', 1, 'premium', T0)), 'black_required');
    const before = s.balanceOf(a);
    s.claimSeasonTier(a, 'midnight-japan', 1, 'free', T0);
    assert.equal(s.balanceOf(a), before + 100);
    s.upsertEntitlement(a, { platform: 'apple', environment: 'sandbox', productId: 'black.monthly', originalTransactionId: 't1', state: 'active', expiresAt: T0 + DAY }, T0);
    const balance = s.balanceOf(a);
    s.claimSeasonTier(a, 'midnight-japan', 1, 'premium', T0);
    assert.equal(s.balanceOf(a), balance, 'premium rewards never include VC');
    assert.ok(s.ownedCosmetics(a).includes('frame-sakura'));
  });

  it('treats grace as active and hold, expiry, refund and revocation as inactive', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    const set = (state: string, expiresAt: number | null) =>
      s.upsertEntitlement(a, { platform: 'google', environment: 'sandbox', productId: 'black', originalTransactionId: 'gp1', state, expiresAt }, T0);
    set('active', T0 + DAY);
    assert.equal(s.hasBlack(a, T0), true);
    assert.equal(s.hasBlack(a, T0 + 2 * DAY), false, 'expired by time');
    set('grace', T0 + DAY);
    assert.equal(s.hasBlack(a, T0), true);
    for (const st of ['on_hold', 'expired', 'refunded', 'revoked']) {
      set(st, T0 + DAY);
      assert.equal(s.hasBlack(a, T0), false, st);
    }
  });

  it('only lets players use cosmetics they own or have through Black', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    assert.equal(code(() => s.updateProfile(a, { environment: 'env-underground' }, T0)), 'cosmetic_not_owned');
    assert.equal(code(() => s.updateProfile(a, { environment: 'env-tokyo' }, T0)), 'cosmetic_not_owned');
    s.operatorGrant(a, 900, 'test', T0);
    s.buyCosmetic(a, 'env-underground', T0);
    assert.equal(s.updateProfile(a, { environment: 'env-underground' }, T0).environment, 'env-underground');
    assert.equal(code(() => s.buyCosmetic(a, 'env-tokyo', T0)), 'cosmetic_not_for_sale');
  });

  it('validates handles and showcase ownership', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    const b = s.createAccount(T0).accountId;
    assert.equal(code(() => s.updateProfile(a, { handle: 'x' }, T0)), 'invalid_handle');
    assert.equal(code(() => s.updateProfile(a, { handle: 'VYNR_admin' }, T0)), 'invalid_handle');
    assert.equal(code(() => s.updateProfile(a, { public: true }, T0)), 'handle_required');
    s.updateProfile(a, { handle: 'night_spotter', public: true }, T0);
    assert.equal(code(() => s.updateProfile(b, { handle: 'NIGHT_SPOTTER' }, T0)), 'handle_taken');
    const theirs = discover(s, b, COMMON, T0).collectible!;
    assert.equal(code(() => s.updateProfile(a, { showcase: [theirs.id] }, T0)), 'collectible_not_owned');
    const p = s.publicProfile('night_spotter', null);
    assert.equal(p.handle, 'night_spotter');
    assert.ok(!('id' in p));
  });
});

describe('accounts', () => {
  it('authenticates by token and stores only a hash', () => {
    const s = store();
    const { accountId, token } = s.createAccount(T0);
    assert.equal(s.authenticate(token, T0), accountId);
    assert.equal(s.authenticate(`${token}x`, T0), null);
    const raw = s.db.prepare('SELECT token_hash FROM tokens').all() as { token_hash: string }[];
    assert.ok(raw.every((r) => r.token_hash !== token));
  });

  it('deletes an account: token revoked, items burned, listings closed, integrity kept', () => {
    const s = store();
    const seller = trader(s, T0, 500);
    const item = s.inventory(seller.accountId)[0]!;
    const { listingId } = s.createListing(seller.accountId, item.id, 100, key(), T0);
    s.deleteAccount(seller.accountId, T0 + 1);
    assert.equal(s.authenticate(seller.token, T0 + 2), null);
    assert.equal(s.searchListings(null, {}).filter((l) => l.id === listingId).length, 0);
    assert.equal(s.balanceOf(seller.accountId), 0);
    assert.equal(s.inventory(seller.accountId).length, 0);
    assert.equal(s.discoveries(seller.accountId).length, 0);
    assert.deepEqual(s.checkInvariants(), []);
  });

  it('exports the account data', () => {
    const s = store();
    const a = s.createAccount(T0).accountId;
    discover(s, a, COMMON, T0);
    const e = s.exportAccount(a);
    assert.equal((e.discoveries as unknown[]).length, 1);
    assert.equal(e.balance, 40);
  });
});

describe('integrity under random play', () => {
  it('keeps every invariant through thousands of mixed operations', () => {
    const s = store({ seed: 99 });
    const rng = seededRng(1234);
    const players = Array.from({ length: 12 }, () => trader(s, T0, 2000).accountId);
    let now = T0;
    for (let i = 0; i < 3000; i++) {
      now += 60_000;
      const p = players[rng.int(players.length)]!;
      const roll = rng.int(100);
      try {
        if (roll < 25) discover(s, p, catalog.vehicles[rng.int(catalog.vehicles.length)]!.id, now);
        else if (roll < 40) s.openCrate(p, DEFAULT_ECONOMY.crates[rng.int(5)]!.id, key(), now);
        else if (roll < 60) {
          const inv = s.inventory(p);
          if (inv.length) {
            const c = inv[rng.int(inv.length)]!;
            const r = catalog.vehicle(c.vehicleId)!.rarity;
            const b = DEFAULT_ECONOMY.market.priceBounds[r];
            s.createListing(p, c.id, b.min + rng.int(b.max - b.min), key(), now);
          }
        } else if (roll < 85) {
          const ls = s.searchListings(p, { sort: 'price_asc', limit: 10 });
          const l = ls[rng.int(Math.max(1, ls.length))];
          if (l) s.buyListing(p, l.id, l.price, key(), now);
        } else if (roll < 92) {
          const inv = s.inventory(p);
          if (inv.length) s.scrap(p, inv[rng.int(inv.length)]!.id, key(), now);
        } else {
          const mine = s.searchListings(null, { limit: 50 }).filter((l) => s.provenance(l.collectibleId).collectible && s.inventory(p).some((c) => c.id === l.collectibleId));
          if (mine[0]) s.cancelListing(p, mine[0].id, now);
        }
      } catch (e) {
        if (!(e instanceof EconomyError)) throw e;
      }
    }
    assert.deepEqual(s.checkInvariants(), []);
    assert.ok(s.totals().sales > 50, `only ${s.totals().sales} sales happened`);
  });
});
