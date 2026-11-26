import type { Catalog } from '@/catalog';
import { hashString, pick, seededRandom } from '@/domain/rng';
import type { Rarity } from '@/domain/types';

import type { PreparedImage, RecognitionProvider, RecognitionResult } from './types';

/** Probability weights used by the mock to roughly mimic real-world sighting frequency. */
const RARITY_WEIGHTS: [Rarity, number][] = [
  ['common', 0.55],
  ['uncommon', 0.25],
  ['rare', 0.12],
  ['exotic', 0.06],
  ['legendary', 0.02],
];

export interface MockProviderOptions {
  latencyMs?: number;
  /** Fixed seed for deterministic tests. Otherwise derived from the image. */
  seed?: string;
  /** Probability [0..1] of returning "no vehicle detected". */
  noVehicleRate?: number;
}

/**
 * DEVELOPMENT-ONLY provider. It does not look at the image content: it returns a
 * plausible, clearly-flagged *simulated* prediction drawn from the catalog so
 * the full game loop can be tested without a paid recognition API.
 */
export class MockRecognitionProvider implements RecognitionProvider {
  readonly id = 'mock';
  readonly simulated = true;
  private counter = 0;

  constructor(
    private readonly catalog: Catalog,
    private readonly options: MockProviderOptions = {},
  ) {}

  async recognize(image: PreparedImage | null, signal?: AbortSignal): Promise<RecognitionResult> {
    const latency = this.options.latencyMs ?? 900;
    if (latency > 0) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, latency);
        signal?.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new Error('aborted'));
        });
      });
    }
    this.counter++;
    const seed =
      this.options.seed ??
      `${image ? hashString(image.base64.slice(0, 4096)) + image.base64.length : 'noimg'}:${this.counter}:${Date.now()}`;
    const rand = seededRandom(seed);

    if (rand() < (this.options.noVehicleRate ?? 0.05)) {
      return { vehicleDetected: false, candidates: [], notes: 'Simulated: no vehicle detected.', provider: this.id, simulated: true };
    }

    let roll = rand();
    let rarity: Rarity = 'common';
    for (const [r, w] of RARITY_WEIGHTS) {
      if (roll < w) {
        rarity = r;
        break;
      }
      roll -= w;
    }
    const pool = this.catalog.vehicles.filter((v) => v.rarity === rarity);
    const primary = pick(rand, pool.length > 0 ? pool : this.catalog.vehicles);
    const alternates = this.catalog.vehicles.filter((v) => v.category === primary.category && v.id !== primary.id);
    const top = 0.45 + rand() * 0.5;
    const candidates = [primary];
    for (let i = 0; i < 2 && alternates.length > 0; i++) {
      const alt = alternates.splice(Math.floor(rand() * alternates.length), 1)[0]!;
      candidates.push(alt);
    }
    return {
      vehicleDetected: true,
      candidates: candidates.map((v, i) => ({
        make: this.catalog.getManufacturer(v.manufacturerId)?.name ?? v.manufacturerId,
        model: v.model,
        generation: v.generation,
        confidence: Math.round((i === 0 ? top : top * (0.4 - i * 0.1)) * 100) / 100,
      })),
      notes: 'Simulated result (development mode).',
      provider: this.id,
      simulated: true,
    };
  }
}
