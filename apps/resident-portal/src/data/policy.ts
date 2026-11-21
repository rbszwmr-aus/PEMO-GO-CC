/**
 * THE R7 DECISION LAYER — absence is not zero.
 *
 * `null`/omitted means the property operates no such policy; a set value
 * (including `0`) means it does. These are OPPOSITE statements and render
 * differently. This module makes the decision in PLAIN TypeScript so it is both
 * node-testable and the exact layer test 6 mutates — a mutation that edits a
 * read-only fixture would be testing the fixture, not the render logic.
 *
 * There is no `?? 0` and no zero fallback here. `isAbsent` is the ONE decision;
 * test 6 coerces it BOTH directions (null→0 and 0→null) and both must go red.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import type { FacilityRules } from './types.ts';
import { formatMoney } from '../format/money.ts';

/** The load-bearing distinction. Absent iff null or omitted — NEVER because zero. */
export const isAbsent = (v: unknown): boolean => v === null || v === undefined;

export interface PolicyRow {
  key: string;
  label: string;
  /** True when the property operates no such policy (rendered as a statement). */
  absent: boolean;
  text: string;
}

const fill = (s: string, vars: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));

export function policyRows(rules: FacilityRules, locale: Locale): PolicyRow[] {
  const R = MESSAGES.booking.rules;
  const tt = (x: LocalizedText) => t(x, locale);
  const rows: PolicyRow[] = [];

  // Booking window
  rows.push(isAbsent(rules.bookingWindow)
    ? { key: 'bookingWindow', label: tt(R.bookingWindow), absent: true, text: tt(R.noBookingWindow) }
    : { key: 'bookingWindow', label: tt(R.bookingWindow), absent: false,
        text: fill(tt(R.windowValue), { opens: rules.bookingWindow!.opensDaysBefore, closes: rules.bookingWindow!.closesHoursBefore }) });

  // Per-person quota — the clean null-vs-zero field
  rows.push(isAbsent(rules.perPersonQuotaPerMonth)
    ? { key: 'quota', label: tt(R.quota), absent: true, text: tt(R.noQuota) }
    : { key: 'quota', label: tt(R.quota), absent: false, text: fill(tt(R.quotaValue), { n: rules.perPersonQuotaPerMonth as number }) });

  // Cancellation ladder
  rows.push(isAbsent(rules.cancellationLadder)
    ? { key: 'cancellation', label: tt(R.cancellation), absent: true, text: tt(R.noCancellation) }
    : { key: 'cancellation', label: tt(R.cancellation), absent: false,
        text: (rules.cancellationLadder ?? []).map((c) => fill(tt(R.cancellationTier), { hours: c.untilHoursBefore, percent: c.refundPercent })).join(' · ') });

  // Admin fee — null (no policy) vs {amount:0} (a fee of HK$0)
  rows.push(isAbsent(rules.adminFee)
    ? { key: 'adminFee', label: tt(R.adminFee), absent: true, text: tt(R.noAdminFee) }
    : { key: 'adminFee', label: tt(R.adminFee), absent: false, text: formatMoney(rules.adminFee!) });

  // No-show release
  rows.push(isAbsent(rules.noShowReleaseMinutes)
    ? { key: 'noShow', label: tt(R.noShow), absent: true, text: tt(R.noNoShow) }
    : { key: 'noShow', label: tt(R.noShow), absent: false, text: fill(tt(R.noShowValue), { n: rules.noShowReleaseMinutes as number }) });

  // Make-up
  rows.push(isAbsent(rules.makeUpAllowed)
    ? { key: 'makeUp', label: tt(R.makeUp), absent: true, text: tt(R.noMakeUp) }
    : { key: 'makeUp', label: tt(R.makeUp), absent: false, text: rules.makeUpAllowed ? tt(R.makeUpYes) : tt(R.makeUpNo) });

  return rows;
}
