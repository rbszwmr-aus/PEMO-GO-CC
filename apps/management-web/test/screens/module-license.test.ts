/**
 * Fixture license: default demo estate is dual-buy (pemo + parkcore).
 * Absent modules param keeps the default; modules=pemo hides sibling tabs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LICENSED_MODULES,
  MODULES_PARAM,
  canonicalizeLicensedModules,
  isModuleLicensed,
  readLicensedModules,
  writeLicensedModules,
} from '../../src/data/module-license.ts';

test('default demo estate is licensed for PEMO and ParkCore', () => {
  assert.deepEqual([...DEFAULT_LICENSED_MODULES], ['pemo', 'parkcore']);
  const absent = readLicensedModules(new URLSearchParams());
  assert.deepEqual([...absent], ['pemo', 'parkcore']);
  assert.equal(isModuleLicensed(absent, 'parkcore'), true);
  assert.equal(isModuleLicensed(absent, 'pemo'), true);
});

test('modules=pemo excludes ParkCore from the fixture license', () => {
  const q = new URLSearchParams('modules=pemo');
  const licensed = readLicensedModules(q);
  assert.deepEqual([...licensed], ['pemo']);
  assert.equal(isModuleLicensed(licensed, 'parkcore'), false);
});

test('writeLicensedModules omits the default dual-buy list from the URL', () => {
  const q = new URLSearchParams();
  writeLicensedModules(q, ['parkcore', 'pemo']);
  assert.equal(q.get(MODULES_PARAM), null);
  writeLicensedModules(q, ['pemo']);
  assert.equal(q.get(MODULES_PARAM), 'pemo');
  assert.deepEqual(canonicalizeLicensedModules(['parkcore', 'unknown', 'pemo']), ['pemo', 'parkcore']);
});
