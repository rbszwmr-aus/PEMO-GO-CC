/**
 * Date and time formatting — 09: 24-hour times, DD MMM YYYY dates.
 * A slot start/end is a wall-clock time in Asia/Hong_Kong. `expectedReturn` is a
 * date or null — null is NOT a date and must not be invented (the export's
 * "25 Aug" is not in the corpus).
 */

import { bcp47, pick, type Locale } from '../i18n/locale.ts';

const tz = 'Asia/Hong_Kong';
const bcp = bcp47;

/** 24-hour HH:MM for a slot boundary. */
export function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(bcp(locale), {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  }).format(new Date(iso));
}

/** A slot's HH:MM–HH:MM range. */
export function formatSlotRange(startsAt: string, endsAt: string, locale: Locale): string {
  return `${formatTime(startsAt, locale)}–${formatTime(endsAt, locale)}`;
}

/** DD MMM YYYY for a date (YYYY-MM-DD). */
export function formatDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(bcp(locale), {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: tz,
  }).format(new Date(`${date}T00:00:00+08:00`));
}

/** DD MMM YYYY, HH:MM (24-hour) in Asia/Hong_Kong for an RFC 3339 instant. Unparseable input is returned as-is. */
export function formatDateTimeHkt(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(bcp(locale), {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  }).format(d);
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * "23 Sep 2026, 14:00 HKT" (en) / "2026年9月23日 14:00（香港時間）" (zh-Hant), in
 * Asia/Hong_Kong, 24-hour. Unparseable or empty input is returned as-is.
 */
export function formatHktStamp(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = Number(get('day'));
  const month = Number(get('month'));
  const year = get('year');
  const hh = get('hour').padStart(2, '0');
  const mm = get('minute').padStart(2, '0');
  const zh = `${year}年${month}月${day}日 ${hh}:${mm}`;
  return pick(locale, {
    en: `${day} ${MONTHS_EN[month - 1]} ${year}, ${hh}:${mm} HKT`,
    'zh-Hant': `${zh}（香港時間）`,
    'zh-Hans': `${zh}（香港时间）`,
  });
}
