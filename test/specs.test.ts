import { catalog } from '@/catalog';
import { getSpecs } from '@/catalog/specs';
import { SPECS } from '@/catalog/specs.data';

describe('verified specifications', () => {
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
