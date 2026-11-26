import { catalog } from '@/catalog';
import { attributionFor, DATA_SOURCES, isApproved } from '@/catalog/dataSources';
import { getSpecs, getStoredSpecs, SPECS_SOURCE, specsAttribution } from '@/catalog/specs';
import { SPECS } from '@/catalog/specs.data';

describe('stored specification records', () => {
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

describe('licensing register', () => {
  it('serves the Wikipedia specs only because the owner approved them, with full CC BY-SA attribution', () => {
    const source = DATA_SOURCES[SPECS_SOURCE];
    expect(source.status).toBe('approved');
    expect(source.approval).toEqual({ by: 'owner', on: '2026-11-26' });
    const a = specsAttribution();
    expect(a).toBeDefined();
    expect(a!.creator).toBe('Wikipedia contributors');
    expect(a!.licenceName).toBe('CC BY-SA 4.0');
    expect(a!.licenceUrl).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
    expect(a!.changes.length).toBeGreaterThan(0);
    expect(a!.adaptedDataUrl).toMatch(/^https:\/\/.+data\/specs\.json$/);
    for (const id of Object.keys(SPECS)) expect(getSpecs(id)).toBe(getStoredSpecs(id));
  });

  it('treats an approval without a recorded sign-off or attribution as not approved', () => {
    const entry = DATA_SOURCES[SPECS_SOURCE] as unknown as Record<string, unknown>;
    const saved = { approval: entry.approval, attribution: entry.attribution };
    try {
      delete entry.approval;
      expect(isApproved(SPECS_SOURCE)).toBe(false);
      expect(getSpecs(Object.keys(SPECS)[0]!)).toBeUndefined();
      entry.approval = saved.approval;
      delete entry.attribution;
      expect(isApproved(SPECS_SOURCE)).toBe(false);
      expect(attributionFor(SPECS_SOURCE)).toBeUndefined();
    } finally {
      Object.assign(entry, saved);
    }
    expect(isApproved(SPECS_SOURCE)).toBe(true);
  });
});
