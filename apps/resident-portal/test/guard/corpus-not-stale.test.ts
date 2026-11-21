/**
 * The generated corpus module is not stale — it is a function of the read-only
 * fixtures, and a hand-edit or a fixture change (contract track) fails here.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/corpus-source.ts';
import { buildCorpusTs } from '../../tool/generate-corpus.ts';

test('src/data/corpus.g.ts matches the fixtures', () => {
  delete process.env.PEMO_PORTAL_FIXTURE_DIR;
  const onDisk = readFileSync(join(APP_ROOT, 'src/data/corpus.g.ts'), 'utf8');
  assert.equal(onDisk, buildCorpusTs(), 'run `pnpm run generate` — corpus.g.ts is stale');
});
