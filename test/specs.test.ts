import { catalog } from '@/catalog';
import { DATA_SOURCES } from '@/catalog/dataSources';
import { getQuarantinedSpecs, getSpecs, SPECS_SOURCE } from '@/catalog/specs';
import { SPECS } from '@/catalog/specs.data';

describe('stored specification records (quarantined)', () => {
  const entries = Object.entries(SPECS);

  it('covers a meaningful part of the catalog', () => {
    expect(entries.length).toBeGreaterThanOrEqual(60);
  });

  it.each(entries)('%s belongs to the catalog and cites https sources', (id, s) => {
    expect(catalog.getVehicle(id)).toBeDefined();
    expect(s.sources.length).toBeGreaterThan(0);
    for (const src of s.sources) expect(src.url).toMatch(/^https:\/\//);
    for (const e of s.engines) {
      for (const n of [e.powerHp, e.powerKw, e.torqueNm, e.displacementCc]) {
        if (n != null) expect(n).toBeGreaterThan(0);
      }
    }
  });

  it('returns nothing for a generation without verified specs', () => {
    const missing = catalog.vehicles.find((v) => !SPECS[v.id]);
    expect(missing).toBeDefined();
    expect(getSpecs(missing!.id)).toBeUndefined();
  });
});

describe('licensing quarantine', () => {
  it('never serves specs from a source that is not approved', () => {
    expect(DATA_SOURCES[SPECS_SOURCE].status).toBe('quarantined');
    for (const id of Object.keys(SPECS)) {
      expect(getQuarantinedSpecs(id)).toBeDefined();
      expect(getSpecs(id)).toBeUndefined();
    }
  });
});
