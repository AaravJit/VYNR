import { loadCatalog } from '../src/economy/catalog.ts';
import { DEFAULT_ECONOMY, type EconomyConfig } from '../src/economy/config.ts';
import { EconomyStore, type Rng } from '../src/economy/store.ts';

/** Deterministic PRNG (mulberry32) so draws and simulations are reproducible. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (n) => Math.floor(next() * n) };
}

export const catalog = loadCatalog();
export const DAY = 86_400_000;
export const T0 = Date.UTC(2026, 11, 10, 12);

export function store(opts: { config?: Partial<EconomyConfig>; seed?: number; path?: string } = {}): EconomyStore {
  return new EconomyStore(opts.path ?? ':memory:', {
    catalog,
    config: { ...DEFAULT_ECONOMY, ...opts.config },
    rng: seededRng(opts.seed ?? 1),
  });
}

let keyN = 0;
export const key = () => `test-key-${++keyN}-${Math.random().toString(36).slice(2, 8)}`;

/** Candidates the cloud would return for a catalog vehicle. */
export function candidatesFor(vehicleId: string, confidence = 0.9) {
  const v = catalog.vehicle(vehicleId)!;
  return [{ make: catalog.manufacturer(v.manufacturerId)!.name, model: v.model, confidence }];
}

/** Verified discovery of a vehicle, as the app would claim it after a cloud answer. */
export function discover(s: EconomyStore, account: string, vehicleId: string, now: number) {
  const rec = s.recordRecognition(account, candidatesFor(vehicleId), now);
  return s.claimDiscovery(account, rec, vehicleId, now);
}

/** An account old enough, with enough verified discoveries, to trade. */
export function trader(s: EconomyStore, now: number, vc = 0) {
  const { accountId, token } = s.createAccount(now - 2 * DAY);
  for (const id of ['toyota-corolla-e210', 'toyota-camry-xv70', catalog.vehicles[5]!.id]) discover(s, accountId, id, now - 2 * DAY);
  if (vc > 0) s.operatorGrant(accountId, vc, 'test', now - 2 * DAY);
  return { accountId, token };
}
