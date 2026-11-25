import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const RARITIES = ['common', 'uncommon', 'rare', 'exotic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export interface ServerVehicle {
  id: string;
  manufacturerId: string;
  model: string;
  generation: string;
  yearStart: number;
  yearEnd: number | null;
  category: string;
  rarity: Rarity;
  aliases: string[];
}

export interface ServerManufacturer {
  id: string;
  name: string;
  country: string;
  aliases: string[];
}

export interface ServerCatalog {
  version: number;
  vehicles: ServerVehicle[];
  manufacturers: ServerManufacturer[];
  vehicle(id: string): ServerVehicle | undefined;
  manufacturer(id: string): ServerManufacturer | undefined;
  countryOf(v: ServerVehicle): string;
}

export function rarityRank(r: Rarity): number {
  return RARITIES.indexOf(r);
}

export function isRarity(x: unknown): x is Rarity {
  return typeof x === 'string' && (RARITIES as readonly string[]).includes(x);
}

export function makeCatalog(data: { version: number; vehicles: ServerVehicle[]; manufacturers: ServerManufacturer[] }): ServerCatalog {
  const byId = new Map(data.vehicles.map((v) => [v.id, v]));
  const makers = new Map(data.manufacturers.map((m) => [m.id, m]));
  return {
    ...data,
    vehicle: (id) => byId.get(id),
    manufacturer: (id) => makers.get(id),
    countryOf: (v) => makers.get(v.manufacturerId)?.country ?? '??',
  };
}

let loaded: ServerCatalog | null = null;

/** The curated catalog exported from the app by scripts/sync-shared.mjs. */
export function loadCatalog(): ServerCatalog {
  if (!loaded) {
    const raw = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'shared', 'catalog.json'), 'utf8')) as {
      version: number;
      vehicles: ServerVehicle[];
      manufacturers: ServerManufacturer[];
    };
    loaded = makeCatalog(raw);
  }
  return loaded;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Whether a cloud answer supports claiming this catalog vehicle: the make must
 * match the manufacturer (or an alias) and the model must match the model or an
 * alias, with at least a plausible confidence. Generation is not required,
 * because several generations of one model look alike; the player picks one.
 */
export function candidatesSupport(
  catalog: ServerCatalog,
  vehicle: ServerVehicle,
  candidates: { make: string; model: string; confidence: number }[],
  minConfidence = 0.35,
): boolean {
  const maker = catalog.manufacturer(vehicle.manufacturerId);
  if (!maker) return false;
  const makes = new Set([maker.id, maker.name, ...maker.aliases].map(norm));
  const models = [vehicle.model, ...vehicle.aliases].map(norm).filter((m) => m.length > 0);
  return candidates.some((c) => {
    if (c.confidence < minConfidence || !makes.has(norm(c.make))) return false;
    const m = norm(c.model);
    return m.length > 0 && models.some((x) => x === m || (x.length >= 2 && m.startsWith(x)) || (m.length >= 2 && x.startsWith(m)));
  });
}
