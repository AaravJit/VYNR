import { type Catalog } from '@/catalog';
import type { SqlDriver } from '@/db/driver';
import { migrate } from '@/db/migrations';
import { GameRepository, type Player, type Settings, DEFAULT_SETTINGS } from '@/db/repository';
import { ACHIEVEMENTS, achievementProgress } from '@/domain/achievements';
import type { GameConfig } from '@/domain/config';
import type { EncounterInput, EncounterOutcome } from '@/domain/engine';
import { levelInfo, type LevelInfo } from '@/domain/progression';
import { computeStats, type PlayerStats } from '@/domain/stats';
import { dayKey, periodKey } from '@/domain/time';
import type { AwardRecord, Contract, EncounterRecord } from '@/domain/types';
import { CLIENT_DAILY_RECOGNITION_LIMIT } from '@/recognition/config';
import { type Clock, GameService, sanitizeUsername, systemClock } from '@/services/gameService';

export interface AchievementView {
  key: string;
  title: string;
  description: string;
  xp: number;
  progress: number;
  target: number;
  unlockedAt: number | null;
}

export interface AppState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  player: Player | null;
  settings: Settings;
  totalXp: number;
  level: LevelInfo;
  encounters: EncounterRecord[];
  contracts: Contract[];
  awards: AwardRecord[];
  stats: PlayerStats;
  achievements: AchievementView[];
  /** Incremented on every reload so views can memoise cheaply. */
  revision: number;
}

type Listener = () => void;

export interface AppStoreDeps {
  openDriver: () => Promise<SqlDriver>;
  catalog: Catalog;
  config: GameConfig;
  newId: () => string;
  clock?: Clock;
  /** Called with photo URIs that must be deleted when the player wipes their data. */
  deletePhotos?: (uris: string[]) => void;
  /** Deletes one saved photo (used when an encounter fails to save). */
  deletePhoto?: (uri: string) => void;
}

/**
 * Single source of truth for UI state. SQLite is authoritative; the store holds
 * a derived, read-only view that is rebuilt after every mutation. Exposes a
 * subscribe/getState pair for React's useSyncExternalStore.
 */
export class AppStore {
  private state: AppState;
  private listeners = new Set<Listener>();
  private repo: GameRepository | null = null;
  private game: GameService | null = null;
  private readonly clock: Clock;

  constructor(private readonly deps: AppStoreDeps) {
    this.clock = deps.clock ?? systemClock;
    this.state = this.emptyState('loading');
  }

