/**
 * Fictional vehicle intelligence: the entertainment layer shown on every
 * discovery report.
 *
 * Everything here is SIMULATED and deliberately disconnected from reality:
 * - The tracker and alarm "grades" are drawn from the seed alone. They never
 *   look at the vehicle, its make or its price, so they cannot hint at any
 *   real car's security. VYNR never detects, infers or ranks real security
 *   systems, keys, immobilisers or theft difficulty.
 * - Reputation and collector demand follow VYNR's own rarity tier, which is a
 *   game rule, not market data.
 * - Traits and observations are jokes from a curated, reviewed bank (see
 *   docs/INTEL.md). They are about cars and car culture, never about people.
 *
 * Generation is pure and deterministic: the same vehicle and seed always give
 * the same report, so a registered discovery keeps its intel forever.
 */
import { pick, seededRandom, shuffle } from './rng';
import type { CatalogVehicle, CountryCode, Rarity, VehicleCategory } from './types';

export const INTEL_VERSION = 1;

export const TRACKER_GRADES = ['Standard tracker', 'Advanced tracker', 'Experimental tracker'] as const;
export const ALARM_GRADES = ['Standard alarm', 'Advanced alarm', 'Overdramatic alarm'] as const;
export const REPUTATION_LEVELS = ['Unknown', 'Recognized', 'Respected', 'Iconic', 'Legendary'] as const;
export const DEMAND_LEVELS = ['Low', 'Moderate', 'High', 'Exceptional'] as const;

export interface IntelTrait {
  id: TraitId;
  label: string;
  value: string;
  /** 1 (mild) to 4 (extreme), for the meter. */
  level: 1 | 2 | 3 | 4;
}

export interface VehicleIntel {
  version: number;
  seed: string;
  tracker: (typeof TRACKER_GRADES)[number];
  alarm: (typeof ALARM_GRADES)[number];
  reputation: (typeof REPUTATION_LEVELS)[number];
  collectorDemand: (typeof DEMAND_LEVELS)[number] | 'Unreasonably high';
  traits: IntelTrait[];
  observations: string[];
}

type TraitId =
  | 'attachment'
  | 'financial'
  | 'maintenance'
  | 'coldStart'
  | 'attention'
  | 'garageQueen'
  | 'mainCharacter'
  | 'streetCred'
  | 'obsession';

const TRAITS: Record<TraitId, { label: string; values: [string, string, string, string] }> = {
  attachment: { label: 'Owner attachment', values: ['Casual', 'Fond', 'Emotionally dependent', 'Has named it'] },
  financial: { label: 'Financial damage', values: ['Wallet intact', 'Wallet bruised', 'Wallet compromised', 'Wallet in witness protection'] },
  maintenance: { label: 'Maintenance risk', values: ['Sensible', 'Character-building', 'Financially irresponsible', 'Lives at the dealer'] },
  coldStart: { label: 'Cold-start disturbance', values: ['Polite', 'Noticeable', 'Neighborhood disturbance', 'Registered seismic event'] },
  attention: { label: 'Attention magnet', values: ['Invisible', 'Occasional glance', 'Phones come out', 'Traffic stops'] },
  garageQueen: { label: 'Garage queen probability', values: ['Daily driven', 'Weekend only', 'Covered, dehumidified', 'Has not seen rain'] },
  mainCharacter: { label: 'Main character energy', values: ['Background extra', 'Supporting role', 'Lead', 'Opening credits'] },
  streetCred: { label: 'Street credibility', values: ['Pending', 'Acknowledged', 'Certified', 'Untouchable'] },
  obsession: { label: 'Enthusiast obsession', values: ['Mild interest', 'Forum account', 'Spreadsheet of options', 'Builds a shrine'] },
};

const RARITY_INDEX: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, exotic: 3, legendary: 4 };

interface Context {
  manufacturerId: string;
  category: VehicleCategory;
  rarity: Rarity;
  country: CountryCode;
  electric: boolean;
  /** Approximate first production year. */
  era: number;
}

