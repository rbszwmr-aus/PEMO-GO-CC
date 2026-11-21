/**
 * Shared function-domain catalog: every staff feature lives in exactly one tab.
 * Group rights union the default roles through the role → feature matrix.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ADMIN_ROLES_MATRIX } from '../../src/data/admin-directory-corpus.ts';
import {
  FEATURE_DOMAIN_CATALOG,
  FEATURE_DOMAIN_IDS,
  duplicateCataloguedFeatures,
  effectiveGroupPemoFeatures,
  featureDomainGrantCounts,
  featuresForDomain,
  grantedFeaturesForRoles,
  uncataloguedFeatures,
} from '../../src/data/feature-domains.ts';
import { STAFF_FEATURE_IDS } from '../../src/data/types.ts';

test('every staff feature belongs to exactly one function domain', () => {
  assert.deepEqual(uncataloguedFeatures(), []);
  assert.deepEqual(duplicateCataloguedFeatures(), []);
  const catalogued = FEATURE_DOMAIN_CATALOG.flatMap((d) => [...d.features]);
  assert.equal(catalogued.length, STAFF_FEATURE_IDS.length);
  assert.deepEqual([...FEATURE_DOMAIN_IDS], FEATURE_DOMAIN_CATALOG.map((d) => d.id));
  for (const id of FEATURE_DOMAIN_IDS) {
    assert.ok(featuresForDomain(id).length >= 1, `${id} has no features`);
  }
});

test('group rights union default roles through the role feature matrix', () => {
  const estate = grantedFeaturesForRoles(['estate_manager'], ADMIN_ROLES_MATRIX);
  assert.equal(estate.has('view_overview'), true);
  assert.equal(estate.has('manage_visitors'), true);
  assert.equal(estate.has('manage_residents'), true);
  assert.equal(estate.has('admin_users'), false);
  assert.equal(estate.has('view_audit'), false);

  const security = grantedFeaturesForRoles(['security'], ADMIN_ROLES_MATRIX);
  assert.equal(security.has('manage_visitors'), true);
  assert.equal(security.has('manage_access'), true);
  assert.equal(security.has('manage_helpdesk'), false);
  assert.equal(security.has('manage_bookings'), false);

  const dual = grantedFeaturesForRoles(['security', 'help_desk'], ADMIN_ROLES_MATRIX);
  assert.equal(dual.has('manage_visitors'), true);
  assert.equal(dual.has('manage_helpdesk'), true);
  assert.equal(dual.has('manage_residents'), true);
  assert.equal(dual.has('admin_users'), false);
  assert.equal(dual.size, new Set([...security, ...grantedFeaturesForRoles(['help_desk'], ADMIN_ROLES_MATRIX)]).size);
});

test('session PEMO grants are role union extras minus denials', () => {
  const roleOnly = effectiveGroupPemoFeatures(['estate_manager'], undefined, undefined, ADMIN_ROLES_MATRIX);
  assert.equal(roleOnly.has('view_overview'), true);
  assert.equal(roleOnly.has('admin_users'), false);

  const extras = effectiveGroupPemoFeatures(
    ['estate_manager'],
    ['admin_users', 'not.a.feature'],
    undefined,
    ADMIN_ROLES_MATRIX,
  );
  assert.equal(extras.has('view_overview'), true);
  assert.equal(extras.has('admin_users'), true);

  const denied = effectiveGroupPemoFeatures(
    ['estate_manager'],
    ['admin_users'],
    ['view_overview'],
    ADMIN_ROLES_MATRIX,
  );
  assert.equal(denied.has('view_overview'), false);
  assert.equal(denied.has('admin_users'), true);
  assert.equal(denied.has('manage_visitors'), true);
});

test('PEMO domain grant counts are granted over catalog total', () => {
  const granted = grantedFeaturesForRoles(['estate_manager'], ADMIN_ROLES_MATRIX);
  const counts = featureDomainGrantCounts(granted);
  assert.deepEqual(counts.overview_properties, { granted: 4, total: 4 });
  assert.deepEqual(counts.residents_households, { granted: 2, total: 2 });
  assert.deepEqual(counts.visitors, { granted: 2, total: 2 });
  assert.deepEqual(counts.administration, { granted: 0, total: 3 });
  assert.deepEqual(counts.facility_booking, { granted: 1, total: 1 });

  const withAdmin = effectiveGroupPemoFeatures(
    ['estate_manager'],
    ['admin_users'],
    ['view_overview'],
    ADMIN_ROLES_MATRIX,
  );
  const next = featureDomainGrantCounts(withAdmin);
  assert.deepEqual(next.overview_properties, { granted: 3, total: 4 });
  assert.deepEqual(next.administration, { granted: 1, total: 3 });
});
