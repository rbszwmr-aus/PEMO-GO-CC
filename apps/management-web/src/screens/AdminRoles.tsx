/**
 * Administration — Roles & features matrix, fixture-first.
 *
 * Read-only Role × feature flags, grouped by function-domain tabs.
 * Writes are named under DeferredActions.
 * Effective permission = union of a person’s groups’ roles’ features.
 */

import { InfoTip } from '../components/FinanceBits.tsx';
import { useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { Table } from '../components/Table.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import { FeatureDomainTabs, FeatureGrantMark } from '../components/FeatureDomainTabs.tsx';
import {
  FEATURE_DOMAIN_IDS,
  featureLabel,
  featuresForDomain,
  type FeatureDomainId,
} from '../data/feature-domains.ts';
import type { AdminRolesMatrixResponse, StaffRoleId } from '../data/types.ts';

const m = copy;

const DEFERRED = [
  m('Add a role', '新增角色', '新增角色'),
];

function roleLabel(role: StaffRoleId, locale: Locale): string {
  return t(MESSAGES.admin.role[role], locale);
}

export function AdminRolesMatrix({
  data,
  locale,
}: {
  data: AdminRolesMatrixResponse;
  locale: Locale;
}) {
  const M = MESSAGES.admin;
  const [domain, setDomain] = useState<FeatureDomainId>(FEATURE_DOMAIN_IDS[0]!);
  const features = featuresForDomain(domain);
  const columns = [
    { key: 'feature', label: t(M.matrixCaption, locale), width: '28%' },
    ...data.roles.map((role) => ({
      key: role,
      label: roleLabel(role, locale),
      width: `${Math.floor(72 / data.roles.length)}%`,
    })),
  ];

  return (
    <>
      <section className="pemo-panel" data-testid="admin-roles-matrix-panel">
        <div className="pemo-hint-row">
          <InfoTip text={`${t(M.rolesBoundaryNote, locale)} ${t(M.rolesWriteNote, locale)}`} />
          <InfoTip text={t(M.fixtureLabel, locale)} testId="admin-roles-fixture-label" />
        </div>
        <FeatureDomainTabs
          active={domain}
          locale={locale}
          onChange={setDomain}
          idPrefix="admin-roles"
        />
        <div
          role="tabpanel"
          id="admin-roles-panel"
          data-testid="admin-function-tabpanel"
          data-domain={domain}
          aria-labelledby={`admin-roles-tab-${domain}`}
        >
          <Table caption={t(M.matrixCaption, locale)} columns={columns} testId="admin-roles-matrix">
            {features.map((feature) => (
              <tr key={feature} data-testid="admin-roles-row" data-feature={feature}>
                <th scope="row">{featureLabel(feature, locale)}</th>
                {data.roles.map((role) => {
                  const on = data.granted[role].includes(feature);
                  return (
                    <td
                      key={role}
                      className="pemo-matrix-cell"
                      data-testid="admin-role-feature"
                      data-role={role}
                      data-feature={feature}
                      data-granted={on ? 'true' : 'false'}
                    >
                      <FeatureGrantMark
                        granted={on}
                        locale={locale}
                        title={`${roleLabel(role, locale)} · ${featureLabel(feature, locale)} — ${on ? t(M.granted, locale) : t(M.notGranted, locale)}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </Table>
        </div>
      </section>

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}
