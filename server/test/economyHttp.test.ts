import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { catalog, DAY, key, store, trader } from './economyHelpers.ts';
import { type Harness, imageBody, startServer } from './helpers.ts';

let h: Harness | null = null;
afterEach(async () => {
  await h?.close();
  h = null;
});

async function start(overrides: Parameters<typeof startServer>[0] = {}) {
  const economy = store();
  h = await startServer(overrides, { economy });
  const call = async (method: string, path: string, opts: { token?: string; body?: unknown; key?: string } = {}) => {
    const headers: Record<string, string> = {};
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.key) headers['Idempotency-Key'] = opts.key;
    const res = await fetch(`${h!.url}${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> & { error?: string } };
  };
  const account = async () => (await call('POST', '/v1/account')).body as { accountId: string; token: string };
  return { economy, call, account };
}

const image = imageBody();

describe('economy HTTP API', () => {
  it('publishes config and crate odds without an account', async () => {
    const { call } = await start();
    const cfg = await call('GET', '/v1/config');
    assert.equal(cfg.status, 200);
    const crates = cfg.body.crates as { id: string; odds: { items: { probability: number }[] } }[];
    assert.ok(crates.length >= 8);
    for (const c of crates) assert.ok(Math.abs(c.odds.items.reduce((a, i) => a + i.probability, 0) - 1) < 1e-9);
    assert.equal((cfg.body.black as { available: boolean }).available, false);
    assert.equal((await call('GET', '/v1/crates/street/odds')).status, 200);
  });

  it('turns features off with flags', async () => {
    const { call } = await start({ features: new Set(['economy']) });
    assert.deepEqual((await call('GET', '/v1/market/listings')).body, { error: 'feature_disabled' });
    assert.equal((await call('GET', '/v1/config')).status, 200);
  });

  it('needs a token for player data and rate limits account creation per IP', async () => {
    const { call } = await start({ accountsPerIpPerDay: 2 });
    assert.equal((await call('GET', '/v1/me')).status, 401);
    assert.equal((await call('GET', '/v1/me', { token: 'x'.repeat(43) })).status, 401);
    assert.equal((await call('POST', '/v1/account')).status, 200);
    assert.equal((await call('POST', '/v1/account')).status, 200);
    assert.equal((await call('POST', '/v1/account')).status, 429);
  });

  it('links a cloud answer to the account and turns it into a verified discovery', async () => {
    const { call, account } = await start();
    const anon = await h!.post(image);
    assert.equal(((await anon.json()) as { recognitionId?: string }).recognitionId, undefined, 'no record without an account');
    const { token } = await account();
    const res = await h!.post(image, { Authorization: `Bearer ${token}` });
    const answer = (await res.json()) as { recognitionId: string };
    assert.match(answer.recognitionId, /^rec_/);
    // The fake provider answers Porsche 911 (992).
    const vehicle = catalog.vehicles.find((v) => v.manufacturerId === 'porsche' && v.model === '911')!;
    const claim = await call('POST', '/v1/discoveries', { token, body: { recognitionId: answer.recognitionId, vehicleId: vehicle.id } });
    assert.equal(claim.status, 200, JSON.stringify(claim.body));
    assert.equal(claim.body.first, true);
    const wrong = catalog.vehicles.find((v) => v.manufacturerId === 'toyota')!;
    const second = await h!.post(image, { Authorization: `Bearer ${token}` });
    const rec2 = ((await second.json()) as { recognitionId: string }).recognitionId;
    const bad = await call('POST', '/v1/discoveries', { token, body: { recognitionId: rec2, vehicleId: wrong.id } });
    assert.deepEqual([bad.status, bad.body.error], [422, 'not_supported_by_recognition']);
    const me = await call('GET', '/v1/me', { token });
    assert.equal(me.body.balance, claim.body.balance);
  });

  it('opens crates only with an idempotency key and never charges twice for a retry', async () => {
    const { call, account, economy } = await start();
    const { token, accountId } = await account();
    economy.operatorGrant(accountId, 400, 'test', h!.clock.now());
    const street = economy.config.crates.find((c) => c.id === 'street')!.priceVc;
    assert.deepEqual((await call('POST', '/v1/crates/street/open', { token })).body, { error: 'idempotency_key_required' });
    const k = key();
    const a = await call('POST', '/v1/crates/street/open', { token, key: k });
    const b = await call('POST', '/v1/crates/street/open', { token, key: k });
    assert.equal(a.status, 200);
    assert.deepEqual(b.body, a.body);
    assert.equal((await call('GET', '/v1/me', { token })).body.balance, 400 - street);
    const poor = await call('POST', '/v1/crates/exotic/open', { token, key: key() });
    assert.deepEqual([poor.status, poor.body.error], [402, 'insufficient_vc']);
  });

  it('runs a market sale end to end with server-side prices', async () => {
    const { call, economy } = await start();
    const now = h!.clock.now();
    const seller = trader(economy, now);
    const buyer = trader(economy, now, 1000);
    const item = economy.inventory(seller.accountId)[0]!;
    const listed = await call('POST', '/v1/market/listings', { token: seller.token, key: key(), body: { collectibleId: item.id, price: 250 } });
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    const listingId = listed.body.listingId as string;
    const search = await call('GET', `/v1/market/listings?make=${catalog.vehicle(item.vehicleId)!.manufacturerId}`);
    assert.ok((search.body as unknown as { id: string; seller: unknown }[]).some((l) => l.id === listingId && l.seller === null));
    const cheap = await call('POST', `/v1/market/listings/${listingId}/buy`, { token: buyer.token, key: key(), body: { expectedPrice: 1 } });
    assert.deepEqual([cheap.status, cheap.body.error], [409, 'price_changed']);
    const bought = await call('POST', `/v1/market/listings/${listingId}/buy`, { token: buyer.token, key: key(), body: { expectedPrice: 250 } });
    assert.equal(bought.status, 200);
    const prov = await call('GET', `/v1/collectibles/${item.id}`);
    assert.ok(!JSON.stringify(prov.body).includes(seller.accountId), 'provenance never exposes account ids');
    assert.deepEqual(economy.checkInvariants(), []);
  });

  it('refuses subscription purchases and notifications until billing is configured', async () => {
    const { call, account } = await start({ features: new Set(['economy', 'subscriptions']) });
    const { token } = await account();
    const v = await call('POST', '/v1/entitlements/verify', { token, body: { platform: 'apple', proof: 'signed.jws.value', productId: 'vynr.black.monthly' } });
    assert.deepEqual([v.status, v.body.error], [503, 'billing_not_configured']);
    const n = await call('POST', '/v1/billing/google/notifications', { body: { message: {} } });
    assert.equal(n.status, 503);
    assert.equal((await call('GET', '/v1/entitlements', { token })).body.black, false);
  });

  it('rate limits economy writes per account', async () => {
    const { call, account } = await start({ economyWritesPerMinute: 3 });
    const { token } = await account();
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await call('PUT', `/v1/wishlist/${catalog.vehicles[i]!.id}`, { token })).status);
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
  });

  it('rejects malformed input', async () => {
    const { call, account } = await start();
    const { token } = await account();
    assert.equal((await call('POST', '/v1/discoveries', { token, body: { recognitionId: '../../etc', vehicleId: 'x' } })).status, 400);
    assert.equal((await call('PUT', '/v1/wishlist/not-a-car', { token })).status, 404);
    const res = await fetch(`${h!.url}/v1/discoveries`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' }, body: 'x' });
    assert.equal(res.status, 415);
    assert.equal((await call('PATCH', '/v1/me', { token })).status, 405);
  });

  it('deletes the account and its token', async () => {
    const { call, account } = await start();
    const { token } = await account();
    assert.equal((await call('DELETE', '/v1/account', { token })).status, 200);
    assert.equal((await call('GET', '/v1/me', { token })).status, 401);
  });

  it('keeps the clock-based trade hold', async () => {
    const { call, economy } = await start();
    const s = trader(economy, h!.clock.now());
    const fresh = economy.inventory(s.accountId)[0]!;
    h!.clock.t -= 3 * DAY;
    const early = await call('POST', '/v1/market/listings', { token: s.token, key: key(), body: { collectibleId: fresh.id, price: 100 } });
    assert.equal(early.status, 403);
  });
});
