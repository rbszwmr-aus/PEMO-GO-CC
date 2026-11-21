/**
 * THE CORPUS DIGEST HASHES WHAT IS AUTHORED, NOT WHAT IS STAMPED (UI-066).
 *
 * `stamp-version.mjs` writes `contractVersion` into every fixture from openapi.yaml's
 * info.version. UI CC does not author it, so the digest must exclude it — otherwise a
 * backend contract bump reds the guard with pure version-stamp noise (GEN-064). This
 * guard proves the fix bites in both directions AND that it stays complete: if
 * stamp-version ever stamps a second field, the last test reds and says "neutralise it
 * too". Principle: a-digest-must-hash-what-is-authored-not-what-is-stamped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, CORPUS_DIR, stripStampedVersion } from '../../tool/corpus-source.ts';

const hash = (b: Buffer): string => createHash('sha256').update(stripStampedVersion(b)).digest('hex');
const STAMP = join(REPO_ROOT, 'packages/api-contracts/stamp-version.mjs');

// A real fixture that carries a stamped contractVersion.
const FIXTURE = join(CORPUS_DIR, 'mob-s5-notices/detail.json');
const raw = readFileSync(FIXTURE);

test('a contract-version bump alone leaves the digest unchanged — and the field really was there', () => {
  const at220 = Buffer.from(raw.toString('utf8').replace(/("contractVersion"\s*:\s*")[^"]*(")/g, '$12.2.0$2'), 'utf8');
  const at230 = Buffer.from(raw.toString('utf8').replace(/("contractVersion"\s*:\s*")[^"]*(")/g, '$12.3.0$2'), 'utf8');
  // Non-vacuity: the two raw buffers genuinely differ (the stamp is present and moved).
  assert.notEqual(at220.toString('utf8'), at230.toString('utf8'), 'the fixture carries no contractVersion — this test proves nothing');
  // The whole point: the hash does not move with the stamp.
  assert.equal(hash(at220), hash(at230), 'a version bump moved the digest — the stamped field is still being hashed');
});

test('an AUTHORED content change still moves the digest — the guard did not go blind', () => {
  const tampered = Buffer.from(raw.toString('utf8').replace(/"titleEn"\s*:\s*"[^"]*"/, '"titleEn":"TAMPERED"'), 'utf8');
  assert.notEqual(tampered.toString('utf8'), raw.toString('utf8'), 'the tamper did not apply');
  assert.notEqual(hash(tampered), hash(raw), 'an authored change did not move the digest — stripping is too broad');
});

test('stamp-version stamps NO fixture field beyond contractVersion — so stripping one field is complete', () => {
  const src = readFileSync(STAMP, 'utf8');
  // Every two-group value-substitution regex `("<field>": ")[^"]*(")` in the stamper.
  const fields = new Set<string>();
  for (const m of src.matchAll(/\("(\w+)":\s*"\)/g)) fields.add(m[1] as string);
  assert.ok(fields.size > 0, 'found no substitution regexes in stamp-version.mjs — the scan is not reaching it');
  assert.deepEqual(
    [...fields].sort(),
    ['contractVersion'],
    `stamp-version now stamps a field stripStampedVersion does not neutralise: ${[...fields].join(', ')}. ` +
      `Add it to STAMPED_CONTRACT_VERSION in corpus-source.ts, or the digest reds on that stamp too.`,
  );
});
