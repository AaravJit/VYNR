import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

// @ts-expect-error plain JS module without type declarations
import { CATALOG_TARGET, catalogJson, SHARED, transform } from '../scripts/sync-shared.mjs';

const root = join(import.meta.dirname, '..', '..');

describe('shared modules', () => {
  it('match the app source (run `node scripts/sync-shared.mjs` after editing the app copies)', (t) => {
    if (!existsSync(join(root, 'src/services/jpeg.ts'))) {
      t.skip('app source not present (standalone server checkout)');
      return;
    }
    for (const [from, to] of SHARED as [string, string][]) {
      assert.equal(readFileSync(join(root, to), 'utf8'), transform(readFileSync(join(root, from), 'utf8')), `${to} is stale`);
    }
  });

  it('ships the same catalog as the app', async (t) => {
    if (!existsSync(join(root, 'src/catalog/vehicles.ts'))) {
      t.skip('app source not present (standalone server checkout)');
      return;
    }
    assert.equal(readFileSync(join(root, CATALOG_TARGET as string), 'utf8'), await catalogJson(), 'server catalog is stale');
  });
});
