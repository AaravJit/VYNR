import { catalog } from '@/catalog';
import { resolveRecognitionConfig } from '@/recognition/config';
import { confidenceBand, matchCandidates } from '@/recognition/matcher';
import { MockRecognitionProvider } from '@/recognition/mockProvider';
import { RemoteRecognitionProvider } from '@/recognition/remoteProvider';
import { RecognitionError } from '@/recognition/types';
import { parseRecognitionResponse } from '@/recognition/validate';

const image = { base64: '/9j/AAAA', width: 1024, height: 768 };

describe('parseRecognitionResponse', () => {
  it('accepts a well-formed payload and sorts by confidence', () => {
    const r = parseRecognitionResponse({
      vehicleDetected: true,
      candidates: [
        { make: 'BMW', model: 'M3', generation: 'G80', confidence: 0.4 },
        { make: 'BMW', model: '3 Series', generation: null, confidence: 0.9 },
      ],
      notes: 'clear side profile',
      extra: 'ignored',
    });
    expect(r?.candidates.map((c) => c.confidence)).toEqual([0.9, 0.4]);
    expect(r).not.toHaveProperty('extra');
  });

  it.each([
    null,
    'string',
    [],
    { vehicleDetected: 'yes', candidates: [] },
    { vehicleDetected: true },
    { vehicleDetected: true, candidates: [{ make: 'BMW', model: 'M3', confidence: 1.4 }] },
    { vehicleDetected: true, candidates: [{ make: 'BMW', model: 'M3', confidence: Number.NaN }] },
    { vehicleDetected: true, candidates: [{ make: '', model: 'M3', confidence: 0.5 }] },
    { vehicleDetected: true, candidates: [{ make: 'BMW', model: 7, confidence: 0.5 }] },
    { vehicleDetected: true, candidates: ['BMW M3'] },
  ])('rejects malformed payload %#', (payload) => {
    expect(parseRecognitionResponse(payload)).toBeNull();
  });

  it('strips control characters, truncates long strings and caps candidate count', () => {
    const r = parseRecognitionResponse({
      vehicleDetected: true,
      candidates: Array.from({ length: 9 }, (_, i) => ({ make: `Ford\u0000\n`, model: 'X'.repeat(500), confidence: i / 10 })),
      notes: null,
    });
    expect(r?.candidates).toHaveLength(5);
    expect(r?.candidates[0]?.make).toBe('Ford');
    expect(r?.candidates[0]?.model).toHaveLength(60);
  });

  it('drops candidates when no vehicle is detected', () => {
    const r = parseRecognitionResponse({ vehicleDetected: false, candidates: [{ make: 'Ford', model: 'GT', confidence: 0.2 }], notes: 'blurry' });
    expect(r).toEqual({ vehicleDetected: false, candidates: [], notes: 'blurry' });
  });
});

describe('matchCandidates', () => {
  it('maps make aliases and model aliases onto catalog entries', () => {
    const { matches } = matchCandidates(catalog, [{ make: 'VW', model: 'Golf GTI', generation: 'Mk8', confidence: 0.91 }]);
    expect(matches[0]?.vehicle.id).toBe('volkswagen-golf-gti-mk8');
    expect(matches[0]?.quality).toBe('generation');
  });

  it('prefers the most specific model name', () => {
    const { matches } = matchCandidates(catalog, [{ make: 'Honda', model: 'Civic Type R', generation: null, confidence: 0.8 }]);
    expect(matches[0]?.vehicle.id).toBe('honda-civic-type-r-fl5');
  });

  it('disambiguates generations when provided, and offers all when not', () => {
    const specific = matchCandidates(catalog, [{ make: 'Ford', model: 'Mustang', generation: 'S650', confidence: 0.7 }]);
    expect(specific.matches.map((m) => m.vehicle.id)).toEqual(['ford-mustang-s650']);
    const vague = matchCandidates(catalog, [{ make: 'Ford', model: 'Mustang', generation: null, confidence: 0.7 }]);
    expect(vague.matches.map((m) => m.vehicle.id).sort()).toEqual(['ford-mustang-s550', 'ford-mustang-s650']);
    expect(vague.matches.every((m) => m.quality === 'model')).toBe(true);
  });

  it('keeps the generation uncertain when the prediction names none, even with a single catalog match', () => {
    const { matches } = matchCandidates(catalog, [{ make: 'Toyota', model: 'Corolla', generation: null, confidence: 0.9 }]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.quality).toBe('model');
  });

  it('reports predictions not present in the catalog', () => {
    const { matches, unmatched } = matchCandidates(catalog, [{ make: 'Koenigsegg', model: 'Jesko', generation: null, confidence: 0.6 }]);
    expect(matches).toHaveLength(0);
    expect(unmatched).toHaveLength(1);
  });

  it('bands confidence', () => {
    expect([0.95, 0.8, 0.79, 0.5, 0.49].map(confidenceBand)).toEqual(['high', 'high', 'medium', 'medium', 'low']);
  });
});

