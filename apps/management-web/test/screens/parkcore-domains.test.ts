/**
 * ParkCore Groups Rights catalog: domains map to action prefixes.
 * EffectiveAllowed = RoleAllows(role) ∪ filtered parkcore_actions.
 * Empty / invalid role → no table grants.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ADMIN_GROUP_DETAILS } from '../../src/data/admin-directory-corpus.ts';
import {
  PARKCORE_ACTION_IDS,
  PARKCORE_DOMAIN_CATALOG,
  PARKCORE_DOMAIN_IDS,
  PARKCORE_DOMAIN_PREFIX,
  PARKCORE_ROLE_IDS,
  actionsForParkCoreDomain,
  duplicateCataloguedParkCoreActions,
  effectiveParkcoreActions,
  filterParkCoreActions,
  roleAllowsParkCore,
  parkcoreDomainGrantCounts,
  sessionParkcoreAllowed,
  uncataloguedParkCoreActions,
} from '../../src/data/parkcore-domains.ts';

test('every ParkCore action belongs to exactly one UI domain', () => {
  assert.deepEqual(uncataloguedParkCoreActions(), []);
  assert.deepEqual(duplicateCataloguedParkCoreActions(), []);
  const catalogued = PARKCORE_DOMAIN_CATALOG.flatMap((d) => [...d.actions]);
  assert.equal(catalogued.length, PARKCORE_ACTION_IDS.length);
  assert.deepEqual([...PARKCORE_DOMAIN_IDS], PARKCORE_DOMAIN_CATALOG.map((d) => d.id));
  for (const id of PARKCORE_DOMAIN_IDS) {
    assert.ok(actionsForParkCoreDomain(id).length >= 1, `${id} has no actions`);
  }
});

test('UI domains map to action prefixes from the platform contract', () => {
  assert.equal(PARKCORE_DOMAIN_PREFIX.lanes, 'lane.');
  assert.equal(PARKCORE_DOMAIN_PREFIX.payments, 'payment.');
  assert.equal(PARKCORE_DOMAIN_PREFIX.alarms, 'alarm.');
  assert.equal(PARKCORE_DOMAIN_PREFIX.occupancy, 'occupancy.');
  assert.equal(PARKCORE_DOMAIN_PREFIX.plate_lists, 'list.');
  assert.equal(PARKCORE_DOMAIN_PREFIX.holds, 'hold.');
  assert.equal(PARKCORE_DOMAIN_PREFIX.units, 'unit.');
  assert.equal(PARKCORE_DOMAIN_PREFIX.visitor, 'visitor.');
  assert.equal(PARKCORE_DOMAIN_PREFIX.receipts, 'receipt.');
  for (const action of actionsForParkCoreDomain('lanes')) assert.match(action, /^lane\./);
  for (const action of actionsForParkCoreDomain('payments')) assert.match(action, /^payment\./);
  assert.deepEqual([...actionsForParkCoreDomain('admin')], ['user.admin', 'audit.view']);
});

test('EffectiveAllowed is RoleAllows union filtered parkcore_actions', () => {
  const manager = effectiveParkcoreActions('MANAGER', ['receipt.export', 'not.a.real.action']);
  assert.equal(manager.has('lane.operate'), true);
  assert.equal(manager.has('payment.refund'), true);
  assert.equal(manager.has('receipt.export'), true);
  assert.equal(manager.has('user.admin'), false);
  assert.equal(filterParkCoreActions(['receipt.export', 'not.a.real.action']).includes('receipt.export'), true);
  assert.equal(filterParkCoreActions(['not.a.real.action']).length, 0);

  const readOnly = effectiveParkcoreActions('READ_ONLY', ['alarm.ack']);
  assert.equal(readOnly.has('lane.view'), true);
  assert.equal(readOnly.has('lane.operate'), false);
  assert.equal(readOnly.has('alarm.ack'), true);

  const emptyRole = effectiveParkcoreActions(undefined, ['visitor.admit']);
  assert.equal(emptyRole.has('visitor.admit'), true);
  assert.equal(emptyRole.has('lane.view'), false);
  assert.equal(roleAllowsParkCore(undefined).size, 0);
  assert.equal(roleAllowsParkCore('').size, 0);
  assert.equal(roleAllowsParkCore('not-a-role').size, 0);

  const invalid = effectiveParkcoreActions('NOPE', ['lane.operate', 'bogus']);
  assert.equal(invalid.has('lane.operate'), true);
  assert.equal(invalid.size, 1);
});

test('session ParkCore display subtracts denials from EffectiveAllowed', () => {
  const additive = effectiveParkcoreActions('MANAGER', ['receipt.export']);
  assert.equal(additive.has('lane.operate'), true);
  assert.equal(additive.has('receipt.export'), true);

  const displayed = sessionParkcoreAllowed('MANAGER', ['receipt.export'], ['lane.operate']);
  assert.equal(displayed.has('lane.operate'), false);
  assert.equal(displayed.has('receipt.export'), true);
  assert.equal(displayed.has('lane.view'), true);
  assert.equal(additive.has('lane.operate'), true);
});

test('demo group stubs carry parkcore_role and parkcore_actions for the union rule', () => {
  assert.deepEqual([...PARKCORE_ROLE_IDS], ['ADMINISTRATOR', 'MANAGER', 'OPERATOR', 'READ_ONLY']);
  const estate = ADMIN_GROUP_DETAILS['grp_wfg_estate_managers']!.group;
  assert.equal(estate.parkcore_role, 'MANAGER');
  assert.deepEqual([...(estate.parkcore_actions ?? [])], ['receipt.export']);
  const granted = effectiveParkcoreActions(estate.parkcore_role, estate.parkcore_actions);
  assert.equal(granted.has('receipt.export'), true);
  assert.equal(granted.has('user.admin'), false);

  const security = ADMIN_GROUP_DETAILS['grp_wfg_security']!.group;
  assert.equal(security.parkcore_role, 'READ_ONLY');
  const secGranted = effectiveParkcoreActions(security.parkcore_role, security.parkcore_actions);
  assert.equal(secGranted.has('alarm.ack'), true);
  assert.equal(secGranted.has('lane.operate'), false);
});

test('ParkCore domain grant counts are granted over catalog total', () => {
  const granted = sessionParkcoreAllowed('MANAGER', ['receipt.export'], undefined);
  const counts = parkcoreDomainGrantCounts(granted);
  assert.deepEqual(counts.lanes, { granted: 2, total: 2 });
  assert.deepEqual(counts.alarms, { granted: 1, total: 2 });
  assert.deepEqual(counts.receipts, { granted: 2, total: 2 });
  assert.deepEqual(counts.admin, { granted: 1, total: 2 });
  assert.deepEqual(counts.payments, { granted: 3, total: 3 });
});
