/**
 * residentsDetail URL parameter: canonical residentId, legacy alias read-only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESIDENT_ID_LEGACY_ALIAS,
  RESIDENT_ID_PARAM,
  readResidentId,
  writeResidentId,
} from '../../src/shell/resident-param.ts';

test('the legacy alias is the pre-69b4fcc key and differs from residentId', () => {
  assert.equal(RESIDENT_ID_PARAM, 'residentId');
  assert.equal(RESIDENT_ID_LEGACY_ALIAS, 'resident');
  assert.notEqual(RESIDENT_ID_LEGACY_ALIAS, RESIDENT_ID_PARAM);
});

test('readResidentId prefers residentId and falls back to the legacy alias', () => {
  const legacy = new URLSearchParams();
  legacy.set(RESIDENT_ID_LEGACY_ALIAS, 'res_wfg_000412');
  assert.equal(readResidentId(legacy), 'res_wfg_000412');

  const canonical = new URLSearchParams('screen=residentsDetail&residentId=res_wfg_000908');
  assert.equal(readResidentId(canonical), 'res_wfg_000908');

  const both = new URLSearchParams('residentId=res_new');
  both.set(RESIDENT_ID_LEGACY_ALIAS, 'res_old');
  assert.equal(readResidentId(both), 'res_new');

  assert.equal(readResidentId(new URLSearchParams('screen=residentsDetail')), undefined);
});

test('writeResidentId emits residentId only, never the legacy alias', () => {
  const q = new URLSearchParams('screen=residentsDetail');
  q.set(RESIDENT_ID_LEGACY_ALIAS, 'res_old');
  writeResidentId(q, 'res_wfg_000412');
  assert.equal(q.get(RESIDENT_ID_PARAM), 'res_wfg_000412');
  assert.equal(q.has(RESIDENT_ID_LEGACY_ALIAS), false);

  const empty = new URLSearchParams();
  writeResidentId(empty, undefined);
  assert.equal(empty.toString(), '');
});