describe('MockRecognitionProvider', () => {
  it('is flagged as simulated and returns catalog-matchable predictions', async () => {
    const p = new MockRecognitionProvider(catalog, { latencyMs: 0, seed: 'fixed', noVehicleRate: 0 });
    const r = await p.recognize(image);
    expect(p.simulated).toBe(true);
    expect(r.simulated).toBe(true);
    expect(parseRecognitionResponse(r)).not.toBeNull();
    expect(matchCandidates(catalog, r.candidates).matches.length).toBeGreaterThan(0);
  });

  it('is deterministic for a fixed seed', async () => {
    const a = await new MockRecognitionProvider(catalog, { latencyMs: 0, seed: 's' }).recognize(null);
    const b = await new MockRecognitionProvider(catalog, { latencyMs: 0, seed: 's' }).recognize(null);
    expect(a).toEqual(b);
  });
});

describe('RemoteRecognitionProvider', () => {
  const ok = (body: unknown, status = 200) =>
    jest.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

  it('posts the image with the install id and validates the response', async () => {
    const fetchImpl = ok({ vehicleDetected: true, candidates: [{ make: 'Kia', model: 'EV6', generation: 'CV', confidence: 0.88 }], notes: null });
    const p = new RemoteRecognitionProvider({ endpoint: 'https://api.example.com/', installId: 'abc', fetchImpl });
    const r = await p.recognize(image);
    expect(r).toMatchObject({ simulated: false, provider: 'remote', vehicleDetected: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/recognize');
    expect((init.headers as Record<string, string>)['X-Install-Id']).toBe('abc');
    expect(JSON.parse(init.body as string)).toEqual({ image: image.base64, width: 1024, height: 768 });
  });

  it.each([
    [429, 'rate_limited'],
    [402, 'quota_exceeded'],
    [503, 'quota_exceeded'],
    [413, 'invalid_request'],
    [500, 'server'],
  ])('maps HTTP %s to %s', async (status, code) => {
    const p = new RemoteRecognitionProvider({ endpoint: 'https://x', installId: 'a', fetchImpl: ok({ error: 'x' }, status) });
    await expect(p.recognize(image)).rejects.toMatchObject({ code });
  });

  it('rejects invalid AI output', async () => {
    const p = new RemoteRecognitionProvider({
      endpoint: 'https://x',
      installId: 'a',
      fetchImpl: ok({ vehicleDetected: true, candidates: [{ make: 'Kia', model: 'EV6', confidence: 7 }] }),
    });
    await expect(p.recognize(image)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('maps network failures and timeouts', async () => {
    const failing = new RemoteRecognitionProvider({
      endpoint: 'https://x',
      installId: 'a',
      fetchImpl: jest.fn(async () => {
        throw new TypeError('Network request failed');
      }),
    });
    await expect(failing.recognize(image)).rejects.toMatchObject({ code: 'network' });

    const hanging = new RemoteRecognitionProvider({
      endpoint: 'https://x',
      installId: 'a',
      timeoutMs: 20,
      fetchImpl: jest.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
      ) as unknown as typeof fetch,
    });
    await expect(hanging.recognize(image)).rejects.toMatchObject({ code: 'timeout' });
  });

  it('times out when headers arrive but the body stalls', async () => {
    const stalled = new RemoteRecognitionProvider({
      endpoint: 'https://x',
      installId: 'a',
      timeoutMs: 20,
      fetchImpl: jest.fn(async () => new Response(new ReadableStream({ start() {} }), { status: 200 })) as unknown as typeof fetch,
    });
    await expect(stalled.recognize(image)).rejects.toMatchObject({ code: 'timeout' });
  });

  it('does not send anything when the caller has already cancelled', async () => {
    const fetchImpl = jest.fn();
    const p = new RemoteRecognitionProvider({ endpoint: 'https://x', installId: 'a', fetchImpl: fetchImpl as unknown as typeof fetch });
    const c = new AbortController();
    c.abort();
    await expect(p.recognize(image, c.signal)).rejects.toBeInstanceOf(RecognitionError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires an image', async () => {
    const p = new RemoteRecognitionProvider({ endpoint: 'https://x', installId: 'a', fetchImpl: ok({}) });
    await expect(p.recognize(null)).rejects.toBeInstanceOf(RecognitionError);
  });
});

describe('resolveRecognitionConfig', () => {
  it('never silently ships mock recognition in release builds', () => {
    expect(resolveRecognitionConfig({}, false)).toEqual({ mode: 'unconfigured', endpoint: null });
    expect(resolveRecognitionConfig({}, true)).toEqual({ mode: 'mock', endpoint: null });
  });

  it('requires HTTPS endpoints outside development', () => {
    expect(resolveRecognitionConfig({ endpoint: 'https://api.vynr.app' }, false).mode).toBe('remote');
    expect(resolveRecognitionConfig({ endpoint: 'http://api.vynr.app' }, false).mode).toBe('unconfigured');
    expect(resolveRecognitionConfig({ endpoint: 'http://192.168.1.5:8787' }, true).mode).toBe('remote');
    expect(resolveRecognitionConfig({ mode: 'remote' }, false).mode).toBe('unconfigured');
    expect(resolveRecognitionConfig({ mode: 'MOCK', endpoint: 'https://x' }, true).mode).toBe('mock');
  });

  it('refuses simulated recognition in release builds even when requested', () => {
    expect(resolveRecognitionConfig({ mode: 'mock' }, false)).toEqual({ mode: 'unconfigured', endpoint: null });
  });
});
