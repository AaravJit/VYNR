import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import { type BenchItem, runOne, summarise } from '../scripts/benchmark.ts';
import { FakeProvider, jpegWithExif } from './helpers.ts';

const dir = mkdtempSync(join(tmpdir(), 'vynr-bench-'));
writeFileSync(join(dir, 'car.jpg'), jpegWithExif());
after(() => rmSync(dir, { recursive: true, force: true }));

const item = (make: string, model: string, generation: string | null): BenchItem => ({
  file: 'car.jpg',
  width: 800,
  height: 600,
  make,
  model,
  generation,
  tags: ['test'],
  source: 'fixture',
  license: 'CC0',
});

describe('benchmark harness', () => {
  it('scores make, model, top-3 and generation, ignoring case and punctuation', async () => {
    const provider = new FakeProvider();
    const hit = await runOne(provider, item('porsche', '911', '992'), dir, 1280);
    assert.equal(hit.error, null);
    assert.equal(hit.makeOk, true);
    assert.equal(hit.modelOk, true);
    assert.equal(hit.modelInTop3, true);
    const wrong = await runOne(provider, item('Toyota', 'Corolla', null), dir, 1280);
    assert.equal(wrong.modelOk, false);
    assert.equal(wrong.generationOk, null);
    assert.ok(wrong.costMicros > 0);
  });

  it('records errors without throwing and summarises', async () => {
    const missing = await runOne(new FakeProvider(), { ...item('A', 'B', null), file: 'nope.jpg' }, dir, 1280);
    assert.ok(missing.error);
    const md = summarise([missing]);
    assert.match(md, /Photos \| 1 \(1 errors\)/);
  });
});
