/**
 * Household composition ids must resolve to household + resident detail fixtures.
 * List → detail is URL-carried; a missing member stub is a "not found" page.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { findHouseholdDetail, HOUSEHOLDS_LIST } from '../../src/data/households-corpus.ts';
import { findResidentDetail, RESIDENTS_LIST } from '../../src/data/residents-corpus.ts';

test('every household list row has a matching detail fixture', () => {
  assert.ok(HOUSEHOLDS_LIST.households.length >= 4, 'household list is hollow');
  for (const row of HOUSEHOLDS_LIST.households) {
    const detail = findHouseholdDetail(row.householdId);
    assert.ok(detail, `no household detail for ${row.householdId}`);
    assert.equal(detail.household.householdId, row.householdId);
    assert.ok(detail.household.unitLabel?.en || detail.household.unitLabel?.['zh-Hant'], `${row.householdId} has no unitLabel`);
    assert.ok(row.contactEmail && row.contactEmail.includes('@'), `${row.householdId} missing contactEmail`);
    assert.equal(detail.household.contactEmail, row.contactEmail);
  }
});

test('every household member has a matching resident detail', () => {
  let members = 0;
  for (const row of HOUSEHOLDS_LIST.households) {
    const detail = findHouseholdDetail(row.householdId);
    assert.ok(detail);
    for (const mem of detail.household.members) {
      members += 1;
      const resident = findResidentDetail(mem.residentId);
      assert.ok(resident, `no resident detail for household member ${mem.residentId} (${mem.name})`);
      assert.equal(resident.resident.residentId, mem.residentId);
      assert.equal(resident.resident.displayName, mem.name);
    }
  }
  assert.ok(members >= 6, `only ${members} household members — pairing is measuring nothing`);
});

test('every resident list row has a matching detail fixture', () => {
  assert.ok(RESIDENTS_LIST.residents.length >= 8, 'resident list is hollow');
  assert.equal(RESIDENTS_LIST.counts.all, RESIDENTS_LIST.residents.length);
  for (const row of RESIDENTS_LIST.residents) {
    const detail = findResidentDetail(row.residentId);
    assert.ok(detail, `no resident detail for ${row.residentId}`);
    assert.equal(detail.resident.residentId, row.residentId);
    assert.equal(detail.resident.displayName, row.displayName);
  }
});

test('findHouseholdDetail and findResidentDetail miss unknown ids', () => {
  assert.equal(findHouseholdDetail('hh_does_not_exist'), undefined);
  assert.equal(findResidentDetail('res_does_not_exist'), undefined);
  assert.ok(findResidentDetail('res_wfg_000512'));
  assert.ok(findHouseholdDetail('hh_wfg_b_03_b2'));
});