/** Per-trait bias from the vehicle's category and rarity (added before clamping). */
function traitBias(id: TraitId, c: Context): number {
  const r = RARITY_INDEX[c.rarity];
  const exotic = c.category === 'supercar' || c.category === 'hypercar';
  switch (id) {
    case 'financial':
      return r * 0.7 + (exotic ? 1 : 0);
    case 'maintenance':
      return (c.country === 'IT' || c.country === 'GB' ? 1 : 0) + (exotic ? 0.8 : 0) - (c.electric ? 0.5 : 0) + (c.era < 2000 ? 0.7 : 0);
    case 'coldStart':
      return c.electric ? -9 : (exotic ? 1.5 : 0) + (c.category === 'sports' ? 0.8 : 0) + (c.category === 'pickup' ? 0.5 : 0);
    case 'attention':
      return r * 0.8;
    case 'garageQueen':
      return r * 0.6 + (c.era < 2000 ? 0.6 : 0) - (c.category === 'van' || c.category === 'pickup' ? 1 : 0);
    case 'mainCharacter':
      return r * 0.6 + (c.category === 'convertible' ? 0.6 : 0);
    case 'streetCred':
      return r * 0.5 + (c.category === 'sports' ? 0.8 : 0);
    case 'obsession':
      return r * 0.4 + (c.category === 'sports' || c.category === 'wagon' ? 0.9 : 0);
    case 'attachment':
      return c.era < 2005 ? 1 : 0.3;
  }
}

interface Quip {
  text: string;
  when?: (c: Context) => boolean;
}

const make = (...ids: string[]) => (c: Context) => ids.includes(c.manufacturerId);
const cat = (...cats: VehicleCategory[]) => (c: Context) => cats.includes(c.category);
const atLeast = (r: Rarity) => (c: Context) => RARITY_INDEX[c.rarity] >= RARITY_INDEX[r];

/**
 * The curated observation bank. Specific lines (with `when`) are preferred over
 * generic ones. Rules for additions are in docs/INTEL.md: punch at cars and car
 * culture, never at owners' identity, and never suggest anything about real
 * security, theft or unsafe driving.
 */
export const QUIPS: Quip[] = [
  // Manufacturer-specific
  { text: 'Turn signal usage: allegedly optional.', when: make('bmw') },
  { text: 'Kidney grilles: still growing.', when: make('bmw') },
  { text: 'Will mention the Nürburgring within four minutes.', when: make('porsche') },
  { text: 'Owner can explain every paint-to-sample option. Will.', when: make('porsche') },
  { text: 'Will outlast the heat death of the universe.', when: make('toyota', 'lexus') },
  { text: 'Resale value: defying physics.', when: make('toyota', 'lexus', 'honda') },
  { text: 'Engine note at high revs: a personality change.', when: make('honda') },
  { text: 'Boxer rumble detected. Rally stage not detected.', when: make('subaru') },
  { text: 'Somewhere, a forum is arguing about its spark plugs.', when: make('mazda', 'nissan') },
  { text: 'Three-pointed star: polished more than the windows.', when: make('mercedes-benz') },
  { text: 'Quattro confidence: unreasonably high.', when: make('audi') },
  { text: 'Has a strong opinion about displacement.', when: make('ford', 'chevrolet', 'dodge') },
  { text: 'Tire smoke: a lifestyle, not an event.', when: make('dodge') },
  { text: 'Wave received from another Jeep: probable.', when: make('jeep') },
  { text: 'Software update pending. Personality may change overnight.', when: make('tesla', 'rivian') },
  { text: 'Go-kart handling, as the brochure promised. Twice.', when: make('mini') },
  { text: 'Electrical system: emotionally expressive.', when: make('alfa-romeo', 'maserati', 'jaguar', 'land-rover') },
  { text: 'Prancing horse. Owner also prancing.', when: make('ferrari') },
  { text: 'Doors open upward. Expectations follow.', when: make('lamborghini', 'mclaren') },
  { text: 'Hand-polished. By a person. With a name.', when: make('rolls-royce', 'bentley', 'pagani') },
  { text: 'Weight-saving obsession: has removed a cupholder.', when: make('lotus') },
  { text: 'Owner has been asked "is that a Kia?" Answer: yes, and?', when: make('kia') },
  { text: 'Warranty length: longer than most relationships.', when: make('hyundai', 'kia', 'genesis') },
  { text: 'Says "eleven-tenths" without irony.', when: make('aston-martin') },
  // Category-specific
  { text: 'Bed has carried exactly one bag of mulch.', when: cat('pickup') },
  { text: 'Tow rating: quoted at parties.', when: cat('pickup') },
  { text: 'Has never left the pavement. Owns recovery boards anyway.', when: cat('offroad', 'suv') },
  { text: 'Insurance quote: please sit down first.', when: cat('supercar', 'hypercar') },
  { text: 'Speed bumps approached at a geological pace.', when: cat('supercar', 'hypercar', 'sports') },
  { text: 'The enthusiast’s secret handshake.', when: cat('wagon') },
  { text: 'Roof down at 12°C. Heated seats on. Committed.', when: cat('convertible') },
  { text: 'Fits a family, a dog and a flat-pack wardrobe. Not at once.', when: cat('van', 'wagon', 'suv') },
  { text: 'Hatch practicality: suspiciously competent.', when: cat('hatchback') },
  { text: 'Cold start: suspiciously silent.', when: (c) => c.electric },
  { text: 'Range anxiety: owner’s, not the car’s.', when: (c) => c.electric },
  { text: 'Owns a dedicated microfibre towel budget.', when: cat('sports', 'coupe', 'supercar') },
  // Rarity and era
  { text: 'People are filming this. You are filming this.', when: atLeast('exotic') },
  { text: 'Spotting this counts as a personal milestone.', when: atLeast('legendary') },
  { text: 'Has more fans than most bands.', when: atLeast('rare') },
  { text: 'Older than some of its admirers. Wears it well.', when: (c) => c.era < 2000 },
  { text: 'Pop-up nostalgia levels: critical.', when: (c) => c.era < 1995 },
  // Generic
  { text: 'Parks across two spaces “for safety”.' },
  { text: 'Has seen more car meets than oil changes.' },
  { text: 'Cupholder count: adequate. Owner disagrees.' },
  { text: 'Washed more often than its owner’s other car.' },
  { text: 'Exhaust tips: polished. Mirrors: also polished.' },
  { text: 'Probably has a playlist named after it.' },
  { text: 'Air freshener selection: a deliberate statement.' },
  { text: 'Owner checks it from the restaurant window.' },
  { text: 'Commute companion of the year, three years running.' },
  { text: 'Unremarkable to most. Deeply remarkable to one person.' },
];

