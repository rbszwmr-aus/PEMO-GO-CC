/**
 * The R7 rules panel. Renders the decisions `policyRows` made — absence as a
 * statement, a set value (including 0) as the value. The distinction is in the
 * TEXT, not merely a style; `data-absent` is diagnostic, not the signal.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { policyRows } from '../data/policy.ts';
import type { FacilityRules } from '../data/types.ts';

export function PolicyRules({ rules, locale }: { rules: FacilityRules; locale: Locale }) {
  const rows = policyRows(rules, locale);
  return (
    <div className="pemo-rules" data-testid="rules">
      <h3 className="pemo-rules__heading">{t(MESSAGES.booking.rules.heading, locale)}</h3>
      <dl className="pemo-rules__list">
        {rows.map((r) => (
          <div key={r.key} className="pemo-rule" data-testid={`rule-${r.key}`} data-absent={r.absent}>
            <dt className="pemo-rule__label">{r.label}</dt>
            <dd className={`pemo-rule__value${r.absent ? ' pemo-rule__value--absent' : ''}`}>{r.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
