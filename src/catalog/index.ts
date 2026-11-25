import type {
  CatalogVehicle,
  CountryCode,
  Manufacturer,
  Rarity,
  VehicleCategory,
} from '@/domain/types';
import { RARITIES } from '@/domain/types';

import { MANUFACTURERS } from './manufacturers';
import { CATALOG_VERSION, VEHICLES } from './vehicles';

export { CATALOG_VERSION, MANUFACTURERS, VEHICLES };

export const COUNTRY_NAMES: Record<CountryCode, string> = {
  JP: 'Japan',
  DE: 'Germany',
  US: 'United States',
  GB: 'United Kingdom',
  IT: 'Italy',
  KR: 'South Korea',
};

export const CATEGORY_LABELS: Record<VehicleCategory, string> = {
  sedan: 'Sedan',
  hatchback: 'Hatchback',
  wagon: 'Wagon',
  coupe: 'Coupe',
  convertible: 'Convertible',
  suv: 'SUV',
  pickup: 'Pickup',
  van: 'Van',
  sports: 'Sports car',
  supercar: 'Supercar',
  hypercar: 'Hypercar',
  offroad: 'Off-roader',
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  exotic: 'Exotic',
  legendary: 'Legendary',
};

export function rarityRank(r: Rarity): number {
  return RARITIES.indexOf(r);
}

/** A read-only, indexed view over the catalog. Pure and injectable for tests. */
export class Catalog {
  readonly vehicles: readonly CatalogVehicle[];
  readonly manufacturers: readonly Manufacturer[];
  private readonly vehicleById: Map<string, CatalogVehicle>;
  private readonly manufacturerById: Map<string, Manufacturer>;

  constructor(vehicles: CatalogVehicle[], manufacturers: Manufacturer[]) {
    this.vehicles = vehicles;
    this.manufacturers = manufacturers;
    this.vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    this.manufacturerById = new Map(manufacturers.map((m) => [m.id, m]));
  }

  getVehicle(id: string): CatalogVehicle | undefined {
    return this.vehicleById.get(id);
  }

  getManufacturer(id: string): Manufacturer | undefined {
    return this.manufacturerById.get(id);
  }

  countryOf(vehicle: CatalogVehicle): CountryCode {
    const m = this.manufacturerById.get(vehicle.manufacturerId);
    if (!m) throw new Error(`Unknown manufacturer ${vehicle.manufacturerId}`);
    return m.country;
  }

  vehiclesByManufacturer(manufacturerId: string): CatalogVehicle[] {
    return this.vehicles.filter((v) => v.manufacturerId === manufacturerId);
  }

  displayName(vehicle: CatalogVehicle): string {
    const m = this.manufacturerById.get(vehicle.manufacturerId);
    return `${m?.name ?? ''} ${vehicle.model}`.trim();
  }

  /** Simple case/diacritic-insensitive search over manufacturer, model, generation and aliases. */
  search(query: string): CatalogVehicle[] {
    const q = normalizeText(query);
    if (!q) return [...this.vehicles];
    const terms = q.split(' ').filter(Boolean);
    return this.vehicles.filter((v) => {
      const m = this.manufacturerById.get(v.manufacturerId);
      const haystack = normalizeText(
        [m?.name, ...(m?.aliases ?? []), v.model, v.generation, ...v.aliases].join(' '),
      );
      return terms.every((t) => haystack.includes(t));
    });
  }
}

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim();
}

/** Formats an estimated production range, always marked as approximate. */
export function formatYears(v: Pick<CatalogVehicle, 'yearStart' | 'yearEnd'>): string {
  return v.yearEnd === null ? `${v.yearStart}–present` : `${v.yearStart}–${v.yearEnd}`;
}

export const catalog = new Catalog(VEHICLES, MANUFACTURERS);
