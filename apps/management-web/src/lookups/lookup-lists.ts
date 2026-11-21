/**
 * Managed lookup lists: the types staff pick from (visitor purpose first), kept as data instead of
 * being read off whatever raw values the records happen to carry.
 *
 * A type has a STABLE CODE (matching, storage, filters), a label in each language, an order and an
 * active flag. Records store the code. Deactivating a type removes it from new forms and filters; old
 * records keep the code and keep resolving to its label. Everything in this file is pure so it can be
 * tested without a browser.
 *
 * CONTRACT: Backend docs/contracts/lookup-lists-v0-PROPOSED_v0.1.md (feat/front-counter-visitors @ 8f09794).
 * Base /api/management-web/v0, Bearer. The adapter in lookups-client.ts is the only place that speaks it:
 *   GET    /lookups/{list_key}?include_inactive=true   -> { list_key, items: [{ code, labels, sort_order, active, scope, is_system }] }
 *   POST   /admin/lookups/{list_key}                   { code, label_en, label_zh_hant, label_zh_hans }
 *   PATCH  /admin/lookups/{list_key}/{code}            { label_*, sort_order, active }
 *   POST   /admin/lookups/{list_key}/reorder           { codes: [...] }
 *   DELETE /admin/lookups/{list_key}/{code}            409 lookup-code-in-use (in_use_count) / lookup-code-protected
 */

import type { Locale } from '../i18n/locale.ts';

export interface LookupLabels {
  en: string;
  'zh-Hant': string;
  'zh-Hans': string;
}

export interface LookupItem {
  /** Stable. Never shown on a main view and never reused. */
  code: string;
  labels: LookupLabels;
  sortOrder: number;
  active: boolean;
  /** The fallback type (other): it cannot be deactivated or deleted, only renamed. */
  isSystem: boolean;
  scope: 'global' | 'estate';
}

export const VISITOR_PURPOSE = 'visitor_purpose';

/** The fallback code a list uses when text matches no type. */
export const FALLBACK_CODE = 'other';

/** The seed for Visitor purpose: the Backend list as documented (codes, labels, sort order, system fallback). */
export const VISITOR_PURPOSE_SEED: readonly LookupItem[] = [
  seed('delivery', 'Delivery', '送貨', '送货', 10),
  seed('contractor', 'Contractor', '承辦商', '承办商', 20),
  seed('visit', 'Visit', '探訪', '探访', 30),
  seed('caregiver', 'Caregiver', '照顧者', '照顾者', 40),
  seed('family_visit', 'Family visit', '探訪家人', '探访家人', 50),
  { ...seed('other', 'Other', '其他', '其他', 900), isSystem: true },
];

function seed(code: string, en: string, hant: string, hans: string, sortOrder: number): LookupItem {
  return { code, labels: { en, 'zh-Hant': hant, 'zh-Hans': hans }, sortOrder, active: true, isSystem: false, scope: 'global' };
}

export const labelOf = (item: Pick<LookupItem, 'labels'>, locale: Locale): string => item.labels[locale];

/** Active types, in order: what a new form or a filter offers. */
export function activeItems(items: readonly LookupItem[]): LookupItem[] {
  return items.filter((i) => i.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function orderedItems(items: readonly LookupItem[]): LookupItem[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Letters and Han characters only, lower case: "Family visit", "family-visit" and "FamilyVisit" are one key. */
export function foldLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]/g, '');
}

/** Spellings the raw data used, per built-in code (already folded). Several records said the same thing in different words. */
const SYNONYMS: Record<string, string[]> = {
  visit: ['visit', 'visits', 'visitor', 'visiting', '探訪', '探访', '訪客', '访客', '拜訪', '拜访'],
  family_visit: ['family', 'familyvisit', 'familyvisitor', 'visitfamily', 'visitingfamily', '探訪家人', '探访家人', '家人探訪', '家人探访', '家人', '親友', '亲友'],
  caregiver: ['caregiver', 'caregivers', 'carer', 'careworker', '照顧者', '照顾者', '看護', '護理員', '护理员'],
  contractor: ['contractor', 'contractors', 'worker', 'workers', '承辦商', '承办商', '承包商', '工人'],
  delivery: ['delivery', 'deliveries', 'courier', '送貨', '送货', '速遞', '快递'],
  other: ['other', 'others', '其他', '其它'],
};

/** The code a raw purpose value stands for, or null when nothing in the list claims it (a legacy value). */
export function normalizePurpose(raw: string | null | undefined, items: readonly LookupItem[]): string | null {
  const key = foldLabel(raw ?? '');
  if (!key) return null;
  for (const it of items) {
    if (foldLabel(it.code) === key) return it.code;
    for (const l of [it.labels.en, it.labels['zh-Hant'], it.labels['zh-Hans']]) if (foldLabel(l) === key) return it.code;
  }
  const codes = new Set(items.map((i) => i.code));
  for (const [code, words] of Object.entries(SYNONYMS)) if (codes.has(code) && words.includes(key)) return code;
  return null;
}