  private emptyState(status: AppState['status'], error: string | null = null): AppState {
    const stats = computeStats([], this.deps.catalog, this.clock.now());
    return {
      status,
      error,
      player: null,
      settings: { ...DEFAULT_SETTINGS },
      totalXp: 0,
      level: levelInfo(0, this.deps.config),
      encounters: [],
      contracts: [],
      awards: [],
      stats,
      achievements: this.achievementViews(stats, [], []),
      revision: 0,
    };
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getState = (): AppState => this.state;

  private set(next: AppState) {
    this.state = next;
    for (const l of this.listeners) l();
  }

  private requireReady(): { repo: GameRepository; game: GameService; player: Player } {
    if (!this.repo || !this.game || !this.state.player) throw new Error('Store not initialised');
    return { repo: this.repo, game: this.game, player: this.state.player };
  }

  async init(): Promise<void> {
    try {
      const driver = await this.deps.openDriver();
      await migrate(driver);
      this.repo = new GameRepository(driver);
      this.game = new GameService(this.repo, this.deps.catalog, this.deps.config, this.deps.newId, this.clock);
      await this.game.init();
      await this.reload();
    } catch (e) {
      this.set(this.emptyState('error', e instanceof Error ? e.message : String(e)));
    }
  }

  private achievementViews(stats: PlayerStats, awards: AwardRecord[], contracts: Contract[]): AchievementView[] {
    const ctx = { stats, contractsCompleted: contracts.filter((c) => c.completedAt !== null).length };
    const unlocked = new Map(awards.map((a) => [a.key, a.awardedAt]));
    return ACHIEVEMENTS.map((def) => ({
      key: def.key,
      title: def.title,
      description: def.description,
      xp: def.xp,
      progress: achievementProgress(def, ctx),
      target: def.target,
      unlockedAt: unlocked.get(`achievement:${def.key}`) ?? null,
    }));
  }

  async reload(): Promise<void> {
    if (!this.repo || !this.game) return;
    const player = await this.repo.getPlayer();
    if (!player) {
      await this.game.init();
      return this.reload();
    }
    await this.game.refreshContracts(player.id);
    const [settings, snapshot] = await Promise.all([this.repo.getSettings(), this.repo.loadSnapshot(player.id)]);
    const now = this.clock.now();
    const stats = computeStats(snapshot.encounters, this.deps.catalog, now);
    this.set({
      status: 'ready',
      error: null,
      player,
      settings,
      totalXp: snapshot.totalXp,
      level: levelInfo(snapshot.totalXp, this.deps.config),
      encounters: snapshot.encounters,
      contracts: snapshot.contracts,
      awards: snapshot.awards,
      stats,
      achievements: this.achievementViews(stats, snapshot.awards, snapshot.contracts),
      revision: this.state.revision + 1,
    });
  }

  /** Contracts for the current daily and weekly periods. */
  currentContracts(): { daily: Contract[]; weekly: Contract[] } {
    const now = this.clock.now();
    const d = periodKey('daily', now);
    const w = periodKey('weekly', now);
    return {
      daily: this.state.contracts.filter((c) => c.periodKey === d),
      weekly: this.state.contracts.filter((c) => c.periodKey === w),
    };
  }

  async recordEncounter(input: Omit<EncounterInput, 'now'>): Promise<EncounterOutcome> {
    const { game, player } = this.requireReady();
    let outcome: EncounterOutcome;
    try {
      outcome = await game.recordEncounter(player.id, input);
    } catch (e) {
      // Nothing was recorded, so a photo saved for this encounter would be orphaned: remove it.
      if (input.photoUri) this.deps.deletePhoto?.(input.photoUri);
      throw e;
    }
    await this.reload();
    return outcome;
  }

  async setUsername(raw: string): Promise<boolean> {
    const { repo } = this.requireReady();
    const name = sanitizeUsername(raw);
    if (!name) return false;
    await repo.setUsername(name);
    await this.reload();
    return true;
  }

  async setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    const { repo } = this.requireReady();
    await repo.setSetting(key, value);
    await this.reload();
  }

  async completeOnboarding(username: string, cloudConsent: boolean): Promise<boolean> {
    const { repo } = this.requireReady();
    const name = sanitizeUsername(username);
    if (!name) return false;
    await repo.setUsername(name);
    await repo.setSetting('cloudRecognitionConsent', cloudConsent);
    await repo.setSetting('safetyAcknowledged', true);
    await repo.setOnboarded(this.clock.now());
    await this.reload();
    return true;
  }

  /** Remaining automatic identifications today (client-side cost control). */
  async recognitionAllowance(): Promise<number> {
    const { repo } = this.requireReady();
    const used = await repo.recognitionCount(dayKey(this.clock.now()));
    return Math.max(0, CLIENT_DAILY_RECOGNITION_LIMIT - used);
  }

  async noteRecognitionUsed(): Promise<void> {
    const { repo } = this.requireReady();
    await repo.incrementRecognition(dayKey(this.clock.now()));
  }

  async exportData(): Promise<Record<string, unknown>> {
    const { repo } = this.requireReady();
    return { ...(await repo.exportAll()), exportedAt: new Date(this.clock.now()).toISOString() };
  }

  /** Deletes every local record and photo, then starts a fresh profile. */
  async deleteAllData(): Promise<void> {
    const { repo, game } = this.requireReady();
    const photos = await repo.wipeAll();
    this.deps.deletePhotos?.(photos);
    await game.init();
    await this.reload();
  }
}
