/** Visitor purpose as the screens read it: resolved against the managed list, never against raw values. */

import type { Locale } from '../i18n/locale.ts';
import { MESSAGES } from '../i18n/messages.ts';
import { t } from '../i18n/locale.ts';
import type { Visit } from '../data/front-counter-client.ts';
import { VISITOR_LIST_FIXTURE, type VisitorRow } from '../data/visitor-fixtures.ts';
import { lookupsClient } from './lookups-client.ts';
import {
  VISITOR_PURPOSE, purposeFilterOptions, resolvePurpose, type FilterOption, type LookupItem, type ResolvedPurpose,
} from './lookup-lists.ts';

export const purposeItems = (): readonly LookupItem[] => lookupsClient().items(VISITOR_PURPOSE);

/** A front-counter visit: the purpose code Backend stores (matched on the code), plus purpose_text for other. */
export function deskPurpose(v: Pick<Visit, 'purpose' | 'purpose_text'> & { purpose_labels?: Visit['purpose_labels'] }, locale: Locale, items: readonly LookupItem[] = purposeItems()): ResolvedPurpose {
  return resolvePurpose({ code: v.purpose, text: v.purpose_text, labels: v.purpose_labels }, items, locale);
}

/** A design-fixture row: its purpose is bilingual words. */
export function fixturePurpose(v: Pick<VisitorRow, 'purpose'>, locale: Locale, items: readonly LookupItem[] = purposeItems()): ResolvedPurpose {
  const p = v.purpose;
  return resolvePurpose({ words: [p.en, p['zh-Hant'], ...(p['zh-Hans'] ? [p['zh-Hans']] : [])], legacyLabel: t(p, locale) }, items, locale);
}

/** The Purpose filter's options for these rows: active types, then Inactive types still in use, then values nothing claims. */
export function purposeOptionsFor(rows: ReadonlyArray<ResolvedPurpose>, locale: Locale): FilterOption[] {
  const M = MESSAGES.lookups;
  return purposeFilterOptions(purposeItems(), rows, locale, { inactive: t(M.groupInactive, locale), other: t(M.groupOther, locale) });
}

/**
 * How many records carry each type, over what the screen can see: today's front-counter visits, plus the
 * design demo rows when the fixture is the source. Backend knows the true count; it answers a DELETE with
 * a 409 and in_use_count, which the Lists page remembers (see AdminLists).
 */
export function purposeUsage(
  visits: ReadonlyArray<Pick<Visit, 'purpose' | 'purpose_text'> & { purpose_labels?: Visit['purpose_labels'] }>,
  items: readonly LookupItem[] = purposeItems(),
  withDesignRows = true,
): Record<string, number> {
  const counts: Record<string, number> = {};
  const add = (r: ResolvedPurpose) => { counts[r.code] = (counts[r.code] ?? 0) + 1; };
  if (withDesignRows) for (const v of VISITOR_LIST_FIXTURE.visitors) add(fixturePurpose(v, 'en', items));
  for (const v of visits) add(deskPurpose(v, 'en', items));
  return counts;
}
