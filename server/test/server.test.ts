import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { hasExif } from '../src/shared/jpeg.ts';
import { UpstreamError } from '../src/providers/types.ts';
import { type Harness, imageBody, INSTALL, jpegWithExif, okResult, startServer, uniqueImageBody } from './helpers.ts';

let h: Harness | null = null;
afterEach(async () => {
  await h?.close();
  h = null;
});

describe('POST /v1/recognize', () => {
  it('returns validated predictions and strips metadata before calling the provider', async () => {
    h = await startServer();
    const res = await h.post(imageBody());
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), okResult);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(h.provider.calls.length, 1);
    assert.equal(hasExif(h.provider.calls[0]!), false);
    assert.ok(!Buffer.from(h.provider.calls[0]!).toString('latin1').includes('GPS'));
  });

  it('never logs install ids, IPs or image data', async () => {
    h = await startServer();
    await h.post(imageBody());
    const all = h.logs.join('\n');
    assert.match(all, /POST \/v1\/recognize 200/);
    assert.ok(!all.includes(INSTALL));
    assert.ok(!all.includes('127.0.0.1'));
    assert.ok(!all.includes(imageBody().image.slice(0, 12)));
  });

  for (const [name, body, headers, status] of [
    ['missing install id', imageBody(), { 'X-Install-Id': '' }, 400],
    ['malformed install id', imageBody(), { 'X-Install-Id': 'not-hex!' }, 400],
    ['non-JSON content type', 'x', { 'Content-Type': 'text/plain' }, 415],
    ['invalid JSON', '{nope', {}, 400],
    ['missing image', { width: 100, height: 100 }, {}, 400],
    ['non-base64 image', { image: '***', width: 100, height: 100 }, {}, 400],
    ['PNG image', { image: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]).toString('base64'), width: 100, height: 100 }, {}, 415],
    ['corrupt JPEG', { image: Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x50, 1, 2]).toString('base64'), width: 100, height: 100 }, {}, 400],
    ['oversized dimensions', { ...imageBody(), width: 99999 }, {}, 400],
    ['fractional dimensions', { ...imageBody(), height: 10.5 }, {}, 400],
  ] as const) {
    it(`rejects ${name} with ${status} without calling the provider`, async () => {
      h = await startServer();
      const res = await h.post(body, headers as Record<string, string>);
      assert.equal(res.status, status);
      assert.equal(h.provider.calls.length, 0);
    });
  }

  it('rejects oversized images with 413', async () => {
    h = await startServer({ maxImageBytes: 2048 });
    const res = await h.post(imageBody(jpegWithExif(4096)));
    assert.equal(res.status, 413);
    assert.equal(h.provider.calls.length, 0);
  });

  it('rate limits per install with Retry-After, then recovers in the next window', async () => {
    h = await startServer({ perInstallPerMinute: 2 });
    assert.equal((await h.post(uniqueImageBody())).status, 200);
    assert.equal((await h.post(uniqueImageBody())).status, 200);
    const limited = await h.post(uniqueImageBody());
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    // A different install is unaffected.
    assert.equal((await h.post(uniqueImageBody(), { 'X-Install-Id': 'b'.repeat(32) })).status, 200);
    h.clock.t += 60_000;
    assert.equal((await h.post(uniqueImageBody())).status, 200);
  });

  it('rate limits per IP across installs', async () => {
    h = await startServer({ perIpPerMinute: 2 });
    await h.post(uniqueImageBody(), { 'X-Install-Id': '1'.repeat(32) });
    await h.post(uniqueImageBody(), { 'X-Install-Id': '2'.repeat(32) });
    assert.equal((await h.post(uniqueImageBody(), { 'X-Install-Id': '3'.repeat(32) })).status, 429);
  });

  it('enforces the global daily budget and resets at UTC midnight', async () => {
    h = await startServer({ globalDailyBudget: 1 });
    assert.equal((await h.post(uniqueImageBody())).status, 200);
    const res = await h.post(uniqueImageBody(), { 'X-Install-Id': 'c'.repeat(32) });
    assert.equal(res.status, 503);
    assert.equal(h.provider.calls.length, 1);
    h.clock.t += 86_400_000;
    assert.equal((await h.post(uniqueImageBody(), { 'X-Install-Id': 'c'.repeat(32) })).status, 200);
  });

  it('does not spend budget on requests that fail validation', async () => {
    h = await startServer({ globalDailyBudget: 1 });
    assert.equal((await h.post({ image: '***', width: 100, height: 100 })).status, 400);
    assert.equal((await h.post(uniqueImageBody())).status, 200);
  });

  it('caps concurrent upstream calls', async () => {
    h = await startServer({ maxConcurrent: 1 });
    let release!: () => void;
    h.provider.impl = () => new Promise((r) => (release = () => r(okResult)));
    const first = h.post(uniqueImageBody());
    while (h.provider.calls.length === 0) await new Promise((r) => setTimeout(r, 5));
    const second = await h.post(uniqueImageBody(), { 'X-Install-Id': 'd'.repeat(32) });
    assert.equal(second.status, 429);
    release();
    assert.equal((await first).status, 200);
  });

  it('maps provider failures without leaking details', async () => {
    h = await startServer();
    h.provider.impl = async () => {
      throw new UpstreamError('invalid_output', 'secret detail');
    };
    let res = await h.post(uniqueImageBody());
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { error: 'upstream_failed' });

    h.provider.impl = async () => {
      throw new UpstreamError('refused', 'x');
    };
    res = await h.post(uniqueImageBody());
    assert.equal(res.status, 422);

    h.provider.impl = async () => {
      throw new Error('boom');
    };
    res = await h.post(uniqueImageBody());
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: 'internal' });
  });

  it('times out slow upstream calls with 504', async () => {
    h = await startServer({ upstreamTimeoutMs: 30 });
    h.provider.impl = (signal) =>
      new Promise((_, reject) => signal.addEventListener('abort', () => reject(new UpstreamError('unavailable', 'aborted'))));
    assert.equal((await h.post(uniqueImageBody())).status, 504);
  });
});