export interface IntelInput {
  vehicle: Pick<CatalogVehicle, 'manufacturerId' | 'category' | 'rarity' | 'electric' | 'yearStart'>;
  country: CountryCode;
  /** Stable seed, e.g. the scan or encounter id. */
  seed: string;
  /** Observations recently shown to this player, avoided where possible for variety. */
  avoid?: ReadonlySet<string>;
}

const clampLevel = (n: number): 1 | 2 | 3 | 4 => Math.max(1, Math.min(4, Math.round(n))) as 1 | 2 | 3 | 4;

export function generateIntel({ vehicle, country, seed, avoid }: IntelInput): VehicleIntel {
  const ctx: Context = {
    manufacturerId: vehicle.manufacturerId,
    category: vehicle.category,
    rarity: vehicle.rarity,
    country,
    electric: vehicle.electric,
    era: vehicle.yearStart,
  };
  // Separate streams so adding a trait never reshuffles the security-free grades.
  const gradeRand = seededRandom(`grade:${seed}`);
  const rand = seededRandom(`intel:${seed}`);
  const r = RARITY_INDEX[vehicle.rarity];

  const tracker = pick(gradeRand, TRACKER_GRADES);
  const alarm = pick(gradeRand, ALARM_GRADES);

  const repIndex = Math.max(0, Math.min(4, r + (rand() < 0.3 ? 1 : 0) - (rand() < 0.15 ? 1 : 0)));
  const reputation = REPUTATION_LEVELS[repIndex]!;
  const demandIndex = Math.max(0, Math.min(3, Math.round(r * 0.75 + (rand() - 0.5))));
  const collectorDemand = vehicle.rarity === 'legendary' && rand() < 0.5 ? 'Unreasonably high' : DEMAND_LEVELS[demandIndex]!;

  const traitIds = shuffle(rand, Object.keys(TRAITS) as TraitId[]).slice(0, 4);
  const traits: IntelTrait[] = traitIds.map((id) => {
    const level = clampLevel(1.5 + rand() * 1.6 + traitBias(id, ctx));
    return { id, label: TRAITS[id].label, value: TRAITS[id].values[level - 1]!, level };
  });

  const specific = shuffle(rand, QUIPS.filter((q) => q.when?.(ctx)));
  const generic = shuffle(rand, QUIPS.filter((q) => !q.when));
  const fresh = (q: Quip) => !avoid?.has(q.text);
  const ordered = [...specific.filter(fresh), ...generic.filter(fresh), ...specific.filter((q) => !fresh(q)), ...generic.filter((q) => !fresh(q))];
  const observations = ordered.slice(0, 3).map((q) => q.text);

  return { version: INTEL_VERSION, seed, tracker, alarm, reputation, collectorDemand, traits, observations };
}

/** Strict parse of a stored intel record; returns null for anything malformed. */
export function parseIntel(json: string | null): VehicleIntel | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Partial<VehicleIntel>;
    if (
      typeof v.seed !== 'string' ||
      !TRACKER_GRADES.includes(v.tracker as never) ||
      !ALARM_GRADES.includes(v.alarm as never) ||
      !Array.isArray(v.traits) ||
      !Array.isArray(v.observations)
    ) {
      return null;
    }
    return v as VehicleIntel;
  } catch {
    return null;
  }
}