/** A legacy value that no type claims: it filters and shows under its own words. */
export const legacyCode = (raw: string): string => `legacy:${foldLabel(raw) || raw.trim().toLowerCase()}`;
export const isLegacyCode = (code: string): boolean => code.startsWith('legacy:');

export interface ResolvedPurpose {
  /** The type's code, or `legacy:<folded raw>` when no type claims the value. */
  code: string;
  /** What to show: the type's label in this language, or the raw words for a legacy value. */
  label: string;
}

/** What a record carries: the code Backend stores, its text (only for other), and the labels Backend resolved. */
export interface PurposeValue {
  code?: string | undefined;
  text?: string | null | undefined;
  labels?: Partial<LookupLabels> | undefined;
  /** Design-fixture rows carry plain words instead of a code. */
  words?: ReadonlyArray<string> | undefined;
  legacyLabel?: string | undefined;
}

/**
 * A record's purpose in managed terms. Matching is on the code. A row from an older API (code other + text
 * that names a type) and plain words still fold to a type; anything nothing claims keeps its own words.
 */
export function resolvePurpose(value: PurposeValue, items: readonly LookupItem[], locale: Locale): ResolvedPurpose {
  const byCode = new Map(items.map((i) => [i.code, i]));
  const text = value.text?.trim() ?? '';
  const known = value.code ? byCode.get(value.code) : undefined;
  if (known) {
    if (known.code !== FALLBACK_CODE || !text) return { code: known.code, label: labelOf(known, locale) };
    const via = normalizePurpose(text, items);
    if (via && via !== FALLBACK_CODE) return { code: via, label: labelOf(byCode.get(via)!, locale) };
    return { code: FALLBACK_CODE, label: text };
  }
  if (value.code && value.labels) {
    return { code: value.code, label: value.labels[locale] ?? value.labels.en ?? value.code };
  }
  for (const c of [value.code, text, ...(value.words ?? [])]) {
    const code = normalizePurpose(c, items);
    if (code) return { code, label: labelOf(byCode.get(code)!, locale) };
  }
  const raw = text || value.words?.[0] || value.code || '';
  return { code: legacyCode(raw), label: value.legacyLabel ?? raw };
}

export interface FilterOption { value: string; label: string; group?: string | undefined }

/**
 * Options for a Purpose filter: one per active type (list order), then inactive types that records still use,
 * then legacy values nothing claims. `used` is the set of codes the rows actually carry.
 */
export function purposeFilterOptions(
  items: readonly LookupItem[],
  rows: ReadonlyArray<ResolvedPurpose>,
  locale: Locale,
  groups: { inactive: string; other: string },
): FilterOption[] {
  const used = new Set(rows.map((r) => r.code));
  const out: FilterOption[] = activeItems(items).map((i) => ({ value: i.code, label: labelOf(i, locale) }));
  for (const i of orderedItems(items)) if (!i.active && used.has(i.code)) out.push({ value: i.code, label: labelOf(i, locale), group: groups.inactive });
  const seen = new Set<string>();
  for (const r of rows) {
    if (isLegacyCode(r.code) && !seen.has(r.code)) { seen.add(r.code); out.push({ value: r.code, label: r.label, group: groups.other }); }
  }
  return out;
}

/** Whether Delete is offered: not for the fallback type, and only when nothing is known to use the type. */
export const canDelete = (item: Pick<LookupItem, 'isSystem'>, usage: number | null): boolean => !item.isSystem && usage === 0;

/** Whether Deactivate is offered: every type but the fallback. */
export const canDeactivate = (item: Pick<LookupItem, 'isSystem'>): boolean => !item.isSystem;

/** Slug for a new type's code: stable, ASCII, unique within the list. */
export function newCode(labelEn: string, taken: ReadonlySet<string>): string {
  const base = labelEn.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36) || 'type';
  let code = base;
  for (let n = 2; taken.has(code); n += 1) code = `${base}_${n}`;
  return code;
}

export interface ListDefinition {
  listKey: string;
  /** Whether a screen reads this list yet. Unwired lists show as placeholders. */
  wired: boolean;
  seed: readonly LookupItem[];
}

export const LIST_REGISTRY: readonly ListDefinition[] = [
  { listKey: VISITOR_PURPOSE, wired: true, seed: VISITOR_PURPOSE_SEED },
  { listKey: 'case_type', wired: false, seed: [] },
  { listKey: 'helpdesk_category', wired: false, seed: [] },
];
