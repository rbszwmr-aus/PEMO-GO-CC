/**
 * Shared function-domain catalog for Administration Groups rights,
 * User effective permissions, and Roles & features. One place so those
 * screens stay consistent.
 *
 * Effective permission is the union of features granted by each of a
 * person’s groups’ default roles (via the role → feature matrix), plus
 * session extras minus session denials on Groups Rights.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import type { AdminRolesMatrixResponse, StaffFeatureId, StaffRoleId } from './types.ts';
import { STAFF_FEATURE_IDS } from './types.ts';

export type FeatureDomainId =
  | 'overview_properties'
  | 'residents_households'
  | 'visitors'
  | 'helpdesk_cases'
  | 'notices_documents'
  | 'facility_booking'
  | 'payments_strata'
  | 'administration';

export const FEATURE_DOMAIN_IDS: readonly FeatureDomainId[] = [
  'overview_properties',
  'residents_households',
  'visitors',
  'helpdesk_cases',
  'notices_documents',
  'facility_booking',
  'payments_strata',
  'administration',
];

export const FEATURE_DOMAIN_CATALOG: readonly {
  id: FeatureDomainId;
  features: readonly StaffFeatureId[];
}[] = [
  {
    id: 'overview_properties',
    features: ['view_overview', 'view_safety', 'manage_properties', 'view_reports'],
  },
  {
    id: 'residents_households',
    features: ['manage_residents', 'manage_households'],
  },
  {
    id: 'visitors',
    features: ['manage_visitors', 'manage_access'],
  },
  {
    id: 'helpdesk_cases',
    features: ['manage_helpdesk', 'manage_cases'],
  },
  {
    id: 'notices_documents',
    features: ['manage_notices', 'manage_documents'],
  },
  {
    id: 'facility_booking',
    features: ['manage_bookings'],
  },
  {
    id: 'payments_strata',
    features: ['manage_payments'],
  },
  {
    id: 'administration',
    features: ['admin_users', 'manage_groups', 'view_audit'],
  },
];

export function featuresForDomain(domain: FeatureDomainId): readonly StaffFeatureId[] {
  const row = FEATURE_DOMAIN_CATALOG.find((d) => d.id === domain);
  return row ? row.features : [];
}

export function domainForFeature(feature: StaffFeatureId): FeatureDomainId | undefined {
  return FEATURE_DOMAIN_CATALOG.find((d) => d.features.includes(feature))?.id;
}

/** Drop strings that are not in the closed staff-feature set. */
export function filterStaffFeatures(features: readonly string[] | undefined): StaffFeatureId[] {
  if (!features) return [];
  return STAFF_FEATURE_IDS.filter((f) => features.includes(f));
}

/** Union of features granted by any of the given roles in the matrix. */
export function grantedFeaturesForRoles(
  roles: readonly StaffRoleId[],
  matrix: AdminRolesMatrixResponse,
): ReadonlySet<StaffFeatureId> {
  const out = new Set<StaffFeatureId>();
  for (const role of roles) {
    for (const feature of matrix.granted[role] ?? []) out.add(feature);
  }
  return out;
}

/**
 * Session PEMO grants for a group: role matrix union extras, minus denials.
 * extras / denied are closed-set filtered the same way as parkcore_actions.
 */
export function effectiveGroupPemoFeatures(
  roles: readonly StaffRoleId[],
  extras: readonly string[] | undefined,
  denied: readonly string[] | undefined,
  matrix: AdminRolesMatrixResponse,
): ReadonlySet<StaffFeatureId> {
  const out = new Set(grantedFeaturesForRoles(roles, matrix));
  for (const feature of filterStaffFeatures(extras)) out.add(feature);
  for (const feature of filterStaffFeatures(denied)) out.delete(feature);
  return out;
}

export function featureLabel(feature: StaffFeatureId, locale: Locale): string {
  return t(MESSAGES.admin.feature[feature], locale);
}

export function featureDomainLabel(domain: FeatureDomainId, locale: Locale): string {
  return t(MESSAGES.admin.featureDomain[domain], locale);
}

export type DomainGrantCount = { granted: number; total: number };

/** Per-domain granted/total from the current session grant set. */
export function featureDomainGrantCounts(
  granted: ReadonlySet<StaffFeatureId>,
): Record<FeatureDomainId, DomainGrantCount> {
  const out = {} as Record<FeatureDomainId, DomainGrantCount>;
  for (const id of FEATURE_DOMAIN_IDS) {
    const features = featuresForDomain(id);
    let n = 0;
    for (const feature of features) if (granted.has(feature)) n += 1;
    out[id] = { granted: n, total: features.length };
  }
  return out;
}

/** Catalog covers every staff feature exactly once. Used by the node proof. */
export function uncataloguedFeatures(): StaffFeatureId[] {
  return STAFF_FEATURE_IDS.filter((f) => domainForFeature(f) === undefined);
}

export function duplicateCataloguedFeatures(): StaffFeatureId[] {
  const seen = new Set<StaffFeatureId>();
  const dup: StaffFeatureId[] = [];
  for (const row of FEATURE_DOMAIN_CATALOG) {
    for (const feature of row.features) {
      if (seen.has(feature)) dup.push(feature);
      else seen.add(feature);
    }
  }
  return dup;
}
