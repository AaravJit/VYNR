import { catalog } from '@/catalog';
import { ALARM_GRADES, generateIntel, parseIntel, TRACKER_GRADES } from '@/domain/intel';

const input = (id: string, seed: string, avoid?: ReadonlySet<string>) => {
  const vehicle = catalog.getVehicle(id)!;
  return { vehicle, country: catalog.countryOf(vehicle), seed, avoid };
};

describe('simulated street intel', () => {
  it('is deterministic for the same seed', () => {
    expect(generateIntel(input('bmw-m3-g80', 's1'))).toEqual(generateIntel(input('bmw-m3-g80', 's1')));
  });

  it('derives tracker and alarm grades from the seed only, never from the real vehicle', () => {
    // Same seed, very different vehicles: the simulated security grades must be identical.
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const cheap = generateIntel(input('toyota-corolla-e210', seed));
      const hyper = generateIntel(input('ferrari-laferrari', seed));
      expect(hyper.tracker).toBe(cheap.tracker);
      expect(hyper.alarm).toBe(cheap.alarm);
      expect(TRACKER_GRADES).toContain(cheap.tracker);
      expect(ALARM_GRADES).toContain(cheap.alarm);
    }
  });

  it('produces varied, non-repeating observations and honours the avoid set', () => {
    const first = generateIntel(input('honda-civic-type-r-fl5', 'x1'));
    expect(new Set(first.observations).size).toBe(first.observations.length);
    expect(first.traits).toHaveLength(4);
    const next = generateIntel(input('honda-civic-type-r-fl5', 'x1', new Set(first.observations)));
    expect(next.observations.some((o) => first.observations.includes(o))).toBe(false);
  });

  it('never mentions real-world security capabilities or theft', () => {
    const banned = /(immobili[sz]er|key ?fob|relay attack|easy to steal|steal|theft|unlock|bypass|vulnerab)/i;
    for (const v of catalog.vehicles) {
      for (const seed of ['1', '2', '3']) {
        const i = generateIntel(input(v.id, seed));
        const text = [...i.observations, ...i.traits.map((t) => `${t.label} ${t.value}`)].join(' ');
        expect(text).not.toMatch(banned);
      }
    }
  });

  it('round-trips through JSON and rejects malformed rows', () => {
    const i = generateIntel(input('kia-ev6', 'r'));
    expect(parseIntel(JSON.stringify(i))).toEqual(i);
    expect(parseIntel('not json')).toBeNull();
    expect(parseIntel(null)).toBeNull();
  });
});
