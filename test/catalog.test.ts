import { catalog, formatYears, MANUFACTURERS, normalizeText, VEHICLES } from '@/catalog';
import { CATEGORIES, COUNTRIES, RARITIES } from '@/domain/types';

describe('vehicle catalog integrity', () => {
  it('has unique, URL-safe ids', () => {
    const ids = VEHICLES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('references only known manufacturers, with valid enums and sane year ranges', () => {
    const makers = new Set(MANUFACTURERS.map((m) => m.id));
    for (const v of VEHICLES) {
      expect(makers.has(v.manufacturerId)).toBe(true);
      expect(RARITIES).toContain(v.rarity);
      expect(CATEGORIES).toContain(v.category);
      expect(v.yearStart).toBeGreaterThanOrEqual(1930);
      expect(v.yearStart).toBeLessThanOrEqual(2026);
      if (v.yearEnd !== null) expect(v.yearEnd).toBeGreaterThanOrEqual(v.yearStart);
      expect(v.generation.length).toBeGreaterThan(0);
    }
  });

  it('covers every target country and every rarity tier', () => {
    for (const c of COUNTRIES) expect(VEHICLES.some((v) => catalog.countryOf(v) === c)).toBe(true);
    for (const r of RARITIES) expect(VEHICLES.some((v) => v.rarity === r)).toBe(true);
  });

  it('has no duplicate model+generation pairs per manufacturer', () => {
    const keys = VEHICLES.map((v) => `${v.manufacturerId}|${normalizeText(v.model)}|${normalizeText(v.generation)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('stores no technical specifications', () => {
    const allowed = ['id', 'manufacturerId', 'model', 'generation', 'yearStart', 'yearEnd', 'category', 'rarity', 'electric', 'aliases'];
    for (const v of VEHICLES) expect(Object.keys(v).sort()).toEqual([...allowed].sort());
  });
});

describe('catalog helpers', () => {
  it('searches case- and diacritic-insensitively across aliases', () => {
    expect(catalog.search('huracan').map((v) => v.id)).toContain('lamborghini-huracan');
    expect(catalog.search('miata').map((v) => v.id)).toContain('mazda-mx-5-nd');
    expect(catalog.search('VW golf').map((v) => v.id)).toEqual(expect.arrayContaining(['volkswagen-golf-mk8']));
    expect(catalog.search('').length).toBe(VEHICLES.length);
  });

  it('formats production ranges as estimates', () => {
    expect(formatYears({ yearStart: 2019, yearEnd: null })).toBe('2019–present');
    expect(formatYears({ yearStart: 1993, yearEnd: 2002 })).toBe('1993–2002');
  });
});
