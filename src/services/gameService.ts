import type { Catalog } from '@/catalog';
import type { GameRepository, Player } from '@/db/repository';
import type { GameConfig } from '@/domain/config';
import { applyEncounter, type EncounterInput, type EncounterOutcome, missingContracts } from '@/domain/engine';

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export const USERNAME_PATTERN = /^[A-Za-z0-9_\-. ]{3,20}$/;

export function sanitizeUsername(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  return USERNAME_PATTERN.test(name) ? name : null;
}

/**
 * Application service that coordinates the pure progression engine with
 * persistence. All game-state mutations go through here.
 */
export class GameService {
  constructor(
    private readonly repo: GameRepository,
    private readonly catalog: Catalog,
    private readonly config: GameConfig,
    private readonly newId: () => string,
    private readonly clock: Clock = systemClock,
  ) {}

  /** Ensures a local player exists and the current contracts are generated. */
  async init(): Promise<Player> {
    let player = await this.repo.getPlayer();
    if (!player) {
      const id = this.newId();
      const suffix = id.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase();
      player = await this.repo.createPlayer(id, `Spotter-${suffix}`, this.clock.now());
    }
    await this.refreshContracts(player.id);
    return player;
  }

  async refreshContracts(playerId: string): Promise<void> {
    const existing = await this.repo.listContracts();
    const missing = missingContracts(playerId, existing, this.clock.now(), this.config);
    if (missing.length > 0) await this.repo.upsertContracts(missing);
  }

  async recordEncounter(playerId: string, input: Omit<EncounterInput, 'now'>): Promise<EncounterOutcome> {
    const snapshot = await this.repo.loadSnapshot(playerId);
    const outcome = applyEncounter(
      snapshot,
      { ...input, now: this.clock.now() },
      this.catalog,
      this.config,
      this.newId,
    );
    await this.repo.persistOutcome(outcome);
    return outcome;
  }
}
