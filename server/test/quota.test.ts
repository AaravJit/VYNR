import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { SqliteCounterStore } from '../src/store.ts';
import { type Harness, imageBody, startServer } from './helpers.ts';

let h: Harness | null = null;
const dirs: string[] = [];
afterEach(async () => {
  await h?.close();
  h = null;
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function tempDb(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vynr-quota-'));
  dirs.push(dir);
  return join(dir, 'nested', 'quota.db');
}

describe('spend ceiling', () => {
  it('stops upstream calls once the estimated daily spend reaches the limit, and resets the next UTC day', async () => {
    // 1,000 input + 100 output tokens at $4/$20 per MTok = $0.006 per call.
    h = await startServer({ dailySpendLimitUsd: 0.01, inputUsdPerMTok: 4, outputUsdPerMTok: 20 });
    assert.equal((await h.post(imageBody())).status, 200);
    assert.equal((await h.post(imageBody())).status, 200); // $0.006 spent, still under $0.01
    const res = await h.post(imageBody());
    assert.equal(res.status, 503);
    assert.equal(h.provider.calls.length, 2);
    h.clock.t += 86_400_000;
    assert.equal((await h.post(imageBody())).status, 200);
  });

  it('counts spend from calls whose output is rejected', async () => {
    h = await startServer({ dailySpendLimitUsd: 0.005, inputUsdPerMTok: 4, outputUsdPerMTok: 20 });
    h.provider.impl = async () => {
      throw new Error('invalid');
    };
    assert.equal((await h.post(imageBody())).status, 500);
    assert.equal((await h.post(imageBody())).status, 503);
  });
});

describe('durable counters', () => {
  it('keeps the daily budget and rate limits across a restart', async () => {
    const path = tempDb();
    let store = new SqliteCounterStore(path);
    h = await startServer({ globalDailyBudget: 1, perInstallPerMinute: 5 }, { store });
    assert.equal((await h.post(imageBody())).status, 200);
    await h.close();
    store.close();

    store = new SqliteCounterStore(path);
    h = await startServer({ globalDailyBudget: 1, perInstallPerMinute: 5 }, { store });
    assert.equal((await h.post(imageBody())).status, 503, 'budget must survive the restart');
    await h.close();
    store.close();
    h = null;
  });

  it('accumulates fractional amounts and prunes old windows', () => {
    const store = new SqliteCounterStore(tempDb());
    store.add('spend', '2026-11-24', 0.25);
    store.add('spend', '2026-11-25', 0.25);
    assert.equal(store.add('spend', '2026-11-25', 0.5), 0.75);
    store.add('im:a_b%', '1', 1);
    store.prune('spend', '2026-11-25');
    assert.equal(store.get('spend', '2026-11-24'), 0);
    assert.equal(store.get('spend', '2026-11-25'), 0.75);
    // LIKE wildcards in keys are escaped: pruning "im:" must not touch other prefixes.
    store.prune('i_:', '999');
    assert.equal(store.get('im:a_b%', '1'), 1);
    store.close();
  });
});
