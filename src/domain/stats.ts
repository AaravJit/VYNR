import type { Catalog } from '@/catalog';

import { streaks } from './time';
import type { CountryCode, EncounterRecord, Rarity } from './types';
import { RARITIES } from './types';

export interface PlayerStats {
  totalEncounters: number;
  uniqueVehicles: number;
  catalogSize: number;
  completionPercent: number;
  uniqueByRarity: Record<Rarity, number>;
  manufacturersSeen: number;
  countriesSeen: CountryCode[];
  completedManufacturers: string[];
  electricUnique: number;
  unknownLogged: number;
  currentStreak: number;
  longestStreak: number;
}

export function discoveredVehicleIds(encounters: EncounterRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const e of encounters) if (e.vehicleId) ids.add(e.vehicleId);
  return ids;
}

export function computeStats(
  encounters: EncounterRecord[],
  catalog: Catalog,
  now: number,
): PlayerStats {
  const ids = discoveredVehicleIds(encounters);
  const uniqueByRarity = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  const manufacturers = new Set<string>();
  const countries = new Set<CountryCode>();
  let electricUnique = 0;
  for (const id of ids) {
    const v = catalog.getVehicle(id);
    if (!v) continue; // vehicle removed from catalog: keep history, ignore for stats
    uniqueByRarity[v.rarity]++;
    manufacturers.add(v.manufacturerId);
    countries.add(catalog.countryOf(v));
    if (v.electric) electricUnique++;
  }
  const completedManufacturers = catalog.manufacturers
    .filter((m) => {
      const models = catalog.vehiclesByManufacturer(m.id);
      return models.length > 0 && models.every((v) => ids.has(v.id));
    })
    .map((m) => m.id);
  const knownUnique = Object.values(uniqueByRarity).reduce((a, b) => a + b, 0);
  const s = streaks(
    encounters.map((e) => e.createdAt),
    now,
  );
  return {
    totalEncounters: encounters.length,
    uniqueVehicles: knownUnique,
    catalogSize: catalog.vehicles.length,
    completionPercent:
      catalog.vehicles.length === 0 ? 0 : (knownUnique / catalog.vehicles.length) * 100,
    uniqueByRarity,
    manufacturersSeen: manufacturers.size,
    countriesSeen: [...countries].sort(),
    completedManufacturers,
    electricUnique,
    unknownLogged: encounters.filter((e) => e.vehicleId === null).length,
    currentStreak: s.current,
    longestStreak: s.longest,
  };
}
