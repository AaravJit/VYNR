import { Catalog } from '@/catalog';
import type { GameConfig } from '@/domain/config';
import { GAME_CONFIG } from '@/domain/config';
import type { CatalogVehicle, GameSnapshot, Manufacturer } from '@/domain/types';

/** Wednesday 25 Nov 2026, 12:00 UTC. */
export const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export function idFactory(prefix = 'id'): () => string {
  let n = 0;
  return () => `${prefix}-${String(++n).padStart(4, '0')}`;
}

export const config: GameConfig = GAME_CONFIG;

/** A tiny catalog so completion/bonus maths is easy to reason about. */
export function smallCatalog(): Catalog {
  const manufacturers: Manufacturer[] = [
    { id: 'alpha', name: 'Alpha', country: 'JP', aliases: ['alfa motors'] },
    { id: 'beta', name: 'Beta', country: 'DE', aliases: [] },
  ];
  const v = (id: string, manufacturerId: string, model: string, generation: string, rarity: CatalogVehicle['rarity'], extra: Partial<CatalogVehicle> = {}): CatalogVehicle => ({
    id,
    manufacturerId,
    model,
    generation,
    yearStart: 2015,
    yearEnd: null,
    category: 'sedan',
    rarity,
    electric: false,
    aliases: [],
    ...extra,
  });
  return new Catalog(
    [
      v('a1', 'alpha', 'Runner', 'R1', 'common'),
      v('a2', 'alpha', 'Runner', 'R2', 'common'),
      v('a3', 'alpha', 'Bolt', 'B1', 'legendary', { category: 'hypercar', electric: true }),
      v('b1', 'beta', 'Cruiser', 'C1', 'rare', { category: 'suv' }),
    ],
    manufacturers,
  );
}

export function emptySnapshot(playerId = 'player-1'): GameSnapshot {
  return { playerId, totalXp: 0, encounters: [], contracts: [], awards: [] };
}
