/**
 * Locale-aware date and time. Design system section 16.
 *
 * Two rules from the contract are enforced by shape here rather than by
 * convention: an occurrence time is never silently swapped for a receipt time,
 * and a duration is never concatenated out of translated fragments.
 */

import { bcp47, pick, type Locale } from '../i18n/locale.ts';

/** The estate timezone. Displayed explicitly where ambiguity exists — section 16. */
export const ESTATE_TIME_ZONE = 'Asia/Hong_Kong';

export function dateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(bcp47(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ESTATE_TIME_ZONE,
  }).format(new Date(iso));
}

/** '12 Aug 09:42' (no year, estate zone); the title of the cell carries the full stamp. */
export function dateTimeShort(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(bcp47(locale), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: ESTATE_TIME_ZONE,
  }).format(new Date(iso));
}

export function timeOnly(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(bcp47(locale), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ESTATE_TIME_ZONE,
  }).format(new Date(iso));
}

/** Clock time in the estate zone as 24-hour HH:mm, in every language; '–' when there is no timestamp. */
export function clockHHmm(iso: string | null | undefined): string {
  const ms = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) return '–';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: ESTATE_TIME_ZONE }).format(new Date(ms));
}

export function dateOnly(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(bcp47(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: ESTATE_TIME_ZONE,
  }).format(new Date(iso));
}

/**
 * A duration, formatted by Intl rather than assembled from pieces.
 *
 * Design system section 16 forbids concatenating translated fragments, and
 * "6h held" is exactly that shape. The contract already splits the state from
 * the number for the same reason.
 */
export function minutes(total: number, locale: Locale): string {
  const rtf = new Intl.NumberFormat(bcp47(locale));
  if (total < 60) return pick(locale, { en: `${rtf.format(total)} min`, 'zh-Hant': `${rtf.format(total)} 分鐘`, 'zh-Hans': `${rtf.format(total)} 分钟` });
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hours = pick(locale, { en: `${rtf.format(h)} h`, 'zh-Hant': `${rtf.format(h)} 小時`, 'zh-Hans': `${rtf.format(h)} 小时` });
  if (m === 0) return hours;
  const mins = pick(locale, { en: `${rtf.format(m)} min`, 'zh-Hant': `${rtf.format(m)} 分鐘`, 'zh-Hans': `${rtf.format(m)} 分钟` });
  return `${hours} ${mins}`;
}

/**
 * A time relative to a reference instant, by Intl, never assembled from
 * fragments (section 16).
 *
 * THE REFERENCE IS A PARAMETER, NOT THE WALL CLOCK. The notices surface passes the
 * response's own `meta.generatedAt`: "three weeks ago" is then a fact about the
 * response rather than about when the browser happened to open, and a fixture
 * renders the same words on every run. A client-supplied "now" would make the
 * rendered age drift while the data did not — the same reason the server refuses
 * a client clock for freshness.
 */
export function relativeTime(iso: string, referenceIso: string, locale: Locale): string {
  const seconds = (new Date(iso).getTime() - new Date(referenceIso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(bcp47(locale), { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800],
    ['day', 86_400], ['hour', 3_600], ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds), 'second');
}

export const number = (n: number, locale: Locale): string =>
  new Intl.NumberFormat(bcp47(locale)).format(n);

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * "23 Sep 2026, 14:00 HKT" (en) / "2026年9月23日 14:00（香港時間）" (zh-Hant) / "2026年9月23日 14:00（香港时间）" (zh-Hans), estate
 * time, 24-hour. Unparseable or empty input is returned as-is.
 */
export function hktStamp(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: ESTATE_TIME_ZONE,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const month = Number(get('month'));
  const hh = get('hour').padStart(2, '0');
  const mm = get('minute').padStart(2, '0');
  const zh = `${get('year')}年${month}月${Number(get('day'))}日 ${hh}:${mm}`;
  return pick(locale, {
    en: `${Number(get('day'))} ${MONTHS_EN[month - 1]} ${get('year')}, ${hh}:${mm} HKT`,
    'zh-Hant': `${zh}（香港時間）`,
    'zh-Hans': `${zh}（香港时间）`,
  });
}