describe('other routes', () => {
  it('serves /health and rejects unknown routes and methods', async () => {
    h = await startServer();
    const health = await fetch(`${h.url}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, provider: 'fake' });
    assert.equal((await fetch(`${h.url}/nope`)).status, 404);
    assert.equal((await fetch(`${h.url}/v1/recognize`)).status, 405);
  });

  it('only trusts X-Forwarded-For behind a configured proxy', async () => {
    h = await startServer({ perIpPerMinute: 1, trustProxy: false });
    await h.post(uniqueImageBody(), { 'X-Forwarded-For': '1.1.1.1', 'X-Install-Id': '1'.repeat(32) });
    // Spoofed header is ignored: same socket IP, so limited.
    assert.equal((await h.post(imageBody(), { 'X-Forwarded-For': '2.2.2.2', 'X-Install-Id': '2'.repeat(32) })).status, 429);
    await h.close();

    h = await startServer({ perIpPerMinute: 1, trustProxy: true });
    await h.post(uniqueImageBody(), { 'X-Forwarded-For': '1.1.1.1', 'X-Install-Id': '1'.repeat(32) });
    assert.equal((await h.post(uniqueImageBody(), { 'X-Forwarded-For': '2.2.2.2', 'X-Install-Id': '2'.repeat(32) })).status, 200);
  });
});

describe('persistent quotas, spend ceilings and deduplication', () => {
  it('answers a byte-identical photo from cache without a second paid call', async () => {
    h = await startServer();
    assert.equal((await h.post(imageBody())).status, 200);
    const again = await h.post(imageBody());
    assert.equal(again.status, 200);
    assert.equal(again.headers.get('x-recognition-cache'), 'hit');
    assert.deepEqual(await again.json(), okResult);
    assert.equal(h.provider.calls.length, 1);
  });

  it('coalesces identical photos that arrive while the first call is still running', async () => {
    h = await startServer();
    let release!: () => void;
    h.provider.impl = () => new Promise((r) => (release = () => r(okResult)));
    const a = h.post(imageBody());
    while (h.provider.calls.length === 0) await new Promise((r) => setTimeout(r, 5));
    const b = h.post(imageBody(), { 'X-Install-Id': 'e'.repeat(32) });
    await new Promise((r) => setTimeout(r, 20));
    release();
    assert.equal((await a).status, 200);
    assert.equal((await b).status, 200);
    assert.equal(h.provider.calls.length, 1);
  });

  it('enforces the daily spend ceiling using the worst-case reservation, then settles the real cost', async () => {
    // Each call reserves its 1000 µ$ worst case and settles at 400 µ$ actual, against a 2100 µ$ ceiling.
    h = await startServer({ dailySpendUsd: 0.0021 });
    assert.equal((await h.post(uniqueImageBody())).status, 200);
    assert.equal((await h.post(uniqueImageBody())).status, 200);
    // 800 spent + 1000 reserved still fits; after that 1200 + 1000 does not.
    assert.equal((await h.post(uniqueImageBody())).status, 200);
    const res = await h.post(uniqueImageBody());
    assert.equal(res.status, 503);
    assert.equal(h.provider.calls.length, 3);
    const usage = h.store.usage(h.clock.now());
    assert.equal(usage.spentMicros, 1200);
    assert.equal(usage.reservedMicros, 0);
  });

  it('enforces the monthly spend ceiling across days', async () => {
    h = await startServer({ monthlySpendUsd: 0.0013 });
    assert.equal((await h.post(uniqueImageBody())).status, 200);
    h.clock.t += 86_400_000;
    assert.equal((await h.post(uniqueImageBody())).status, 503);
  });

  it('settles failed calls at their billed cost and frees the reservation', async () => {
    h = await startServer();
    h.provider.impl = async () => {
      throw new UpstreamError('invalid_output', 'truncated', 250);
    };
    assert.equal((await h.post(uniqueImageBody())).status, 502);
    const usage = h.store.usage(h.clock.now());
    assert.equal(usage.reservedMicros, 0);
    assert.equal(usage.spentMicros, 250);
  });

  it('keeps rate limits and spend across a server restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vynr-'));
    const stateFile = join(dir, 'state.sqlite');
    h = await startServer({ stateFile, perInstallPerDay: 1 });
    assert.equal((await h.post(uniqueImageBody())).status, 200);
    const t = h.clock.t;
    await h.close();
    h = await startServer({ stateFile, perInstallPerDay: 1 });
    h.clock.t = t + 1000;
    assert.equal((await h.post(uniqueImageBody())).status, 429);
    assert.equal(h.store.usage(h.clock.now()).spentMicros, 400);
    await h.close();
    h = null;
    await rm(dir, { recursive: true, force: true });
  });
});
